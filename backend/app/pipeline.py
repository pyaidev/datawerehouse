import json
import time
from collections.abc import Awaitable, Callable
from datetime import UTC, datetime
from typing import Any
from uuid import uuid4

import httpx

from .config import Settings
from .databases import MetadataStore, WarehouseStore
from .kafka_bus import EventBus
from .quality import validate_rows
from .schemas import PipelineRunRequest, PipelineRunResult, StageResult
from .sources import get_source
from .storage import ObjectStore
from .transform import curate_rows, normalize_payload


class PipelineRunner:
    def __init__(self, settings: Settings):
        self.settings = settings
        self.object_store = ObjectStore(settings)
        self.event_bus = EventBus(settings)
        self.metadata_store = MetadataStore(settings)
        self.warehouse_store = WarehouseStore(settings)

    async def run(self, request: PipelineRunRequest) -> PipelineRunResult:
        run_id = str(uuid4())
        source = get_source(request.source)
        stages: list[StageResult] = []
        warnings: list[str] = []
        raw_rows: list[dict[str, Any]] = []
        curated_rows: list[dict[str, Any]] = []
        quality_checks = []
        quality_score = 0

        async def stage(
            stage_id: str,
            name: str,
            fn: Callable[[], Awaitable[Any]],
            *,
            input_ref: str | None = None,
            input_preview: Any = None,
            detail_builder: Callable[[Any], dict[str, Any]] | None = None,
        ) -> Any:
            started = time.perf_counter()
            try:
                result = await fn()
                details = detail_builder(result) if detail_builder else {}
                message = details.get("message") or (str(result) if result is not None else "done")
                stages.append(
                    StageResult(
                        id=stage_id,
                        name=name,
                        status="done",
                        duration_ms=round((time.perf_counter() - started) * 1000),
                        message=message,
                        input_ref=input_ref,
                        input_preview=input_preview,
                        output_ref=details.get("output_ref"),
                        output_preview=details.get("output_preview"),
                        metrics=details.get("metrics", {}),
                        artifacts=details.get("artifacts", {}),
                    )
                )
                return result
            except Exception as exc:
                if self.settings.strict_external_services:
                    stages.append(
                        StageResult(
                            id=stage_id,
                            name=name,
                            status="error",
                            duration_ms=round((time.perf_counter() - started) * 1000),
                            message=str(exc),
                            input_ref=input_ref,
                            input_preview=input_preview,
                        )
                    )
                    raise
                warning = f"{name}: {type(exc).__name__}: {exc}"
                warnings.append(warning)
                stages.append(
                    StageResult(
                        id=stage_id,
                        name=name,
                        status="warning",
                        duration_ms=round((time.perf_counter() - started) * 1000),
                        message="fallback used",
                        warnings=[warning],
                        input_ref=input_ref,
                        input_preview=input_preview,
                        output_preview={"fallback": True, "warning": warning},
                    )
                )
                return None

        extract_url = f"{self.settings.dummyjson_base_url}{source['endpoint']}"

        async def extract() -> dict[str, Any]:
            async with httpx.AsyncClient(timeout=30) as client:
                response = await client.get(extract_url, params={"limit": request.limit})
                response.raise_for_status()
                return response.json()

        payload = await stage(
            "fastapi",
            "FastAPI API Gateway extract",
            extract,
            input_ref="POST /pipeline/run -> external source",
            input_preview={
                "source": request.source,
                "source_title": source["title"],
                "external_url": extract_url,
                "query": {"limit": request.limit},
                "mode": request.mode,
            },
            detail_builder=lambda result: {
                "message": f"GET {source['endpoint']} -> {payload_count(result, source['collection'])} records",
                "output_ref": extract_url,
                "output_preview": summarize_payload(result, source["collection"]),
                "metrics": {
                    "records_received": payload_count(result, source["collection"]),
                    "top_level_keys": list(result.keys()) if isinstance(result, dict) else [],
                },
                "artifacts": {"source_entity": source["entity"], "collection_key": source["collection"]},
            },
        )
        raw_rows = normalize_payload(payload, source["collection"]) if payload else []

        kafka_event = {
            "run_id": run_id,
            "source": request.source,
            "mode": request.mode,
            "records": len(raw_rows),
            "created_at": datetime.now(UTC).isoformat(),
        }

        async def publish_to_kafka() -> str:
            return self.event_bus.publish(self.settings.kafka_topic_ingestion, kafka_event)

        await stage(
            "kafka",
            "Kafka ingestion event",
            publish_to_kafka,
            input_ref="FastAPI normalized payload summary",
            input_preview=kafka_event,
            detail_builder=lambda result: {
                "message": result,
                "output_ref": result,
                "output_preview": {"topic": self.settings.kafka_topic_ingestion, "event": kafka_event},
                "metrics": {"events_published": 1, "records_in_event": len(raw_rows)},
                "artifacts": {"bootstrap_servers": self.settings.kafka_bootstrap_servers, "topic": self.settings.kafka_topic_ingestion},
            },
        )

        landing_key = f"{request.source}/{run_id}/landing.json"

        async def landing_write() -> str:
            return self.object_store.put_json(self.settings.minio_landing_bucket, landing_key, payload)

        await stage(
            "landing",
            "MinIO landing write",
            landing_write,
            input_ref=extract_url,
            input_preview=summarize_payload(payload, source["collection"]),
            detail_builder=lambda result: {
                "message": result,
                "output_ref": result,
                "output_preview": {"bucket": self.settings.minio_landing_bucket, "key": landing_key, "format": "json"},
                "metrics": {"records_written": len(raw_rows), "object_count": 1},
                "artifacts": {"zone": "landing", "content": "original external payload"},
            },
        )

        raw_key = f"{request.source}/{run_id}/raw.json"

        async def raw_write() -> str:
            return self.object_store.put_json(self.settings.minio_raw_bucket, raw_key, raw_rows)

        await stage(
            "raw",
            "MinIO raw zone write",
            raw_write,
            input_ref=f"s3://{self.settings.minio_landing_bucket}/{landing_key}",
            input_preview=summarize_payload(payload, source["collection"]),
            detail_builder=lambda result: {
                "message": result,
                "output_ref": result,
                "output_preview": sample_rows(raw_rows),
                "metrics": {"records_written": len(raw_rows), "sample_rows": min(len(raw_rows), 3)},
                "artifacts": {"zone": "raw", "bucket": self.settings.minio_raw_bucket, "key": raw_key},
            },
        )

        async def quality() -> str:
            nonlocal quality_score, quality_checks
            quality_score, quality_checks = validate_rows(raw_rows)
            return f"quality_score={quality_score}"

        await stage(
            "gx",
            "Great Expectations style validation",
            quality,
            input_ref=f"s3://{self.settings.minio_raw_bucket}/{raw_key}",
            input_preview=sample_rows(raw_rows),
            detail_builder=lambda result: {
                "message": result,
                "output_ref": "quality://great-expectations-style-checks",
                "output_preview": [check.model_dump() for check in quality_checks],
                "metrics": {
                    "quality_score": quality_score,
                    "checks_total": len(quality_checks),
                    "checks_passed": sum(1 for check in quality_checks if check.passed),
                },
                "artifacts": {"validation_engine": "backend/app/quality.py", "strict_gate": quality_score >= 90},
            },
        )

        async def transform() -> str:
            nonlocal curated_rows
            curated_rows = curate_rows(
                raw_rows,
                source_id=request.source,
                source_title=source["title"],
                mode=request.mode,
                run_id=run_id,
            )
            return f"curated_rows={len(curated_rows)}"

        await stage(
            "spark",
            "Spark/dbt compatible transform",
            transform,
            input_ref=f"s3://{self.settings.minio_raw_bucket}/{raw_key}",
            input_preview=sample_rows(raw_rows),
            detail_builder=lambda result: {
                "message": result,
                "output_ref": "memory://curated_rows -> MinIO/ClickHouse",
                "output_preview": sample_rows(curated_rows),
                "metrics": {
                    "input_rows": len(raw_rows),
                    "output_rows": len(curated_rows),
                    "curated_fields": len(curated_rows[0].keys()) if curated_rows else 0,
                },
                "artifacts": {
                    "python_transform": "backend/app/transform.py",
                    "pyspark_job": "spark/jobs/dummyjson_curate.py",
                    "dbt_models": "dbt/dwh_project/models",
                },
            },
        )

        curated_key = f"{request.source}/{run_id}/curated.json"

        async def curated_write() -> str:
            return self.object_store.put_json(self.settings.minio_raw_bucket, curated_key, curated_rows)

        await stage(
            "curated",
            "Curated zone write",
            curated_write,
            input_ref="memory://curated_rows",
            input_preview=sample_rows(curated_rows),
            detail_builder=lambda result: {
                "message": result,
                "output_ref": result,
                "output_preview": sample_rows(curated_rows),
                "metrics": {"records_written": len(curated_rows), "object_count": 1},
                "artifacts": {"zone": "curated", "bucket": self.settings.minio_raw_bucket, "key": curated_key},
            },
        )

        async def load_clickhouse() -> str:
            return self.warehouse_store.insert_curated(curated_rows)

        await stage(
            "clickhouse",
            "ClickHouse warehouse load",
            load_clickhouse,
            input_ref=f"s3://{self.settings.minio_raw_bucket}/{curated_key}",
            input_preview=sample_rows(curated_rows),
            detail_builder=lambda result: {
                "message": result,
                "output_ref": result,
                "output_preview": {
                    "database": self.settings.clickhouse_database,
                    "table": "curated_events",
                    "inserted_rows": len(curated_rows),
                    "sample_metric_sum": round(sum(float(row.get("metric_value") or 0) for row in curated_rows), 2),
                },
                "metrics": {"inserted_rows": len(curated_rows), "target_table": "curated_events"},
                "artifacts": {"ddl_owner": "backend/app/databases.py", "engine": "MergeTree"},
            },
        )

        audit = {
            "run_id": run_id,
            "source": request.source,
            "mode": request.mode,
            "status": "done",
            "records": len(raw_rows),
            "quality_score": quality_score,
            "warnings": json.dumps(warnings),
        }

        async def audit_postgres() -> str:
            return self.metadata_store.upsert_run(audit)

        await stage(
            "postgres",
            "PostgreSQL run audit",
            audit_postgres,
            input_ref="pipeline runtime summary",
            input_preview=audit,
            detail_builder=lambda result: {
                "message": result,
                "output_ref": result,
                "output_preview": {**audit, "warnings": warnings},
                "metrics": {"audit_rows_upserted": 1, "records": len(raw_rows), "quality_score": quality_score},
                "artifacts": {"table": "pipeline_runs", "primary_key": "run_id"},
            },
        )

        return PipelineRunResult(
            run_id=run_id,
            source=request.source,
            mode=request.mode,
            records=len(raw_rows),
            quality_score=quality_score,
            curated_fields=len(curated_rows[0].keys()) if curated_rows else 0,
            stages=stages,
            quality_checks=quality_checks,
            warnings=warnings,
            raw_preview=raw_rows[:10],
            curated_preview=curated_rows[:10],
        )


def payload_count(payload: Any, collection_key: str) -> int:
    if isinstance(payload, list):
        return len(payload)
    if isinstance(payload, dict) and isinstance(payload.get(collection_key), list):
        return len(payload[collection_key])
    return 0


def summarize_payload(payload: Any, collection_key: str) -> dict[str, Any]:
    if isinstance(payload, dict):
        rows = payload.get(collection_key)
        return {
            "type": "object",
            "top_level_keys": list(payload.keys()),
            "collection_key": collection_key,
            "records": len(rows) if isinstance(rows, list) else 0,
            "sample": sample_rows(rows if isinstance(rows, list) else []),
        }
    if isinstance(payload, list):
        return {"type": "array", "records": len(payload), "sample": sample_rows(payload)}
    return {"type": type(payload).__name__, "value": payload}


def sample_rows(rows: list[dict[str, Any]], limit: int = 3) -> list[dict[str, Any]]:
    return rows[:limit]