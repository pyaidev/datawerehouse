from datetime import datetime
from typing import Any

import clickhouse_connect
import psycopg
from psycopg.rows import dict_row

from .config import Settings


class MetadataStore:
    def __init__(self, settings: Settings):
        self.settings = settings

    def upsert_run(self, run: dict[str, Any]) -> str:
        ddl = """
        create table if not exists pipeline_runs (
            run_id text primary key,
            source text not null,
            mode text not null,
            status text not null,
            records integer not null,
            quality_score integer not null,
            warnings jsonb not null default '[]'::jsonb,
            created_at timestamptz not null default now(),
            updated_at timestamptz not null default now()
        )
        """
        dml = """
        insert into pipeline_runs (run_id, source, mode, status, records, quality_score, warnings)
        values (%(run_id)s, %(source)s, %(mode)s, %(status)s, %(records)s, %(quality_score)s, %(warnings)s::jsonb)
        on conflict (run_id) do update set
            status = excluded.status,
            records = excluded.records,
            quality_score = excluded.quality_score,
            warnings = excluded.warnings,
            updated_at = now()
        """
        try:
            with psycopg.connect(self.settings.postgres_dsn, row_factory=dict_row) as conn:
                with conn.cursor() as cur:
                    cur.execute(ddl)
                    cur.execute(dml, run)
                conn.commit()
            return "postgres://pipeline_runs"
        except Exception:
            if self.settings.strict_external_services:
                raise
            raise


class WarehouseStore:
    def __init__(self, settings: Settings):
        self.settings = settings

    def insert_curated(self, rows: list[dict[str, Any]]) -> str:
        if not rows:
            return "clickhouse://curated_events?rows=0"

        columns = [
            "dw_id",
            "run_id",
            "source_system",
            "source_entity",
            "ingestion_mode",
            "loaded_at",
            "entity_name",
            "category",
            "metric_name",
            "metric_value",
            "status",
        ]
        data = [[self._normalize_value(column, row.get(column)) for column in columns] for row in rows]

        try:
            client = clickhouse_connect.get_client(
                host=self.settings.clickhouse_host,
                port=self.settings.clickhouse_port,
                username=self.settings.clickhouse_user,
                password=self.settings.clickhouse_password,
                database=self.settings.clickhouse_database,
            )
            client.command(
                """
                create table if not exists curated_events (
                    dw_id String,
                    run_id String,
                    source_system String,
                    source_entity String,
                    ingestion_mode String,
                    loaded_at DateTime64(3, 'UTC'),
                    entity_name Nullable(String),
                    category Nullable(String),
                    metric_name String,
                    metric_value Float64,
                    status String
                ) engine = MergeTree
                order by (source_entity, dw_id)
                """
            )
            client.insert("curated_events", data, column_names=columns)
            return f"clickhouse://curated_events?rows={len(rows)}"
        except Exception:
            if self.settings.strict_external_services:
                raise
            raise

    def fetch_curated(
        self,
        run_id: str,
        *,
        limit: int = 20,
        dw_id: str | None = None,
        version_id: str | None = None,
    ) -> dict[str, Any]:
        safe_limit = max(1, min(limit, 100))
        client = clickhouse_connect.get_client(
            host=self.settings.clickhouse_host,
            port=self.settings.clickhouse_port,
            username=self.settings.clickhouse_user,
            password=self.settings.clickhouse_password,
            database=self.settings.clickhouse_database,
        )
        filters = ["run_id = {run_id:String}"]
        parameters: dict[str, Any] = {"run_id": run_id}
        if dw_id:
            filters.append("dw_id = {dw_id:String}")
            parameters["dw_id"] = dw_id
        where_clause = " and ".join(filters)
        columns = [
            "dw_id",
            "run_id",
            "source_system",
            "source_entity",
            "ingestion_mode",
            "loaded_at",
            "entity_name",
            "category",
            "metric_name",
            "metric_value",
            "status",
        ]
        result = client.query(
            f"""
            select {", ".join(columns)}
            from curated_events
            where {where_clause}
            order by loaded_at desc, dw_id
            limit {safe_limit}
            """,
            parameters=parameters,
        )
        rows = [
            {
                column: value.isoformat() if isinstance(value, datetime) else value
                for column, value in zip(result.column_names, row, strict=False)
            }
            for row in result.result_rows
        ]
        summary = client.query(
            f"""
            select count() as records, coalesce(sum(metric_value), 0) as metric_sum
            from curated_events
            where {where_clause}
            """,
            parameters=parameters,
        )
        records_total, metric_sum = summary.result_rows[0] if summary.result_rows else (0, 0)
        return {
            "source": "ClickHouse DWH",
            "database": self.settings.clickhouse_database,
            "table": "curated_events",
            "run_id": run_id,
            "selected_version_id": version_id,
            "dw_id_filter": dw_id,
            "records_total": int(records_total),
            "metric_sum": float(metric_sum or 0),
            "limit": safe_limit,
            "columns": columns,
            "rows": rows,
        }

    @staticmethod
    def _normalize_value(column: str, value: Any) -> Any:
        if column == "loaded_at" and isinstance(value, str):
            return datetime.fromisoformat(value.replace("Z", "+00:00"))
        return value
