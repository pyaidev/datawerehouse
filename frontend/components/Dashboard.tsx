"use client";

import { useEffect, useMemo, useState } from "react";
import type { HealthResponse, PipelineResult, QualityCheck, SourcesResponse, StageResult } from "../lib/types";

type Mode = "batch" | "stream" | "api";
type View = "raw" | "curated";

type StageMeta = {
  id: string;
  label: string;
  layer: string;
  detail: string;
  icon: IconName;
};

type StaticStageDetail = {
  input_ref?: string;
  output_ref?: string;
  input_preview?: unknown;
  output_preview?: unknown;
  metrics?: Record<string, unknown>;
  artifacts?: Record<string, unknown>;
};

type IconName =
  | "api"
  | "route"
  | "stream"
  | "shield"
  | "bucket"
  | "database"
  | "layers"
  | "warehouse"
  | "workflow"
  | "spark"
  | "code"
  | "chart"
  | "search"
  | "globe"
  | "download"
  | "play"
  | "refresh"
  | "check"
  | "clock"
  | "alert"
  | "server";

const stageCatalog: StageMeta[] = [
  { id: "fastapi", label: "FastAPI", layer: "Gateway", detail: "API orqali source data extract qiladi", icon: "api" },
  { id: "nifi", label: "NiFi", layer: "Flow", detail: "Routing va flow orchestration", icon: "route" },
  { id: "kafka", label: "Kafka", layer: "Stream", detail: "Ingestion event topicga yoziladi", icon: "stream" },
  { id: "landing", label: "MinIO Landing", layer: "Object", detail: "Original payload landing bucketga yoziladi", icon: "bucket" },
  { id: "raw", label: "MinIO Raw", layer: "Lake", detail: "Normalized raw rows saqlanadi", icon: "database" },
  { id: "gx", label: "Great Expectations", layer: "Quality", detail: "Record, schema va null check", icon: "shield" },
  { id: "spark", label: "PySpark", layer: "Compute", detail: "Curated transform job", icon: "spark" },
  { id: "curated", label: "Curated Zone", layer: "Model", detail: "Business schema saqlanadi", icon: "layers" },
  { id: "clickhouse", label: "ClickHouse", layer: "DWH", detail: "Analytic warehouse load", icon: "warehouse" },
  { id: "postgres", label: "PostgreSQL", layer: "ODS", detail: "Run audit va metadata", icon: "database" },
  { id: "airflow", label: "Airflow", layer: "Schedule", detail: "DAG orqali trigger qilish uchun", icon: "workflow" },
  { id: "dbt", label: "dbt", layer: "SQL", detail: "Staging va mart model", icon: "code" },
  { id: "superset", label: "Superset", layer: "BI", detail: "Dashboard dataset", icon: "chart" },
  { id: "trino", label: "Trino", layer: "Query", detail: "Ad-hoc SQL gateway", icon: "search" },
  { id: "api", label: "API Services", layer: "Serve", detail: "External API output", icon: "api" },
  { id: "portal", label: "Portal", layer: "UI", detail: "Visualization frontend", icon: "globe" },
  { id: "export", label: "Export", layer: "File", detail: "JSON/CSV/PDF export", icon: "download" },
];

const processMap: Record<string, string[]> = {
  fastapi: ["Request body validate", "DummyJSON endpoint call", "Payload normalize"],
  nifi: ["FlowFile create", "Route source", "Attach metadata"],
  kafka: ["Build event", "Serialize JSON", "Publish to dwh.ingestion.events"],
  landing: ["Build object key", "Write landing JSON", "Return S3 reference"],
  raw: ["Normalize collection", "Write raw rows", "Catalog raw object"],
  gx: ["Record count", "Primary key", "Schema and null threshold"],
  spark: ["Read raw", "Transform dataframe", "Write curated model"],
  curated: ["Business mapping", "Conformed columns", "Write curated JSON"],
  clickhouse: ["Create table", "Insert curated batch", "Expose metrics"],
  postgres: ["Create audit table", "Upsert run", "Store warnings"],
  airflow: ["DAG trigger", "Quality gate", "Lineage print"],
  dbt: ["Build staging", "Build mart", "Run tests"],
  superset: ["Register dataset", "Refresh chart", "Apply access"],
  trino: ["Catalog route", "Plan query", "Stream result"],
  api: ["Map response", "Return JSON", "Audit request"],
  portal: ["Load view model", "Render table", "Render operations"],
  export: ["Select format", "Build file", "Publish download"],
};

