from __future__ import annotations

import os
from datetime import datetime, timedelta

import requests
from airflow.decorators import dag, task
from airflow.exceptions import AirflowFailException

FASTAPI_URL = os.getenv("DWH_API_URL", "http://fastapi:8000")


@dag(
    dag_id="dwh_dummyjson_pipeline",
    description="DummyJSON -> Kafka/MinIO/GX/ClickHouse/PostgreSQL warehouse pipeline",
    schedule="@hourly",
    start_date=datetime(2026, 1, 1),
    catchup=False,
    default_args={"retries": 2, "retry_delay": timedelta(minutes=2)},
    tags=["dwh", "dummyjson", "uzstat"],
)
def dwh_dummyjson_pipeline():
    @task
    def run_gateway(source: str = "products", limit: int = 20, mode: str = "batch") -> dict:
        response = requests.post(
            f"{FASTAPI_URL}/pipeline/run",
            json={"source": source, "limit": limit, "mode": mode},
            timeout=120,
        )
        response.raise_for_status()
        return response.json()

    @task
    def assert_quality(result: dict, minimum_score: int = 100) -> dict:
        score = int(result.get("quality_score", 0))
        if score < minimum_score:
            raise AirflowFailException(f"Quality score {score} < {minimum_score}: {result.get('quality_checks')}")
        return result

    @task
    def print_lineage(result: dict) -> None:
        stages = " -> ".join(stage["id"] for stage in result.get("stages", []))
        print(f"run_id={result['run_id']} source={result['source']} records={result['records']} lineage={stages}")

    pipeline_result = run_gateway()
    checked = assert_quality(pipeline_result)
    print_lineage(checked)


dwh_dummyjson_pipeline()
