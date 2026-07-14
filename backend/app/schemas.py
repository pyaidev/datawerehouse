from typing import Any, Literal
from pydantic import BaseModel, Field


class ManualCorrection(BaseModel):
    record_id: str
    column: str = Field(min_length=1)
    value: Any = None


class PipelineRunRequest(BaseModel):
    source: str = Field(default="products", description="DummyJSON source id")
    limit: int = Field(default=20, ge=1, le=100)
    mode: Literal["batch", "stream", "api"] = "batch"
    failure_stage: Literal["none", "kafka", "gx", "clickhouse"] = "none"
    corrections: list[ManualCorrection] = Field(default_factory=list)


class QualityCheck(BaseModel):
    name: str
    passed: bool
    value: str


class StageResult(BaseModel):
    id: str
    name: str
    status: Literal["done", "warning", "error"]
    sequence: int
    started_at: str
    ended_at: str
    duration_ms: int
    data_size_bytes: int = 0
    data_format: str = "JSON"
    message: str
    warnings: list[str] = Field(default_factory=list)
    input_ref: str | None = None
    output_ref: str | None = None
    input_preview: Any = None
    output_preview: Any = None
    metrics: dict[str, Any] = Field(default_factory=dict)
    artifacts: dict[str, Any] = Field(default_factory=dict)


class PipelineRunResult(BaseModel):
    run_id: str
    source: str
    mode: str
    status: Literal["done", "warning", "error"]
    started_at: str
    finished_at: str
    duration_ms: int
    failed_stage: str | None = None
    records: int
    quality_score: int
    curated_fields: int
    stages: list[StageResult]
    quality_checks: list[QualityCheck]
    warnings: list[str]
    raw_preview: list[dict[str, Any]]
    prepared_preview: list[dict[str, Any]]
    curated_preview: list[dict[str, Any]]
    lineage: list[dict[str, Any]]