const staticStageDetails: Record<string, StaticStageDetail> = {
  fastapi: {
    input_ref: "POST http://localhost:8000/pipeline/run",
    output_ref: "backend/app/pipeline.py -> extract()",
    input_preview: { body: { source: "products/users/carts/posts/todos/quotes", limit: "1..100", mode: "batch/stream/api" } },
    artifacts: { api_route: "backend/app/main.py", schema: "backend/app/schemas.py" },
  },
  nifi: {
    input_ref: "NiFi flow template",
    output_ref: "http://localhost:8080/nifi",
    input_preview: { source: "FlowFile metadata", run_id: "pipeline run id", bucket: "landing-zone" },
    output_preview: { note: "Manual API run ichida NiFi trigger qilinmagan; flow yaratish kodi alohida bor." },
    artifacts: { flow_script: "nifi/create_dummyjson_flow.py", service_url: "http://localhost:8080" },
  },
  kafka: { artifacts: { topic: "dwh.ingestion.events", code: "backend/app/kafka_bus.py" } },
  landing: { artifacts: { storage: "MinIO", console: "http://localhost:9001", bucket: "landing-zone" } },
  raw: { artifacts: { storage: "MinIO", console: "http://localhost:9001", bucket: "raw-zone" } },
  gx: { artifacts: { validator: "backend/app/quality.py", checks: ["record_count", "primary_key", "schema_not_empty", "null_threshold"] } },
  spark: { artifacts: { pyspark_job: "spark/jobs/dummyjson_curate.py", runtime_transform: "backend/app/transform.py" } },
  curated: { artifacts: { storage: "MinIO raw-zone/curated", format: "json/parquet-compatible schema" } },
  clickhouse: { artifacts: { database: "dwh", table: "curated_events", code: "backend/app/databases.py" } },
  postgres: { artifacts: { database: "dwh", table: "pipeline_runs", code: "backend/app/databases.py" } },
  airflow: {
    input_ref: "http://localhost:8088",
    output_ref: "airflow/dags/dwh_dummyjson_pipeline.py",
    input_preview: { dag_id: "dwh_dummyjson_pipeline", trigger: "scheduled/manual Airflow" },
    output_preview: { note: "Bu UI tugmasi FastAPI run qiladi; Airflow DAG kodi tayyor, lekin shu manual run ichida trigger qilinmagan." },
    artifacts: { dag: "airflow/dags/dwh_dummyjson_pipeline.py", service_url: "http://localhost:8088" },
  },
  dbt: {
    input_ref: "dbt/dwh_project/models/staging",
    output_ref: "dbt/dwh_project/models/marts",
    input_preview: { source_relation: "curated_events", transform: "SQL model" },
    output_preview: { note: "dbt project bor; bu manual API run ichida dbt CLI ishga tushirilmagan." },
    artifacts: { project: "dbt/dwh_project", models: "dbt/dwh_project/models" },
  },
  superset: {
    input_ref: "ClickHouse curated_events",
    output_ref: "BI dashboard dataset",
    output_preview: { note: "Superset bu frontend tugmasida trigger qilinmaydi; ClickHouse data dashboard uchun tayyorlanadi." },
    artifacts: { service: "Apache Superset", expected_dataset: "curated_events" },
  },
  trino: {
    input_ref: "Object storage / warehouse catalogs",
    output_ref: "distributed SQL result set",
    output_preview: { note: "Trino query engine sifatida ko'rsatilgan; compose ichida alohida Trino service hali ulanmagan." },
    artifacts: { role: "ad-hoc SQL gateway" },
  },
  api: {
    input_ref: "backend/app/main.py",
    output_ref: "http://localhost:8000/docs",
    input_preview: { routes: ["GET /health", "GET /sources", "POST /pipeline/run"] },
    output_preview: { note: "External systems shu API orqali data oladi." },
    artifacts: { openapi: "http://localhost:8000/docs" },
  },
  portal: {
    input_ref: "Next.js API proxy",
    output_ref: "current Next.js origin",
    input_preview: { proxy_routes: ["/api/backend/health", "/api/backend/sources", "/api/backend/pipeline/run"] },
    output_preview: { note: "Hozirgi ekran shu portalning real Next.js frontend qismi." },
    artifacts: { component: "frontend/components/Dashboard.tsx" },
  },
  export: {
    input_ref: "result.raw_preview / result.curated_preview",
    output_ref: "JSON preview table",
    output_preview: { note: "CSV/PDF export endpoint hali alohida yozilmagan; API response JSON ko'rinishida real qaytyapti." },
    artifacts: { current_format: "JSON", next_endpoint: "POST /exports" },
  },
};

