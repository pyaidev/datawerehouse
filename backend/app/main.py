from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from prometheus_client import Counter, Histogram, generate_latest, CONTENT_TYPE_LATEST
from starlette.responses import Response

from .config import get_settings
from .pipeline import PipelineRunner
from .schemas import PipelineRunRequest, PipelineRunResult
from .sources import SOURCES
from .test_api_data import local_null_products

settings = get_settings()
app = FastAPI(title=settings.app_name, version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

PIPELINE_RUNS = Counter("dwh_pipeline_runs_total", "Total DWH pipeline runs", ["source", "mode"])
PIPELINE_DURATION = Histogram("dwh_pipeline_duration_seconds", "DWH pipeline duration", ["source", "mode"])


@app.get("/health")
def health() -> dict:
    return {"status": "ok", "environment": settings.environment}


@app.get("/sources")
def sources() -> dict:
    return SOURCES


@app.get("/test-api/products-null")
def test_products_null(limit: int = 20, skip: int = 0) -> dict:
    return local_null_products(limit=limit, skip=skip)


@app.post("/pipeline/run", response_model=PipelineRunResult)
async def run_pipeline(request: PipelineRunRequest) -> PipelineRunResult:
    if request.source not in SOURCES:
        raise HTTPException(status_code=404, detail=f"Unknown source: {request.source}")

    runner = PipelineRunner(settings)
    with PIPELINE_DURATION.labels(request.source, request.mode).time():
        result = await runner.run(request)
    PIPELINE_RUNS.labels(request.source, request.mode).inc()
    return result


@app.get("/metrics")
def metrics() -> Response:
    return Response(generate_latest(), media_type=CONTENT_TYPE_LATEST)
