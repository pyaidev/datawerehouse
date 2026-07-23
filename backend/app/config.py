from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_name: str = "DWH API Gateway"
    environment: str = "local"
    strict_external_services: bool = False

    dummyjson_base_url: str = "https://dummyjson.com"
    estat_csv_path: str = "12-korxona.csv"

    minio_endpoint: str = "http://localhost:9000"
    minio_access_key: str = "minioadmin"
    minio_secret_key: str = "minioadmin"
    minio_region: str = "us-east-1"
    minio_landing_bucket: str = "landing-zone"
    minio_raw_bucket: str = "raw-zone"

    kafka_bootstrap_servers: str = "localhost:9092"
    kafka_topic_ingestion: str = "dwh.ingestion.events"

    postgres_dsn: str = "postgresql://dwh:dwh@localhost:5432/dwh"

    clickhouse_host: str = "localhost"
    clickhouse_port: int = 8123
    clickhouse_user: str = "default"
    clickhouse_password: str = ""
    clickhouse_database: str = "dwh"

    trino_url: str = "http://localhost:8089"
    trino_user: str = "dwh"
    trino_catalog: str = "clickhouse"
    trino_schema: str = "dwh"

    superset_url: str = "http://localhost:8087"
    superset_public_url: str = "http://localhost:8087"
    superset_username: str = "admin"
    superset_password: str = "admin"
    superset_database_name: str = "ClickHouse DWH"
    superset_clickhouse_uri: str = "clickhousedb://dwh:dwh@clickhouse:8123/dwh"
    superset_dataset_schema: str = "dwh"
    superset_dataset_table: str = "curated_events"

    local_artifact_dir: str = "data/artifacts"


@lru_cache
def get_settings() -> Settings:
    return Settings()