export function Dashboard() {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [sources, setSources] = useState<SourcesResponse>({});
  const [source, setSource] = useState("products");
  const [mode, setMode] = useState<Mode>("api");
  const [limit, setLimit] = useState(20);
  const [view, setView] = useState<View>("curated");
  const [result, setResult] = useState<PipelineResult | null>(null);
  const [running, setRunning] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [activeStage, setActiveStage] = useState<StageMeta | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [frontendHost, setFrontendHost] = useState("loading");

  useEffect(() => {
    setFrontendHost(window.location.host);
    void loadInitial();
  }, []);

  const stageResults = useMemo(() => {
    const map = new Map<string, StageResult>();
    result?.stages.forEach((stage) => map.set(stage.id, stage));
    return map;
  }, [result]);

  const rows = view === "raw" ? result?.raw_preview || [] : result?.curated_preview || [];
  const columns = getColumns(rows, view);
  const qualityChecks = result?.quality_checks || [];
  const activeStageResult = activeStage ? stageResults.get(activeStage.id) : undefined;
  const activeStaticDetail = activeStage ? staticStageDetails[activeStage.id] : undefined;

  async function loadInitial() {
    try {
      const [healthRes, sourcesRes] = await Promise.all([
        fetchJson<HealthResponse>("/api/backend/health"),
        fetchJson<SourcesResponse>("/api/backend/sources"),
      ]);
      setHealth(healthRes);
      setSources(sourcesRes);
      addLog(`Backend status: ${healthRes.status} (${healthRes.environment})`);
    } catch (err) {
      setError(formatError(err));
    }
  }

  async function runPipeline() {
    setRunning(true);
    setError(null);
    setResult(null);
    setLogs([]);
    addLog(`POST /api/backend/pipeline/run source=${source} limit=${limit} mode=${mode}`);

    try {
      const nextResult = await fetchJson<PipelineResult>("/api/backend/pipeline/run", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ source, limit, mode }),
      });
      setResult(nextResult);
      addLog(`run_id=${nextResult.run_id}`);
      nextResult.stages.forEach((stage) => addLog(`${stage.id}: ${stage.status} ${stage.duration_ms}ms ${shorten(stage.message)}`));
      if (nextResult.warnings.length) nextResult.warnings.forEach((warning) => addLog(`warning: ${warning}`));
    } catch (err) {
      setError(formatError(err));
      addLog(`error: ${formatError(err)}`);
    } finally {
      setRunning(false);
    }
  }

  return (
    <main className="shell">
      <header className="topbar">
        <div className="brand">
          <div className="brandIcon"><Icon name="warehouse" /></div>
          <div>
            <p>Next.js Frontend</p>
            <h1>Data Warehouse API Console</h1>
          </div>
        </div>
        <div className="statusLine">
          <StatusPill label="FastAPI" value={health?.status || "checking"} ok={health?.status === "ok"} />
          <StatusPill label="API" value="localhost:8000" ok />
          <StatusPill label="Next" value={frontendHost} ok />
        </div>
      </header>

      <section className="controlPanel">
        <label>
          <span>Source</span>
          <select value={source} onChange={(event) => setSource(event.target.value)} disabled={running}>
            {Object.entries(sources).map(([key, item]) => (
              <option key={key} value={key}>{item.title} / {item.collection}</option>
            ))}
          </select>
        </label>
        <label>
          <span>Limit</span>
          <input type="number" min={1} max={100} value={limit} onChange={(event) => setLimit(Number(event.target.value))} disabled={running} />
        </label>
        <div className="segmented">
          {(["batch", "stream", "api"] as Mode[]).map((item) => (
            <button key={item} className={mode === item ? "active" : ""} onClick={() => setMode(item)} disabled={running}>
              <Icon name={item === "batch" ? "clock" : item === "stream" ? "stream" : "api"} />
              <span>{item}</span>
            </button>
          ))}
        </div>
        <button className="runButton" onClick={runPipeline} disabled={running || !Object.keys(sources).length}>
          <Icon name={running ? "refresh" : "play"} />
          <span>{running ? "Running" : "Run Pipeline"}</span>
        </button>
      </section>

      {error && <div className="errorBox"><Icon name="alert" /> {error}</div>}

      <section className="metrics">
        <Metric label="Run ID" value={result?.run_id ? result.run_id.slice(0, 8) : "-"} />
        <Metric label="Records" value={String(result?.records ?? 0)} />
        <Metric label="Quality" value={`${result?.quality_score ?? 0}%`} />
        <Metric label="Fields" value={String(result?.curated_fields ?? 0)} />
      </section>

      <section className="mainGrid">
        <article className="panel pipelinePanel">
          <div className="panelHead">
            <div>
              <p>Pipeline</p>
              <h2>Real API flow</h2>
            </div>
            <button className="smallButton" onClick={loadInitial}><Icon name="refresh" /> Refresh</button>
          </div>
          <div className="stageGrid">
            {stageCatalog.map((stage) => {
              const stageResult = stageResults.get(stage.id);
              const status = stageResult?.status || "idle";
              return (
                <button key={stage.id} className={`stageCard ${status}`} onClick={() => setActiveStage(stage)}>
                  <span className="stageIcon"><Icon name={stage.icon} /></span>
                  <span>
                    <strong>{stage.label}</strong>
                    <small>{stage.layer}</small>
                  </span>
                  <em>{status}</em>
                </button>
              );
            })}
          </div>
        </article>

        <aside className="panel sidePanel">
          <div className="panelHead compact">
            <div>
              <p>Quality</p>
              <h2>Checks</h2>
            </div>
          </div>
          <div className="qualityList">
            {(qualityChecks.length ? qualityChecks : [{ name: "waiting", passed: false, value: "idle" } as QualityCheck]).map((check) => (
              <div key={check.name} className={`qualityItem ${check.passed ? "ok" : "warn"}`}>
                <Icon name={check.passed ? "check" : "clock"} />
                <span>{check.name}</span>
                <strong>{check.value}</strong>
              </div>
            ))}
          </div>

          <div className="panelHead compact borderTop">
            <div>
              <p>API routes</p>
              <h2>Next proxy</h2>
            </div>
          </div>
          <div className="apiList">
            <code>GET /api/backend/health</code>
            <code>GET /api/backend/sources</code>
            <code>POST /api/backend/pipeline/run</code>
          </div>
        </aside>
      </section>

      <section className="dataGrid">
        <article className="panel tablePanel">
          <div className="panelHead">
            <div>
              <p>Preview</p>
              <h2>{view === "raw" ? "Raw data" : "Curated data"}</h2>
            </div>
            <div className="tabs">
              <button className={view === "raw" ? "active" : ""} onClick={() => setView("raw")}><Icon name="database" /> Raw</button>
              <button className={view === "curated" ? "active" : ""} onClick={() => setView("curated")}><Icon name="layers" /> Curated</button>
            </div>
          </div>
          <div className="tableWrap">
            <table>
              <thead>
                <tr>{columns.map((column) => <th key={column}>{column}</th>)}</tr>
              </thead>
              <tbody>
                {rows.length ? rows.map((row, index) => (
                  <tr key={index}>{columns.map((column) => <td key={column}>{formatCell(row[column])}</td>)}</tr>
                )) : <tr><td colSpan={Math.max(columns.length, 1)} className="empty">Pipeline hali ishga tushmagan</td></tr>}
              </tbody>
            </table>
          </div>
        </article>

        <article className="panel logPanel">
          <div className="panelHead compact">
            <div>
              <p>Logs</p>
              <h2>Run output</h2>
            </div>
          </div>
          <pre>{logs.join("\n") || "Logs waiting..."}</pre>
        </article>
      </section>

      {activeStage && (
        <div className="modalBackdrop" onClick={() => setActiveStage(null)}>
          <section className="modal wide" onClick={(event) => event.stopPropagation()}>
            <div className="modalHead">
              <span className="modalIcon"><Icon name={activeStage.icon} /></span>
              <div>
                <p>{activeStage.layer}</p>
                <h2>{activeStage.label}</h2>
              </div>
              <button onClick={() => setActiveStage(null)}>Close</button>
            </div>
            <p className="modalDetail">{activeStage.detail}</p>
            <StageRunState result={activeStageResult} />
            <StageInspector stage={activeStage} result={activeStageResult} fallback={activeStaticDetail} />
          </section>
        </div>
      )}
    </main>
  );

  function addLog(message: string) {
    const stamp = new Date().toLocaleTimeString("uz-UZ", { hour12: false });
    setLogs((current) => [...current, `[${stamp}] ${message}`]);
  }
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`${response.status}: ${text}`);
  }
  return response.json() as Promise<T>;
}

