from typing import Any, Literal
from pydantic import BaseModel, Field


class PipelineRunRequest(BaseModel):
    source: str = Field(default="products", description="DummyJSON source id")
    limit: int = Field(default=20, ge=1, le=100)
    mode: Literal["batch", "stream", "api"] = "batch"


class QualityCheck(BaseModel):
    name: str
    passed: bool
    value: str


class StageResult(BaseModel):
    id: str
    name: str
    status: Literal["done", "warning", "error"]
    duration_ms: int
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
    records: int
    quality_score: int
    curated_fields: int
    stages: list[StageResult]
    quality_checks: list[QualityCheck]
    warnings: list[str]
    raw_preview: list[dict[str, Any]]
    curated_preview: list[dict[str, Any]]
