import json
from pathlib import Path
from typing import Any

import boto3
from botocore.exceptions import BotoCoreError, ClientError

from .config import Settings


class ObjectStore:
    def __init__(self, settings: Settings):
        self.settings = settings
        self.client = boto3.client(
            "s3",
            endpoint_url=settings.minio_endpoint,
            aws_access_key_id=settings.minio_access_key,
            aws_secret_access_key=settings.minio_secret_key,
            region_name=settings.minio_region,
        )

    def put_json(self, bucket: str, key: str, payload: Any) -> str:
        try:
            self._ensure_bucket(bucket)
            body = json.dumps(payload, ensure_ascii=False, default=str).encode("utf-8")
            self.client.put_object(Bucket=bucket, Key=key, Body=body, ContentType="application/json")
            return f"s3://{bucket}/{key}"
        except (BotoCoreError, ClientError) as exc:
            if self.settings.strict_external_services:
                raise
            return self._write_local(bucket, key, payload, exc)
        

    def _ensure_bucket(self, bucket: str) -> None:
        try:
            self.client.head_bucket(Bucket=bucket)
        except ClientError:
            self.client.create_bucket(Bucket=bucket)

    def _write_local(self, bucket: str, key: str, payload: Any, exc: Exception) -> str:
        target = Path(self.settings.local_artifact_dir) / bucket / key
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(json.dumps(payload, ensure_ascii=False, indent=2, default=str), encoding="utf-8")
        return f"local://{target.as_posix()}?fallback={type(exc).__name__}"