function StageRunState({ result }: { result?: StageResult }) {
  if (!result) {
    return (
      <div className="runState idle">
        <Icon name="clock" />
        <span>Bu stage shu manual API run ichida bajarilmadi. Quyida uning kod/servis joyi va kutiladigan input-output ko'rsatilgan.</span>
      </div>
    );
  }

  return (
    <div className={`runState ${result.status}`}>
      <Icon name={result.status === "done" ? "check" : result.status === "warning" ? "alert" : "alert"} />
      <span>{result.status.toUpperCase()} · {result.duration_ms}ms · {result.message}</span>
    </div>
  );
}

function StageInspector({ stage, result, fallback }: { stage: StageMeta; result?: StageResult; fallback?: StaticStageDetail }) {
  const metrics = { ...(fallback?.metrics ?? {}), ...(result?.metrics ?? {}) };
  const artifacts = { ...(fallback?.artifacts ?? {}), ...(result?.artifacts ?? {}) };
  const inputRef = result?.input_ref ?? fallback?.input_ref;
  const outputRef = result?.output_ref ?? fallback?.output_ref;
  const inputPreview = result?.input_preview ?? fallback?.input_preview;
  const outputPreview = result?.output_preview ?? fallback?.output_preview;

  return (
    <div className="inspector">
      <div className="deepGrid">
        <DetailCard title="Oldin / Input" icon="database" refValue={inputRef} data={inputPreview} />
        <article className="detailCard">
          <div className="detailTitle"><Icon name="workflow" /><strong>Process</strong></div>
          <div className="processList compactList">
            {(processMap[stage.id] || []).map((process, index) => (
              <div key={process} className="processItem">
                <span>{index + 1}</span>
                <strong>{process}</strong>
                <em>{result?.status || "code"}</em>
              </div>
            ))}
          </div>
        </article>
        <DetailCard title="Keyin / Output" icon="layers" refValue={outputRef} data={outputPreview} />
        <DetailCard title="Metrics" icon="chart" data={metrics} />
        <DetailCard title="Artifacts / Code" icon="code" data={artifacts} wide />
        <DetailCard title="Raw stage JSON" icon="server" data={result ?? fallback ?? { status: "idle" }} wide />
      </div>
    </div>
  );
}

