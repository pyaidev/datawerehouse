from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_name: str = "DWH API Gateway"
    environment: str = "local"
    strict_external_services: bool = False

    dummyjson_base_url: str = "https://dummyjson.com"

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

    local_artifact_dir: str = "data/artifacts"


@lru_cache
def get_settings() -> Settings:
    return Settings()
