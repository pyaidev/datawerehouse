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
        run_started_at = datetime.now(UTC)
        run_started_perf = time.perf_counter()
        run_id = str(uuid4())
        source = get_source(request.source)
        stages: list[StageResult] = []
        warnings: list[str] = []
        failed_stage: str | None = None
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
            nonlocal failed_stage
            if failed_stage:
                return None

            started = time.perf_counter()
            started_at = datetime.now(UTC)

            if request.failure_stage == stage_id:
                ended_at = datetime.now(UTC)
                failed_stage = stage_id
                message = f"TEST FAILURE: {name} bosqichida nazoratli xatolik"
                warnings.append(message)
                stages.append(
                    StageResult(
                        id=stage_id,
                        name=name,
                        status="error",
                        sequence=len(stages) + 1,
                        started_at=started_at.isoformat(),
                        ended_at=ended_at.isoformat(),
                        duration_ms=round((time.perf_counter() - started) * 1000),
                        data_size_bytes=json_size(input_preview),
                        data_format="JSON",
                        message=message,
                        warnings=[message],
                        input_ref=input_ref,
                        input_preview=input_preview,
                        output_preview={"test_failure": True, "failed_stage": stage_id, "retryable": True},
                        artifacts={"failure_mode": "controlled test", "retry": "Run request with failure_stage=none"},
                    )
                )
                return None

            try:
                result = await fn()
                details = detail_builder(result) if detail_builder else {}
                ended_at = datetime.now(UTC)
                message = details.get("message") or (str(result) if result is not None else "done")
                output_ref = details.get("output_ref")
                fallback_used = isinstance(output_ref, str) and output_ref.startswith(("local://", "kafka-fallback://"))
                stage_status = "warning" if fallback_used else "done"
                stage_warnings: list[str] = []
                if fallback_used:
                    fallback_warning = f"{name}: external service fallback ishlatildi: {output_ref}"
                    warnings.append(fallback_warning)
                    stage_warnings.append(fallback_warning)
                stages.append(
                    StageResult(
                        id=stage_id,
                        name=name,
                        status=stage_status,
                        sequence=len(stages) + 1,
                        started_at=started_at.isoformat(),
                        ended_at=ended_at.isoformat(),
                        duration_ms=round((time.perf_counter() - started) * 1000),
                        data_size_bytes=details.get("data_size_bytes", json_size(details.get("output_preview", result))),
                        data_format=details.get("data_format", "JSON"),
                        message=message,
                        warnings=stage_warnings,
                        input_ref=input_ref,
                        input_preview=input_preview,
                        output_ref=output_ref,
                        output_preview=details.get("output_preview"),
                        metrics=details.get("metrics", {}),
                        artifacts=details.get("artifacts", {}),
                    )
                )
                return result
            except Exception as exc:
                ended_at = datetime.now(UTC)
                if self.settings.strict_external_services:
                    stages.append(
                        StageResult(
                            id=stage_id,
                            name=name,
                            status="error",
                            sequence=len(stages) + 1,
                            started_at=started_at.isoformat(),
                            ended_at=ended_at.isoformat(),
                            duration_ms=round((time.perf_counter() - started) * 1000),
                            data_size_bytes=json_size(input_preview),
                            data_format="JSON",
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
                        sequence=len(stages) + 1,
                        started_at=started_at.isoformat(),
                        ended_at=ended_at.isoformat(),
                        duration_ms=round((time.perf_counter() - started) * 1000),
                        data_size_bytes=json_size(input_preview),
                        data_format="JSON",
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
                "data_size_bytes": json_size(result),
                "data_format": "JSON",
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
                "data_size_bytes": json_size(kafka_event),
                "data_format": "Kafka JSON event",
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
                "data_size_bytes": json_size(payload),
                "data_format": "JSON object",
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
                "data_size_bytes": json_size(raw_rows),
                "data_format": "Raw JSON rows",
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
                "data_size_bytes": json_size([check.model_dump() for check in quality_checks]),
                "data_format": "Validation JSON",
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
                "data_size_bytes": json_size(curated_rows),
                "data_format": "Curated rows",
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
                "data_size_bytes": json_size(curated_rows),
                "data_format": "Curated JSON",
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
                "data_size_bytes": json_size(curated_rows),
                "data_format": "ClickHouse rows",
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
                "data_size_bytes": json_size(audit),
                "data_format": "PostgreSQL row",
                "artifacts": {"table": "pipeline_runs", "primary_key": "run_id"},
            },
        )

        finished_at = datetime.now(UTC)
        run_status = "error" if failed_stage else "warning" if warnings else "done"
        return PipelineRunResult(
            run_id=run_id,
            source=request.source,
            mode=request.mode,
            status=run_status,
            started_at=run_started_at.isoformat(),
            finished_at=finished_at.isoformat(),
            duration_ms=round((time.perf_counter() - run_started_perf) * 1000),
            failed_stage=failed_stage,
            records=len(raw_rows),
            quality_score=quality_score,
            curated_fields=len(curated_rows[0].keys()) if curated_rows else 0,
            stages=stages,
            quality_checks=quality_checks,
            warnings=warnings,
            raw_preview=raw_rows[:10],
            curated_preview=curated_rows[:10],
            lineage=build_lineage(raw_rows, curated_rows, request.source, run_id),
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


def json_size(value: Any) -> int:
    if value is None:
        return 0
    return len(json.dumps(value, ensure_ascii=False, default=str).encode("utf-8"))


def build_lineage(
    raw_rows: list[dict[str, Any]],
    curated_rows: list[dict[str, Any]],
    source: str,
    run_id: str,
) -> list[dict[str, Any]]:
    lineage: list[dict[str, Any]] = []
    for index, raw in enumerate(raw_rows[:10]):
        curated = curated_rows[index] if index < len(curated_rows) else None
        source_id = raw.get("id", index)
        lineage.append(
            {
                "record_id": str(source_id),
                "source": {"system": "DummyJSON", "entity": source, "id": source_id},
                "raw": raw,
                "curated": curated,
                "warehouse": {
                    "database": "dwh",
                    "table": "curated_events",
                    "key": curated.get("dw_id") if curated else None,
                    "run_id": run_id,
                } if curated else None,
            }
        )
    return lineage