function DetailCard({ title, icon, refValue, data, wide = false }: { title: string; icon: IconName; refValue?: string | null; data?: unknown; wide?: boolean }) {
  return (
    <article className={`detailCard ${wide ? "wide" : ""}`}>
      <div className="detailTitle"><Icon name={icon} /><strong>{title}</strong></div>
      {refValue && <code className="refLine">{refValue}</code>}
      <JsonBlock value={data} />
    </article>
  );
}

function JsonBlock({ value }: { value: unknown }) {
  return <pre className="jsonBlock">{hasData(value) ? formatJson(value) : "No data for this stage yet"}</pre>;
}

function getColumns(rows: Record<string, unknown>[], view: View): string[] {
  if (!rows.length) return view === "curated" ? ["dw_id", "entity_name", "metric_value", "status"] : ["id", "title", "category"];
  const preferred = view === "curated"
    ? ["dw_id", "source_system", "entity_name", "category", "metric_name", "metric_value", "status", "loaded_at"]
    : ["id", "title", "firstName", "lastName", "category", "price", "total", "userId"];
  const discovered = new Set<string>();
  rows.slice(0, 5).forEach((row) => Object.keys(row).forEach((key) => discovered.add(key)));
  return [...preferred.filter((key) => discovered.has(key)), ...[...discovered].filter((key) => !preferred.includes(key))].slice(0, 8);
}

function formatCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function shorten(value: string): string {
  return value.length > 120 ? `${value.slice(0, 120)}...` : value;
}

function formatError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function formatJson(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

function hasData(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "object") return Object.keys(value as Record<string, unknown>).length > 0;
  return true;
}

function Metric({ label, value }: { label: string; value: string }) {
  return <article className="metric"><span>{label}</span><strong>{value}</strong></article>;
}

function StatusPill({ label, value, ok }: { label: string; value: string; ok: boolean }) {
  return <div className={`statusPill ${ok ? "ok" : "warn"}`}><span>{label}</span><strong>{value}</strong></div>;
}

function Icon({ name }: { name: IconName }) {
  const path = iconPaths[name] || iconPaths.server;
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {path}
    </svg>
  );
}

const iconPaths: Record<IconName, React.ReactNode> = {
  api: <><path d="M8 7h8M8 12h8M8 17h5" /><rect x="4" y="4" width="16" height="16" rx="3" /></>,
  route: <><path d="M5 5h5a4 4 0 0 1 0 8H9a4 4 0 0 0 0 8h10" /><path d="M5 5l3-3M5 5l3 3M19 21l-3-3M19 21l-3 3" /></>,
  stream: <><path d="M4 12h4l3-6 4 12 3-6h2" /><circle cx="4" cy="12" r="2" /><circle cx="20" cy="12" r="2" /></>,
  shield: <><path d="M12 3l7 3v5c0 5-3.5 8.5-7 10-3.5-1.5-7-5-7-10V6z" /><path d="M9 12l2 2 4-5" /></>,
  bucket: <><path d="M6 8h12l-1 12H7z" /><path d="M7 8c0-2 2-4 5-4s5 2 5 4" /></>,
  database: <><ellipse cx="12" cy="5" rx="7" ry="3" /><path d="M5 5v12c0 1.7 3.1 3 7 3s7-1.3 7-3V5" /><path d="M5 11c0 1.7 3.1 3 7 3s7-1.3 7-3" /></>,
  layers: <><path d="M12 3l9 5-9 5-9-5z" /><path d="M3 12l9 5 9-5" /><path d="M3 16l9 5 9-5" /></>,
  warehouse: <><path d="M3 10l9-6 9 6v10H3z" /><path d="M7 20v-7h10v7M7 16h10M11 13v7" /></>,
  workflow: <><rect x="4" y="4" width="6" height="6" rx="1" /><rect x="14" y="4" width="6" height="6" rx="1" /><rect x="9" y="14" width="6" height="6" rx="1" /><path d="M10 7h4M17 10v2l-5 2-5-2v-2" /></>,
  spark: <path d="M12 2l2.2 7.2L21 12l-6.8 2.8L12 22l-2.2-7.2L3 12l6.8-2.8z" />,
  code: <><path d="M8 9l-4 3 4 3M16 9l4 3-4 3M14 5l-4 14" /></>,
  chart: <><path d="M4 19h16" /><path d="M7 16V9" /><path d="M12 16V5" /><path d="M17 16v-4" /></>,
  search: <><circle cx="10" cy="10" r="6" /><path d="M15 15l5 5" /></>,
  globe: <><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" /></>,
  download: <><path d="M12 3v12M7 10l5 5 5-5" /><path d="M5 21h14" /></>,
  play: <path d="M8 5v14l11-7z" />,
  refresh: <><path d="M20 12a8 8 0 0 1-14 5" /><path d="M4 12a8 8 0 0 1 14-5" /><path d="M18 3v4h-4M6 21v-4h4" /></>,
  check: <path d="M20 6L9 17l-5-5" />,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  alert: <><path d="M12 9v4M12 17h0" /><path d="M10.3 3.9 2.6 18a2 2 0 0 0 1.7 3h15.4a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" /></>,
  server: <><rect x="4" y="4" width="16" height="6" rx="2" /><rect x="4" y="14" width="16" height="6" rx="2" /><path d="M8 7h0M8 17h0" /></>,
};