"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { HealthResponse, LineageRecord, ManualCorrection, PipelineResult, QualityCheck, SourcesResponse, StageResult } from "../lib/types";
import { stageCodeSamples } from "../lib/stage-code";

import type { CSSProperties } from "react";

type Mode = "batch" | "stream" | "api";
type View = "raw" | "prepared" | "curated";
type FailureStage = "none" | "kafka" | "gx" | "clickhouse";

type StageMeta = {
  id: string;
  label: string;
  layer: string;
  detail: string;
  icon: IconName;
  color: string;
};

type ScenarioNode = {
  id: string;
  x: number;
  y: number;
};

type ScenarioEdge = {
  from: string;
  to: string;
  kind?: "main" | "branch" | "control";
};

type StaticStageDetail = {
  input_ref?: string;
  output_ref?: string;
  input_preview?: unknown;
  output_preview?: unknown;
  metrics?: Record<string, unknown>;
  artifacts?: Record<string, unknown>;
};

type StageDescription = {
  does: string;
  flow: string;
  result: string;
  note?: string;
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
  | "server"
  | "close";

const stageCatalog: StageMeta[] = [
  { id: "fastapi", label: "FastAPI", layer: "Gateway", detail: "API orqali source data extract qiladi", icon: "api", color: "#159570" },
  { id: "nifi", label: "Apache NiFi", layer: "Flow", detail: "Routing va flow orchestration", icon: "route", color: "#64748b" },
  { id: "kafka", label: "Apache Kafka", layer: "Stream", detail: "Ingestion event topicga yoziladi", icon: "stream", color: "#252b36" },
  { id: "landing", label: "MinIO Landing / Raw", layer: "Lake", detail: "Original payload va raw rows MinIO ga yoziladi", icon: "bucket", color: "#2e8b57" },
  { id: "preparation", label: "Data Preparation", layer: "Prepare", detail: "Profiling va version draft yaratish", icon: "workflow", color: "#0e7490" },
  { id: "imputation", label: "Imputatsiya / Edit", layer: "Prepare", detail: "Bo'sh qiymatlarni to'ldirish va operator edit", icon: "code", color: "#b45309" },
  { id: "gx", label: "Great Expectations", layer: "Quality", detail: "Record, schema va null check", icon: "shield", color: "#16a34a" },
  { id: "spark", label: "PySpark", layer: "Compute", detail: "Curated transform job", icon: "spark", color: "#f97316" },
  { id: "curated", label: "Curated Zone", layer: "Model", detail: "Business schema saqlanadi", icon: "layers", color: "#7c3aed" },
  { id: "clickhouse", label: "ClickHouse", layer: "DWH", detail: "Analytic warehouse load", icon: "warehouse", color: "#d99b00" },
  { id: "postgres", label: "PostgreSQL", layer: "ODS", detail: "Run audit va metadata", icon: "database", color: "#336791" },
  { id: "airflow", label: "Apache Airflow", layer: "Schedule", detail: "DAG orqali trigger qilish uchun", icon: "workflow", color: "#16a3b6" },
  { id: "dbt", label: "dbt", layer: "SQL", detail: "Staging va mart model", icon: "code", color: "#e85d43" },
  { id: "superset", label: "Superset", layer: "BI", detail: "Dashboard dataset", icon: "chart", color: "#168f96" },
  { id: "trino", label: "Trino", layer: "Query", detail: "Ad-hoc SQL gateway", icon: "search", color: "#d94f8a" },
  { id: "api", label: "API Services", layer: "Serve", detail: "External API output", icon: "api", color: "#0f9f6e" },
  { id: "portal", label: "Portal", layer: "UI", detail: "Visualization frontend", icon: "globe", color: "#2563eb" },
  { id: "export", label: "Export", layer: "File", detail: "JSON/CSV/PDF export", icon: "download", color: "#6366f1" },
];

const SCENARIO_WIDTH = 1420;
const SCENARIO_HEIGHT = 700;

const scenarioNodes: ScenarioNode[] = [
  { id: "fastapi", x: 85, y: 240 },
  { id: "nifi", x: 220, y: 240 },
  { id: "kafka", x: 355, y: 240 },
  { id: "landing", x: 490, y: 240 },
  { id: "preparation", x: 625, y: 240 },
  { id: "imputation", x: 760, y: 240 },
  { id: "gx", x: 895, y: 240 },
  { id: "spark", x: 1030, y: 240 },
  { id: "curated", x: 1165, y: 240 },
  { id: "dbt", x: 1300, y: 450 },
  { id: "clickhouse", x: 1150, y: 450 },
  { id: "superset", x: 970, y: 375 },
  { id: "trino", x: 970, y: 535 },
  { id: "api", x: 640, y: 455 },
  { id: "portal", x: 440, y: 370 },
  { id: "export", x: 440, y: 540 },
  { id: "postgres", x: 1300, y: 610 },
  { id: "airflow", x: 1030, y: 70 },
];

const scenarioEdges: ScenarioEdge[] = [
  { from: "fastapi", to: "nifi" },
  { from: "nifi", to: "kafka" },
  { from: "kafka", to: "landing" },
  { from: "landing", to: "preparation" },
  { from: "preparation", to: "imputation" },
  { from: "imputation", to: "gx" },
  { from: "gx", to: "spark" },
  { from: "spark", to: "curated" },
  { from: "curated", to: "dbt" },
  { from: "dbt", to: "clickhouse" },
  { from: "clickhouse", to: "superset", kind: "branch" },
  { from: "clickhouse", to: "trino", kind: "branch" },
  { from: "clickhouse", to: "api", kind: "branch" },
  { from: "api", to: "portal", kind: "branch" },
  { from: "api", to: "export", kind: "branch" },
  { from: "clickhouse", to: "postgres", kind: "branch" },
  { from: "airflow", to: "spark", kind: "control" },
];

const processImages: Record<string, string> = {
  fastapi: "/process-images/fastapi.svg",
  nifi: "/process-images/nifi.svg",
  kafka: "/process-images/kafka.svg",
  landing: "/process-images/landing.svg",
  raw: "/process-images/raw.svg",
  preparation: "/process-images/preparation.svg",
  imputation: "/process-images/imputation.svg",
  gx: "/process-images/gx.svg",
  spark: "/process-images/spark.svg",
  curated: "/process-images/curated.svg",
  dbt: "/process-images/dbt.svg",
  clickhouse: "/process-images/clickhouse.svg",
  postgres: "/process-images/postgres.svg",
  airflow: "/process-images/airflow.svg",
  superset: "/process-images/superset.svg",
  trino: "/process-images/trino.svg",
  api: "/process-images/api.svg",
  portal: "/process-images/portal.svg",
  export: "/process-images/export.svg",
};
const processMap: Record<string, string[]> = {
  fastapi: ["Request body validate", "DummyJSON endpoint call", "Payload normalize"],
  nifi: ["FlowFile create", "Route source", "Attach metadata"],
  kafka: ["Build event", "Serialize JSON", "Publish to dwh.ingestion.events"],
  landing: ["Write original landing JSON", "Normalize collection rows", "Write raw.json", "Return MinIO paths"],
  preparation: ["RAW_RECEIVED: raw object o'qildi", "PROFILED: column/type profile olindi", "NORMALIZED: trim va null normalize", "VERSION_DRAFT: prepared draft ochildi"],
  imputation: ["NULL_SCAN: bo'sh fieldlarni topish", "IMPUTATION_EDIT: qiymat to'ldirish", "MANUAL_EDIT: operator tuzatishi", "RECORD_VERSION_ID: har record versioni", "READY_FOR_QUALITY: validationga yuborish"],
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


const stageDescriptions: Record<string, StageDescription> = {
  fastapi: {
    does: "Frontenddan kelgan pipeline requestni qabul qiladi, source va limitni tekshiradi, tashqi test API dan real JSON payload oladi.",
    flow: "Request Next proxy orqali FastAPI backendga o'tadi, keyin DummyJSON endpointdan data olinadi va raw rows uchun normalize qilinadi.",
    result: "Pipeline run_id yaratiladi, external payload preview chiqadi va keyingi Kafka/MinIO bosqichlari uchun data tayyor bo'ladi.",
  },
  nifi: {
    does: "Production dataflow uchun routing, FlowFile metadata va visual flow boshqaruvini ifodalaydi.",
    flow: "Source payload FlowFile sifatida keladi, route qilinadi va keyingi ingestion/storage qatlamiga uzatiladi.",
    result: "NiFi flow kodi mavjud, lekin hozirgi manual Run Pipeline tugmasi NiFi processini trigger qilmaydi.",
    note: "Bu stage arxitektura qismi sifatida ko'rsatilgan; real trigger alohida NiFi integration bilan ulanadi.",
  },
  kafka: {
    does: "Pipeline run haqida ingestion event yaratadi va Kafka topicga publish qiladi.",
    flow: "FastAPI metadata event tuzadi, JSON serialize qiladi va dwh.ingestion.events topicga yozadi.",
    result: "Kafka topic, partition va offset qaytadi; monitoring yoki downstream consumer shu eventdan foydalanishi mumkin.",
  },
  landing: {
    does: "MinIO ichida original payload va raw rowlarni bitta data lake bosqichi sifatida saqlaydi.",
    flow: "Avval original API payload landing.json sifatida yoziladi, keyin collection rows ajratilib raw.json sifatida saqlanadi.",
    result: "Audit uchun landing nusxa, keyingi Preparation uchun raw rows path tayyor bo'ladi.",
    note: "Backendda landing va raw write alohida bajariladi; UIda takror ko'rinmasligi uchun bitta stage sifatida ko'rsatiladi.",
  },
  raw: {
    does: "Original payload ichidan collection rows ajratib, raw data lake formatida saqlaydi.",
    flow: "Landing payloaddan products/users/carts kabi collection olinadi va raw-zone ichiga raw.json qilib yoziladi.",
    result: "Keyingi validation va transform uchun normalized raw rows tayyor bo'ladi.",
  },
  preparation: {
    does: "Raw datani DWH ga yuborishdan oldin profil qiladi, string va bo'sh qiymatlarni normalize qiladi hamda prepared draft version yaratadi.",
    flow: "Raw rowlar o'zgarmas nusxa sifatida qoladi. Column profile, type inference va basic cleanup bajariladi.",
    result: "Prepared draft ochiladi va keyingi Imputatsiya / Edit stepga beriladi.",
    note: "Raw object o'zgarmaydi; keyingi step har bir record uchun version ID bilan ishlaydi.",
  },
  imputation: {
    does: "Bo'sh yoki sifatsiz qiymatlarni topadi, hisoblangan/default qiymat bilan to'ldiradi va operator edit qilgan fieldlarni record versioniga yozadi.",
    flow: "Prepared draft ichidagi har bir record uchun raw:v0, prep:v1, qa:v2, dwh:v3 version ID ko'rsatiladi. Imputatsiya va manual edit faqat prepared versionda bajariladi.",
    result: "Imputed count, manual edit audit, record version ID lari va READY_FOR_QUALITY statusi chiqadi. Shundan keyin data Great Expectations validatsiyasiga ketadi.",
    note: "Bu step Data Preparation ichidagi alohida nazorat nuqtasi: raw buzilmaydi, DWH ga faqat versionlangan prepared data ketadi.",
  },
  gx: {
    does: "Prepared data sifatini tekshiradi: record count, id mavjudligi, schema bo'sh emasligi va null threshold.",
    flow: "Prepared rows validatorga beriladi, har bir quality rule pass/fail natija qaytaradi.",
    result: "Quality score va checks list hosil bo'ladi; UI dagi Quality panel shu natijani ko'rsatadi.",
  },
  spark: {
    does: "Raw rowsni analytics uchun curated business schema ga aylantiradi.",
    flow: "Raw rowlarga run metadata qo'shiladi, source turiga qarab entity, category va metric fieldlar mapping qilinadi.",
    result: "Curated rows hosil bo'ladi; keyin object storage va ClickHouse load shu rows orqali bajariladi.",
    note: "Manual run ichida Python transform ishlaydi; PySpark job alohida spark-submit uchun tayyorlangan.",
  },
  curated: {
    does: "Transformdan chiqqan business-ready rowsni curated zone object sifatida saqlaydi.",
    flow: "Memory ichidagi curated rows JSON objectga serialize qilinadi va MinIO ga yoziladi.",
    result: "Curated object path qaytadi; warehouse load va replay uchun curated.json tayyor bo'ladi.",
  },
  clickhouse: {
    does: "Curated rowsni analitik Data Warehouse jadvaliga insert qiladi.",
    flow: "Backend ClickHouse client orqali curated_events jadvalini yaratadi yoki topadi, rowsni batch insert qiladi.",
    result: "KPI, dashboard va BI querylar uchun curated_events jadvalida analytics data paydo bo'ladi.",
  },
  postgres: {
    does: "Pipeline run auditini ODS/metadata sifatida PostgreSQL jadvaliga yozadi.",
    flow: "run_id, source, mode, records, quality_score va warnings pipeline_runs jadvaliga upsert qilinadi.",
    result: "Har bir run bo'yicha audit trail hosil bo'ladi, keyin monitoring va troubleshooting uchun ishlatiladi.",
  },
  airflow: {
    does: "Batch orchestration va scheduler vazifasini bajarishi uchun qo'shilgan DAG qatlamini ifodalaydi.",
    flow: "Airflow DAG FastAPI pipeline endpointni schedule yoki manual trigger orqali chaqirishi mumkin.",
    result: "DAG run, retry va task status Airflow UI orqali boshqariladi.",
    note: "Hozirgi frontend Run Pipeline bevosita FastAPI chaqiradi; Airflow DAG alohida ishlatiladi.",
  },
  dbt: {
    does: "Warehouse ichidagi SQL modeling, staging va mart qatlamlarini standartlashtirish uchun ishlatiladi.",
    flow: "ClickHouse curated_events relation staging modelga, keyin mart/fact modelga aylantiriladi.",
    result: "BI va KPI uchun tartibli SQL model va testlar bazasi paydo bo'ladi.",
    note: "Manual API run ichida dbt CLI ishga tushmaydi; project va model fayllari tayyor.",
  },
  superset: {
    does: "ClickHouse dagi curated data asosida dashboard va BI hisobotlar ko'rsatish qatlamini bildiradi.",
    flow: "Warehouse jadvali Superset dataset sifatida ulanadi, chart va dashboardlar shu datasetdan o'qiydi.",
    result: "Rahbariyat va statistik xodimlar KPI/dashboard orqali tayyor analyticsni ko'radi.",
    note: "Bu frontend run Superset API ni trigger qilmaydi; data ClickHouse da dashboardga tayyor bo'ladi.",
  },
  trino: {
    does: "Turli storage va warehouse manbalar ustidan ad-hoc SQL so'rov qilish gatewayini ifodalaydi.",
    flow: "Foydalanuvchi query yuboradi, Trino cataloglar bo'yicha plan tuzadi va result set qaytaradi.",
    result: "Analitiklar turli manbalardan tez SQL query olish imkoniga ega bo'ladi.",
    note: "Compose ichida Trino service hali ulanmagan; bu stage arxitektura qatlamini ko'rsatadi.",
  },
  api: {
    does: "DWH natijalarini boshqa tizimlarga API orqali berish qatlamini bildiradi.",
    flow: "External system FastAPI endpointlarga so'rov yuboradi, backend warehouse yoki service datani JSON response qiladi.",
    result: "OpenAPI docs va API contract orqali integratsiya qilish mumkin bo'ladi.",
  },
  portal: {
    does: "Hozirgi Next.js web interfeysni bildiradi: pipeline run, status, preview, logs va o'ng stage inspector sidebar.",
    flow: "Browser Next.js appga ulanadi, Next API proxy backend bilan gaplashadi va response state sifatida render qilinadi.",
    result: "Foydalanuvchi har bir stepda nima bo'lganini UI orqali ko'radi.",
  },
  export: {
    does: "Natijalarni CSV, Excel, PDF yoki JSON sifatida tashqariga chiqarish qatlamini ifodalaydi.",
    flow: "Tanlangan raw yoki curated result export servicega beriladi, service kerakli file formatni yaratadi.",
    result: "Foydalanuvchi hisobot yoki ochiq data faylini yuklab olishi mumkin.",
    note: "Hozir API JSON preview real ishlaydi; CSV/PDF export endpoint keyingi ish sifatida qolgan.",
  },
};
const stagePresentationTexts: Record<string, string> = {
  fastapi: "Nima uchun kerak: barcha source'lar Data Warehousega bitta nazoratli kirish nuqtasi orqali kirishi kerak. FastAPI requestni qabul qiladi, source va limitni tekshiradi, lokal test API'dan null qiymatlari bor JSON payload oladi. Bu step data oqimini boshlaydi va keyingi bosqichlarga run_id bilan bir xil formatda uzatadi.",
  nifi: "Nima uchun kerak: productionda source'lar ko'p bo'ladi va ularni qo'lda ulash qiyin. NiFi routing, filtering va flow boshqaruvi uchun kerak. Demo ichida bu alohida ishga tushmagan, lekin real tizimda qaysi source qayerga borishini NiFi boshqaradi.",
  kafka: "Nima uchun kerak: pipeline ichidagi hodisalar yo'qolmasligi va boshqa servislar xabardor bo'lishi kerak. Kafka dataning o'zini emas, ingestion eventni uzatadi: run_id, source, mode va records soni. Bu monitoring, retry va real-time consumerlar uchun signal vazifasini bajaradi.",
  landing: "Nima uchun kerak: bu bosqich original payload va ishlov beriladigan raw rowlarni MinIO data lake ichida birga saqlaydi. Landing qismi audit uchun asl JSONni saqlaydi, Raw qismi esa keyingi Data Preparation ishlashi uchun row formatni tayyorlaydi. Shu sababli UIda bitta MinIO Landing / Raw step sifatida ko'rsatiladi.",
  raw: "Nima uchun kerak: original payload ko'pincha ichma-ich JSON bo'ladi, pipeline esa rowlar bilan ishlaydi. Raw Zone collectionni ajratadi va xom rowlar sifatida saqlaydi. Bu hali biznes model emas, lekin keyingi profiling va tozalash uchun qulay format.",
  preparation: "Nima uchun kerak: xom rowni bevosita DWHga yuborish xavfli. Data Preparation columnlarni profil qiladi, type va bo'sh qiymatlarni ko'radi, stringlarni tozalaydi va prepared draft yaratadi. Raw data buzilmaydi, yangi prepared version keyingi stepga beriladi.",
  imputation: "Nima uchun kerak: DWHga null yoki sifatsiz qiymatlar nazoratsiz ketmasligi kerak. Bu step missing fieldlarni topadi, hisoblangan/default qiymat bilan to'ldiradi va kerak bo'lsa operator qo'lda tuzatadi. Shu joyda flow to'xtab, prepared version tanlangandan keyin qualityga o'tadi.",
  gx: "Nima uchun kerak: tozalangan data ham DWHga kirishdan oldin quality gate'dan o'tishi kerak. Great Expectations record count, id, schema va null threshold kabi qoidalarni tekshiradi. Xato bo'lsa DWHga noto'g'ri data ketmasdan shu yerda to'xtaydi.",
  airflow: "Nima uchun kerak: productionda pipeline tugmani bosib emas, jadval yoki event asosida avtomatik yurishi kerak. Airflow DAG, retry, schedule va task statusni boshqaradi. Demo manual run bilan ko'rsatilgan, Airflow esa orchestration qatlami sifatida tayyor turadi.",
  spark: "Nima uchun kerak: prepared data hali analytics uchun yakuniy model emas. PySpark/transform bosqichi rowlarni business schema'ga o'tkazadi: entity_name, category, metric_name, metric_value va status. Bu ClickHouse uchun yagona analitik format yaratadi.",
  curated: "Nima uchun kerak: transform natijasini faqat xotirada qoldirib bo'lmaydi. Curated Zone business-ready datani qayta ishlatish, replay qilish va warehousega qayta yuklash uchun saqlaydi. Bu Rawdan farqli ravishda dashboard va DWHga yaqin model.",
  dbt: "Nima uchun kerak: warehouse ichida SQL model, fact/dimension va KPI qoidalari tartibli saqlanishi kerak. dbt shu modeling qatlamini standartlashtiradi. Demo transformni backend bajargan, dbt esa productionda SQL model va testlarni boshqaradi.",
  clickhouse: "Nima uchun kerak: tayyor curated data tez analitik so'rovlar uchun maxsus DWH bazasiga tushishi kerak. ClickHouse katta hajmdagi KPI, dashboard va aggregatsiya querylarini tez bajaradi. Bu step datani real analytics jadvaliga yuklaydi.",
  postgres: "Nima uchun kerak: pipeline natijasining auditi alohida saqlanishi kerak. PostgreSQL run_id, status, records, quality_score va warninglarni yozadi. Bu DWH datasi emas, balki jarayonni kuzatish va troubleshooting uchun operational metadata.",
  superset: "Nima uchun kerak: rahbariyat va analitiklar DWHdagi datani dashboard orqali ko'rishi kerak. Superset shu BI qatlam uchun rejalashtirilgan. Demo'da dashboardni Next.js portal ko'rsatyapti, shuning uchun Superset NOT CONNECTED deb halol ajratilgan.",
  trino: "Nima uchun kerak: ayrim holatda bitta bazadan emas, bir nechta storage va database'dan ad-hoc SQL qilish kerak bo'ladi. Trino shu distributed query qatlamini beradi. Hozir demo ClickHouse/PostgreSQL bilan ishlayapti, Trino hali ulanmagan.",
  api: "Nima uchun kerak: DWH natijasidan faqat portal emas, boshqa tizimlar ham foydalanishi kerak. API Services tayyor KPI yoki curated datani tashqi tizimlarga JSON contract bilan beradi. Demo'da FastAPI bor, lekin bu serving qatlami alohida kengaytiriladi.",
  portal: "Nima uchun kerak: foydalanuvchi pipeline holatini bitta oynada ko'rishi kerak. Portal run qilish, step statusi, timeline, lineage, preview va xatoliklarni ko'rsatadi. Bu demo'da rahbariyat ko'rayotgan asosiy web interfeys shu.",
  export: "Nima uchun kerak: ayrim foydalanuvchilar data yoki hisobotni fayl ko'rinishida olishni xohlaydi. Export CSV, Excel, PDF yoki JSON chiqarish uchun kerak. Demo scope'da bu hali ulanmagan, shuning uchun NOT CONNECTED holatda ko'rsatilgan.",
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
  landing: { artifacts: { storage: "MinIO", console: "http://localhost:9001", buckets: ["landing-zone", "raw-zone"], objects: ["landing.json", "raw.json"] } },
  preparation: {
    input_ref: "MinIO raw-zone/{source}/{run_id}/raw.json",
    output_ref: "MinIO raw-zone/{source}/{run_id}/prepared.json",
    input_preview: { operation: "profile + normalize + prepared draft" },
    artifacts: { module: "backend/app/preparation.py", persisted_object: "prepared.json", raw_immutable: true },
  },
  imputation: {
    input_ref: "prepared draft rows",
    output_ref: "prepared.json with record version IDs",
    input_preview: { operation: "null scan + imputation + manual edit" },
    output_preview: { version_flow: "raw:v0 -> prep:v1 -> qa:v2 -> dwh:v3", status: "READY_FOR_QUALITY" },
    artifacts: { module: "backend/app/preparation.py", metric: "imputed_values", record_versions: true },
  },
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

const PLAYBACK_STEP_MS = 3000;
const PLAYBACK_ORDER = [
  "fastapi",
  "nifi",
  "kafka",
  "landing",
  "preparation",
  "imputation",
  "gx",
  "airflow",
  "spark",
  "curated",
  "dbt",
  "clickhouse",
  "postgres",
  "superset",
  "trino",
  "api",
  "portal",
  "export",
];

export function Dashboard() {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [sources, setSources] = useState<SourcesResponse>({});
  const [source, setSource] = useState("local_null_products");
  const [mode, setMode] = useState<Mode>("api");
  const [limit, setLimit] = useState(20);
  const [failureStage, setFailureStage] = useState<FailureStage>("none");
  const [view, setView] = useState<View>("curated");
  const [corrections, setCorrections] = useState<ManualCorrection[]>([]);
  const [result, setResult] = useState<PipelineResult | null>(null);
  const [running, setRunning] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [activeStage, setActiveStage] = useState<StageMeta | null>(stageCatalog[0]);
  const [error, setError] = useState<string | null>(null);
  const [frontendHost, setFrontendHost] = useState("loading");
  const [playbackStageId, setPlaybackStageId] = useState<string | null>(null);
  const [playbackRunning, setPlaybackRunning] = useState(false);
  const [visitedStageIds, setVisitedStageIds] = useState<string[]>([]);
  const [awaitingVersionSelection, setAwaitingVersionSelection] = useState(false);
  const [manualStopped, setManualStopped] = useState(false);
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null);
  const playbackTimers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const playbackStagesRef = useRef<StageMeta[]>([]);
  const playbackIndexRef = useRef(0);

  useEffect(() => {
    setFrontendHost(window.location.host);
    void loadInitial();
    return () => clearPlaybackTimers();
  }, []);

  const stageResults = useMemo(() => {
    const map = new Map<string, StageResult>();
    result?.stages.forEach((stage) => map.set(stage.id, stage));
    const landing = map.get("landing");
    const raw = map.get("raw");
    if (landing && raw) {
      const combinedStatus = landing.status === "error" || raw.status === "error"
        ? "error"
        : landing.status === "warning" || raw.status === "warning"
          ? "warning"
          : "done";
      map.set("landing", {
        ...landing,
        name: "MinIO Landing / Raw write",
        status: combinedStatus,
        message: `${landing.message}; ${raw.message}`,
        ended_at: raw.ended_at,
        duration_ms: landing.duration_ms + raw.duration_ms,
        data_size_bytes: landing.data_size_bytes + raw.data_size_bytes,
        input_preview: landing.input_preview,
        output_ref: raw.output_ref ?? landing.output_ref,
        output_preview: {
          landing: landing.output_preview,
          raw: raw.output_preview,
        },
        metrics: {
          ...(landing.metrics ?? {}),
          raw_records_written: raw.metrics?.records_written,
          raw_object_count: raw.metrics?.object_count,
        },
        artifacts: {
          ...(landing.artifacts ?? {}),
          raw_artifacts: raw.artifacts,
          raw_output_ref: raw.output_ref,
        },
        warnings: [...(landing.warnings ?? []), ...(raw.warnings ?? [])],
      });
    }
    const preparation = map.get("preparation");
    if (preparation && !map.has("imputation")) {
      map.set("imputation", {
        ...preparation,
        id: "imputation",
        name: "Imputatsiya / Edit",
        sequence: preparation.sequence + 0.1,
        message: `imputed=${preparation.metrics?.imputed_values ?? 0}, manual_edits=${preparation.metrics?.manual_corrections_applied ?? 0}, record_versions=ready`,
        input_ref: preparation.output_ref,
        output_ref: preparation.output_ref,
        data_format: "Record-level prepared version IDs",
      });
    }
    return map;
  }, [result]);

  const rows = view === "raw"
    ? result?.raw_preview || []
    : view === "prepared"
      ? result?.prepared_preview || []
      : result?.curated_preview || [];
  const columns = getColumns(rows, view);
  const qualityChecks = result?.quality_checks || [];
  const activeStageResult = activeStage ? stageResults.get(activeStage.id) : undefined;
  const playbackTotal = result ? getPlaybackStages(result).length : 0;
  const playbackPosition = playbackStageId ? visitedStageIds.indexOf(playbackStageId) + 1 : visitedStageIds.length;

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

  async function runPipeline(failureOverride?: FailureStage) {
    const requestedFailure = failureOverride ?? failureStage;
    setRunning(true);
    setError(null);
    clearPlaybackTimers();
    setPlaybackRunning(false);
    setPlaybackStageId(null);
    setVisitedStageIds([]);
    setAwaitingVersionSelection(false);
    setManualStopped(false);
    setSelectedVersionId(null);
    setActiveStage(null);
    setResult(null);
    setLogs([]);
    addLog(`POST /api/backend/pipeline/run source=${source} limit=${limit} mode=${mode} failure_stage=${requestedFailure} corrections=${corrections.length}`);

    try {
      const nextResult = await fetchJson<PipelineResult>("/api/backend/pipeline/run", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ source, limit, mode, failure_stage: requestedFailure, corrections }),
      });
      setResult(nextResult);
      addLog(`run_id=${nextResult.run_id}`);
      nextResult.stages.forEach((stage) => addLog(`${stage.id}: ${stage.status} ${stage.duration_ms}ms ${shorten(stage.message)}`));
      if (nextResult.warnings.length) nextResult.warnings.forEach((warning) => addLog(`warning: ${warning}`));
      startStagePlayback(nextResult);
    } catch (err) {
      setError(formatError(err));
      clearPlaybackTimers();
      setPlaybackRunning(false);
      setPlaybackStageId(null);
      setVisitedStageIds([]);
      addLog(`error: ${formatError(err)}`);
    } finally {
      setRunning(false);
    }
  }

  function retryPipeline() {
    setFailureStage("none");
    void runPipeline("none");
  }

  function addCorrection(correction: ManualCorrection) {
    setCorrections((current) => [
      ...current.filter((item) => item.record_id !== correction.record_id || item.column !== correction.column),
      correction,
    ]);
  }

  function removeCorrection(recordId: string, column: string) {
    setCorrections((current) => current.filter((item) => item.record_id !== recordId || item.column !== column));
  }

  function applyCorrections() {
    setFailureStage("none");
    void runPipeline("none");
  }

  function clearPlaybackTimers() {
    playbackTimers.current.forEach((timer) => clearTimeout(timer));
    playbackTimers.current = [];
  }

  function startStagePlayback(nextResult: PipelineResult) {
    clearPlaybackTimers();
    const playableStages = getPlaybackStages(nextResult);
    playbackStagesRef.current = playableStages;
    playbackIndexRef.current = 0;

    setPlaybackStageId(null);
    setVisitedStageIds([]);
    setAwaitingVersionSelection(false);
    setManualStopped(false);
    setSelectedVersionId(null);
    setActiveStage(null);

    if (!playableStages.length) {
      setPlaybackRunning(false);
      return;
    }

    setPlaybackRunning(true);
    schedulePlaybackStep(0, 0);
  }

  function schedulePlaybackStep(index: number, delay = PLAYBACK_STEP_MS) {
    const timer = setTimeout(() => {
      const stage = playbackStagesRef.current[index];
      if (!stage) {
        setPlaybackRunning(false);
        setPlaybackStageId(null);
        return;
      }

      playbackIndexRef.current = index;
      setPlaybackStageId(stage.id);
      setVisitedStageIds((current) => current.includes(stage.id) ? current : [...current, stage.id]);
      setActiveStage(stage);
      addLog(`animation: ${index + 1}/${playbackStagesRef.current.length} ${stage.id}`);

      if (stage.id === "imputation") {
        setPlaybackRunning(false);
        setAwaitingVersionSelection(true);
        addLog("WAITING_VERSION_SELECTION: Imputatsiya/Edit stepda to'xtadi. Version tanlang va davom ettiring.");
        return;
      }

      if (index === playbackStagesRef.current.length - 1) {
        const endTimer = setTimeout(() => {
          setPlaybackRunning(false);
          setPlaybackStageId(null);
        }, PLAYBACK_STEP_MS);
        playbackTimers.current.push(endTimer);
        return;
      }

      schedulePlaybackStep(index + 1);
    }, delay);
    playbackTimers.current.push(timer);
  }

  function continueAfterVersionSelection() {
    if (!selectedVersionId) {
      addLog("Version tanlanmagan: davom etish uchun record version ID ni tanlang.");
      return;
    }
    setAwaitingVersionSelection(false);
    setPlaybackRunning(true);
    addLog(`VERSION_SELECTED: ${selectedVersionId}; flow Great Expectations stepga davom etadi.`);
    schedulePlaybackStep(playbackIndexRef.current + 1, 0);
  }

  function stopPlaybackAtCurrentStep() {
    clearPlaybackTimers();
    setPlaybackRunning(false);
    setAwaitingVersionSelection(false);
    setManualStopped(true);
    const stoppedStage = playbackStageId ?? activeStage?.id ?? "current step";
    addLog("STOPPED_BY_USER: " + stoppedStage + " stepda qo'lda to'xtatildi.");
  }

  function continueAfterManualStop() {
    setManualStopped(false);
    setPlaybackRunning(true);
    addLog("CONTINUE_FROM_STOP: keyingi stepga davom etdi.");
    schedulePlaybackStep(playbackIndexRef.current + 1, 0);
  }
  function handleStageSelect(stage: StageMeta) {
    setActiveStage(stage);
    if (stage.id === "fastapi" || stage.id === "api") {
      const selectedSource = sources[source];
      const isLocalTest = source === "local_null_products" || selectedSource?.local_test;
      const endpoint = selectedSource?.endpoint ?? (isLocalTest ? "/test-api/products-null" : "/products");
      const url = isLocalTest
        ? `/api/backend${endpoint}?limit=${limit}`
        : `https://dummyjson.com${endpoint}`;
      addLog(`OPEN_TEST_API_JSON: ${url}`);
      window.open(url, "_blank", "noopener,noreferrer");
    }
  }
  return (
    <main className="shell">
      <header className="topbar">
        <div className="brand">
          <div className="brandIcon"><Icon name="workflow" /></div>
          <div>
            <p>Statistika qo'mitasi</p>
            <h1>Data Warehouse Pipeline Runner</h1>
          </div>
        </div>
        <div className="statusLine">
          <StatusPill label="FastAPI" value={health?.status || "checking"} ok={health?.status === "ok"} />
          <StatusPill label="Next" value={frontendHost} ok />
        </div>
      </header>

      <section className="runnerBar">
        <div className="runnerIdentity">
          <span className="runnerIcon"><Icon name="warehouse" /></span>
          <div>
            <p>Production flow</p>
            <h2>External API to Analytics</h2>
          </div>
        </div>
        <div className="runnerControls">
          <label className="sourceControl">
            <span>Source</span>
            <select
              value={source}
              onChange={(event) => {
                setSource(event.target.value);
                setCorrections([]);
              }}
              disabled={running}
            >
              {Object.entries(sources).map(([key, item]) => (
                <option key={key} value={key}>{item.title} / {item.collection}</option>
              ))}
            </select>
          </label>
          <label className="limitControl">
            <span>Limit</span>
            <input type="number" min={1} max={100} value={limit} onChange={(event) => setLimit(Number(event.target.value))} disabled={running} />
          </label>
          <label className={`failureControl ${failureStage !== "none" ? "armed" : ""}`}>
            <span>Test failure</span>
            <select value={failureStage} onChange={(event) => setFailureStage(event.target.value as FailureStage)} disabled={running}>
              <option value="none">Normal run</option>
              <option value="kafka">Kafka error (TEST)</option>
              <option value="gx">Validation error (TEST)</option>
              <option value="clickhouse">ClickHouse error (TEST)</option>
            </select>
          </label>
          <div className="segmented" aria-label="Pipeline mode">
            {(["batch", "stream", "api"] as Mode[]).map((item) => (
              <button key={item} className={mode === item ? "active" : ""} onClick={() => setMode(item)} disabled={running}>
                <Icon name={item === "batch" ? "clock" : item === "stream" ? "stream" : "api"} />
                <span>{item}</span>
              </button>
            ))}
          </div>
          <button className="runButton" onClick={() => void runPipeline()} disabled={running || !Object.keys(sources).length}>
            <Icon name={running ? "refresh" : "play"} />
            <span>{running ? "API ishlayapti" : "Run scenario"}</span>
          </button>
        </div>
      </section>

      {error && <div className="errorBox"><Icon name="alert" /> {error}</div>}

      <section className="workspaceGrid">
        <article className="panel scenarioPanel">
          <div className="panelHead">
            <div>
              <p>Execution view</p>
              <h2>Data oqimining real o'tishi</h2>
            </div>
            <div className="panelActions">
              {result && <span className={`playbackBadge ${playbackRunning ? "running" : ""}`}>{Math.max(playbackPosition, 0)}/{playbackTotal}</span>}
              <span className="stepDuration"><Icon name="clock" /> 3 soniya / step</span>
              {manualStopped ? (
                <button className="smallButton continueButton" onClick={continueAfterManualStop} disabled={!result || running}>
                  <Icon name="play" /> Davom etish
                </button>
              ) : playbackRunning ? (
                <button className="smallButton stopButton" onClick={stopPlaybackAtCurrentStep}>
                  <Icon name="close" /> Stop step
                </button>
              ) : (
                <button className="smallButton" onClick={() => result && startStagePlayback(result)} disabled={!result || running}>
                  <Icon name="play" /> Qayta ko'rish
                </button>
              )}
              <button className="iconButton" onClick={loadInitial} disabled={running} aria-label="Backend statusini yangilash" title="Backend statusini yangilash"><Icon name="refresh" /></button>
            </div>
          </div>
          <ScenarioCanvas
            stageResults={stageResults}
            visitedStageIds={visitedStageIds}
            playbackStageId={playbackStageId}
            playbackRunning={playbackRunning}
            apiRunning={running}
            totalRecords={result?.records ?? 0}
            runStatus={result?.status}
            onSelect={handleStageSelect}
          />
          <ScenarioStepNotes
            stageResults={stageResults}
            visitedStageIds={visitedStageIds}
            playbackStageId={playbackStageId}
            onSelect={handleStageSelect}
          />
          <PrepareImputationDeepBlock
            result={result}
            stageResults={stageResults}
            selectedVersionId={selectedVersionId}
            awaitingVersionSelection={awaitingVersionSelection}
            onSelectVersion={setSelectedVersionId}
            onContinue={continueAfterVersionSelection}
          />
        </article>

        <aside className="runSidebar">
          <StageSidePanel
            stage={activeStage}
            result={activeStageResult}
            active={Boolean(activeStage && playbackStageId === activeStage.id)}
            awaitingVersionSelection={awaitingVersionSelection}
            selectedVersionId={selectedVersionId}
            onSelectVersion={setSelectedVersionId}
            onContinue={continueAfterVersionSelection}
          />

          <section className="panel summaryPanel">
            <div className="panelHead compact">
              <div>
                <p>Current run</p>
                <h2>Natija</h2>
              </div>
            </div>
            <div className="runStats">
              <Metric label="Run ID" value={result?.run_id ? result.run_id.slice(0, 8) : "-"} />
              <Metric label="Records" value={String(result?.records ?? 0)} />
              <Metric label="Quality" value={`${result?.quality_score ?? 0}%`} />
              <Metric label="Fields" value={String(result?.curated_fields ?? 0)} />
            </div>
          </section>

          <section className="panel qualityPanel">
            <div className="panelHead compact">
              <div>
                <p>Data quality</p>
                <h2>Tekshiruvlar</h2>
              </div>
            </div>
            <div className="qualityList">
              {(qualityChecks.length ? qualityChecks : [{ name: "Pipeline", passed: false, value: "kutilmoqda" } as QualityCheck]).map((check) => (
                <div key={check.name} className={`qualityItem ${check.passed ? "ok" : "warn"}`}>
                  <Icon name={check.passed ? "check" : "clock"} />
                  <span>{check.name}</span>
                  <strong>{check.value}</strong>
                </div>
              ))}
            </div>
          </section>

          <section className="panel endpointPanel">
            <div className="panelHead compact">
              <div>
                <p>Live endpoint</p>
                <h2>API</h2>
              </div>
            </div>
            <div className="apiList">
              <code>POST /api/backend/pipeline/run</code>
              <code>GET /api/backend/health</code>
            </div>
          </section>
        </aside>
      </section>

      {result && (
        <section className="analysisGrid">
          <ExecutionTimeline
            stages={result.stages}
            visitedStageIds={visitedStageIds}
            playbackStageId={playbackStageId}
            onSelect={(stageId) => {
              const stage = stageCatalog.find((item) => item.id === stageId);
              if (stage) setActiveStage(stage);
            }}
          />
          <RunReport result={result} playbackRunning={playbackRunning} running={running} onRetry={retryPipeline} />
        </section>
      )}

      <PreparationWorkbench
        rawRows={result?.raw_preview ?? []}
        preparedRows={result?.prepared_preview ?? []}
        corrections={corrections}
        preparationStage={stageResults.get("preparation")}
        running={running}
        playbackRunning={playbackRunning}
        onAdd={addCorrection}
        onRemove={removeCorrection}
        onApply={applyCorrections}
      />

      <section className="dataGrid">
        <article className="panel tablePanel">
          <div className="panelHead">
            <div>
              <p>Preview</p>
              <h2>{view === "raw" ? "Raw data" : view === "prepared" ? "Prepared data" : "Curated data"}</h2>
            </div>
            <div className="tabs">
              <button className={view === "raw" ? "active" : ""} onClick={() => setView("raw")}><Icon name="database" /> Raw</button>
              <button className={view === "prepared" ? "active" : ""} onClick={() => setView("prepared")}><Icon name="workflow" /> Prepared</button>
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

      {result?.lineage.length ? <LineageExplorer records={result.lineage} /> : null}

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

function PrepareImputationDeepBlock({
  result,
  stageResults,
  selectedVersionId,
  awaitingVersionSelection,
  onSelectVersion,
  onContinue,
}: {
  result: PipelineResult | null;
  stageResults: Map<string, StageResult>;
  selectedVersionId: string | null;
  awaitingVersionSelection: boolean;
  onSelectVersion: (versionId: string) => void;
  onContinue: () => void;
}) {
  const preparation = stageResults.get("preparation");
  const imputation = stageResults.get("imputation") ?? preparation;
  const metrics = imputation?.metrics ?? {};
  const preparedRows = result?.prepared_preview ?? [];
  const versionRows = preparedRows.slice(0, 8).map((row, index) => {
    const recordId = String(row.id ?? row.dw_id ?? `row-${index + 1}`);
    const base = recordId.replace(/[^a-zA-Z0-9_-]/g, "").slice(-8) || String(index + 1).padStart(2, "0");
    return {
      recordId,
      raw: `raw:${base}:v0`,
      prepared: `prep:${base}:v1`,
      quality: `qa:${base}:v2`,
      dwh: `dwh:${base}:v3`,
    };
  });

  const flow = [
    ["01", "Raw draft", "Raw Zone dan kelgan asl record o'zgartirilmaydi. Har bir record uchun raw:v0 version saqlanadi."],
    ["02", "Prepare stage", "Profiling, type aniqlash, trim/null normalize va prepared draft ochiladi."],
    ["03", "Imputatsiya / Edit", "Bo'sh qiymatlar default yoki hisoblangan qiymat bilan to'ldiriladi. Operator kerak bo'lsa tabledan recordni tanlab qo'lda edit qiladi."],
    ["04", "Version tanlash", "Tabledagi prepared version ID tanlanadi. Tanlanmaguncha flow shu joyda to'xtab turadi."],
    ["05", "Quality va DWH", "Tanlangan version Great Expectations validationga, keyin Curated Zone va ClickHouse DWH ga ketadi."],
  ];

  return (
    <section className="prepareDeepBlock">
      <div className="prepareDeepHead">
        <div>
          <p>Prepare stage</p>
          <h3>Imputatsiya / Edit va version tanlash jarayoni</h3>
        </div>
        <span className={["prepareGateBadge", awaitingVersionSelection ? "paused" : imputation ? "ready" : "waiting"].join(" ")}>
          {awaitingVersionSelection ? "STOPPED FOR VERSION" : imputation ? "READY FOR QUALITY" : "WAITING INPUT"}
        </span>
      </div>

      <div className="prepareDeepGrid">
        <article className="prepareFlowPanel">
          <strong>Process qanday ishlaydi</strong>
          <div className="prepareFlowSteps">
            {flow.map(([index, title, text]) => (
              <div key={index} className="prepareFlowStep">
                <span>{index}</span>
                <div>
                  <b>{title}</b>
                  <p>{text}</p>
                </div>
              </div>
            ))}
          </div>
        </article>

        <article className="prepareMetricsPanel">
          <strong>Realtime natija</strong>
          <div className="prepareMetricGrid">
            <ReportValue label="Rows" value={String(metrics.output_rows ?? preparedRows.length)} />
            <ReportValue label="Imputed" value={String(metrics.imputed_values ?? 0)} />
            <ReportValue label="Manual edit" value={String(metrics.manual_corrections_applied ?? 0)} />
            <ReportValue label="Rejected" value={String(metrics.manual_corrections_rejected ?? 0)} />
          </div>
          <code>{imputation?.output_ref ?? "prepared.json va version ID lar pipeline ishga tushganda chiqadi"}</code>
        </article>
      </div>

      <div className="prepareVersionSelect">
        <div className="prepareVersionTitle">
          <strong>Tabledan version tanlash</strong>
          <span>{selectedVersionId ? `Tanlangan: ${selectedVersionId}` : "Prepared version ID tanlanmagan"}</span>
        </div>
        <div className="prepareVersionRows">
          {versionRows.length ? versionRows.map((item) => {
            const selected = selectedVersionId === item.prepared;
            return (
              <button key={item.recordId} type="button" className={["prepareVersionRow", selected ? "selected" : ""].join(" ")} onClick={() => onSelectVersion(item.prepared)}>
                <span><b>record_id</b><code>{item.recordId}</code></span>
                <span><b>Raw</b><code>{item.raw}</code></span>
                <span><b>Prepared</b><code>{item.prepared}</code></span>
                <span><b>Quality</b><code>{item.quality}</code></span>
                <span><b>DWH</b><code>{item.dwh}</code></span>
                <em>{selected ? "SELECTED" : "SELECT"}</em>
              </button>
            );
          }) : (
            <div className="prepareVersionEmpty">Run scenario qiling. Prepared preview chiqqandan keyin har bir recordning version ID lari shu tableda tanlanadi.</div>
          )}
        </div>
        <div className="prepareContinueBar">
          <span>{awaitingVersionSelection ? "Flow shu yerda to'xtagan. Version tanlang va davom ettiring." : "Imputatsiya stepga kelganda bu gate avtomatik pause qiladi."}</span>
          <button type="button" onClick={onContinue} disabled={!awaitingVersionSelection || !selectedVersionId}>
            <Icon name="play" /> Tanlangan version bilan davom etish
          </button>
        </div>
      </div>
    </section>
  );
}
function PreparationWorkbench({
  rawRows,
  preparedRows,
  corrections,
  preparationStage,
  running,
  playbackRunning,
  onAdd,
  onRemove,
  onApply,
}: {
  rawRows: Record<string, unknown>[];
  preparedRows: Record<string, unknown>[];
  corrections: ManualCorrection[];
  preparationStage?: StageResult;
  running: boolean;
  playbackRunning: boolean;
  onAdd: (correction: ManualCorrection) => void;
  onRemove: (recordId: string, column: string) => void;
  onApply: () => void;
}) {
  const [recordId, setRecordId] = useState(String(rawRows[0]?.id ?? ""));
  const [column, setColumn] = useState("");
  const [newValue, setNewValue] = useState("");

  useEffect(() => {
    if (!rawRows.some((row) => String(row.id) === recordId)) {
      setRecordId(String(rawRows[0]?.id ?? ""));
    }
  }, [rawRows, recordId]);

  const selectedRaw = rawRows.find((row) => String(row.id) === recordId) ?? rawRows[0];
  const editableColumns = selectedRaw ? Object.keys(selectedRaw).filter((key) => key !== "id") : [];
  const activeColumn = editableColumns.includes(column) ? column : editableColumns[0] ?? "";
  const selectedPrepared = preparedRows.find((row) => String(row.id) === recordId);
  const metrics = preparationStage?.metrics ?? {};

  function queueCorrection() {
    if (!recordId || !activeColumn) return;
    onAdd({ record_id: recordId, column: activeColumn, value: newValue });
    setColumn(activeColumn);
    setNewValue("");
  }

  return (
    <section className="panel preparationPanel">
      <div className="panelHead">
        <div>
          <p>Pre-DWH workbench</p>
          <h2>Data Preparation va qo'lda tuzatish</h2>
        </div>
        <span className={["preparationStatus", preparationStage?.status ?? "queued"].join(" ")}>
          {preparationStage ? "REAL EXECUTED" : "INPUT KUTILMOQDA"}
        </span>
      </div>
      <div className="preparationBody">
        <section className="correctionEditor">
          <div className="preparationSectionTitle"><Icon name="workflow" /><strong>Correction rule</strong></div>
          <div className="correctionForm">
            <label>
              <span>Record</span>
              <select value={recordId} onChange={(event) => setRecordId(event.target.value)}>
                {rawRows.map((row, index) => {
                  const id = String(row.id ?? index);
                  return <option key={id} value={id}>ID {id}</option>;
                })}
              </select>
            </label>
            <label>
              <span>Column</span>
              <select value={activeColumn} onChange={(event) => setColumn(event.target.value)}>
                {editableColumns.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
            </label>
            <div className="currentValue">
              <span>Raw value</span>
              <code>{formatCell(selectedRaw?.[activeColumn]) || "NULL"}</code>
            </div>
            <label>
              <span>Yangi qiymat</span>
              <input value={newValue} onChange={(event) => setNewValue(event.target.value)} placeholder="Bo'sh qiymat = NULL" />
            </label>
            <button className="queueCorrectionButton" type="button" onClick={queueCorrection} disabled={!recordId || !activeColumn || running}>
              <Icon name="check" /> Rule qo'shish
            </button>
          </div>
          <div className="valueComparison">
            <span>Prepared value</span>
            <code>{formatCell(selectedPrepared?.[activeColumn]) || "NULL"}</code>
          </div>
        </section>

        <section className="correctionQueue">
          <div className="preparationSectionTitle">
            <Icon name="layers" />
            <strong>Correction queue</strong>
            <span>{corrections.length}</span>
          </div>
          <div className="correctionList">
            {corrections.length ? corrections.map((item) => (
              <div className="correctionItem" key={item.record_id + ":" + item.column}>
                <span><strong>ID {item.record_id}</strong><code>{item.column}</code></span>
                <em>{formatCell(item.value) || "NULL"}</em>
                <button
                  type="button"
                  className="iconButton"
                  onClick={() => onRemove(item.record_id, item.column)}
                  aria-label="Correction rule ni o'chirish"
                  title="Rule ni o'chirish"
                  disabled={running}
                >
                  <Icon name="close" />
                </button>
              </div>
            )) : <div className="correctionEmpty">Manual correction yo'q.</div>}
          </div>
          <button
            className="applyCorrectionsButton"
            type="button"
            onClick={onApply}
            disabled={!corrections.length || running || playbackRunning}
          >
            <Icon name={running ? "refresh" : "play"} />
            {running ? "Prepared run ishlayapti" : "Qo'llash va pipeline'ni qayta ishlatish"}
          </button>
        </section>

        <section className="preparationAudit">
          <div className="preparationSectionTitle"><Icon name="chart" /><strong>Preparation audit</strong></div>
          <div className="preparationMetrics">
            <ReportValue label="Rows" value={String(metrics.output_rows ?? preparedRows.length)} />
            <ReportValue label="Columns" value={String(metrics.columns_profiled ?? 0)} />
            <ReportValue label="Trimmed" value={String(metrics.trimmed_values ?? 0)} />
            <ReportValue label="Blank to NULL" value={String(metrics.blank_to_null ?? 0)} />
            <ReportValue label="Imputed" value={String(metrics.imputed_values ?? 0)} />
            <ReportValue label="Applied" value={String(metrics.manual_corrections_applied ?? 0)} />
            <ReportValue label="Rejected" value={String(metrics.manual_corrections_rejected ?? 0)} />
          </div>
          <code className="preparedPath">{preparationStage?.output_ref ?? "prepared.json kutilmoqda"}</code>
        </section>
      </div>
    </section>
  );
}

function ScenarioStepNotes({
  stageResults,
  visitedStageIds,
  playbackStageId,
  onSelect,
}: {
  stageResults: Map<string, StageResult>;
  visitedStageIds: string[];
  playbackStageId: string | null;
  onSelect: (stage: StageMeta) => void;
}) {
  const orderedStages = PLAYBACK_ORDER
    .map((stageId) => stageCatalog.find((stage) => stage.id === stageId))
    .filter((stage): stage is StageMeta => Boolean(stage));

  return (
    <section className="scenarioStepNotes" aria-label="Scenario steplari nima ish qildi">
      <div className="scenarioStepNotesHead">
        <div>
          <p>Scenario izohi</p>
          <h3>Har bir step nima ish qiladi</h3>
        </div>
        <span>{orderedStages.length} step</span>
      </div>
      <div className="scenarioStepNoteGrid">
        {orderedStages.map((stage, index) => {
          const result = stageResults.get(stage.id);
          const description = stageDescriptions[stage.id];
          const active = playbackStageId === stage.id;
          const visited = visitedStageIds.includes(stage.id);
          const status = result?.status ?? (visited ? "available" : "queued");
          const processSummary = (processMap[stage.id] ?? []).join(" -> ");
          const mainText = stagePresentationTexts[stage.id] ?? [description?.does, description?.flow].filter(Boolean).join(" ");
          const runtimeText = result?.message ? `Runtime: ${result.message}` : "Runtime: scenario ishga tushganda real natija shu yerda chiqadi.";
          const outcome = [description?.result, runtimeText, result?.output_ref ? `Output: ${result.output_ref}` : ""].filter(Boolean).join(" ");

          return (
            <button
              type="button"
              key={stage.id}
              className={["scenarioStepNote", active ? "active" : "", visited ? "visited" : "", status].join(" ")}
              onClick={() => onSelect(stage)}
              style={{ "--stage-color": stage.color } as CSSProperties}
            >
              <span className="scenarioStepVisual">
                <img src={processImages[stage.id]} alt={`${stage.label} process visual`} loading="lazy" />
                <span className="scenarioStepIndex">{index + 1}</span>
                <span className="scenarioStepIcon"><Icon name={stage.icon} /></span>
              </span>
              <span className="scenarioStepBody">
                <strong>{stage.label}</strong>
                <em>{stage.layer} | {status.toUpperCase()}</em>
                <small>{mainText}</small>
                <code>{processSummary}</code>
                <b>{outcome}</b>
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
function ExecutionTimeline({
  stages,
  visitedStageIds,
  playbackStageId,
  onSelect,
}: {
  stages: StageResult[];
  visitedStageIds: string[];
  playbackStageId: string | null;
  onSelect: (stageId: string) => void;
}) {
  return (
    <article className="panel timelinePanel">
      <div className="panelHead">
        <div>
          <p>Execution timeline</p>
          <h2>Stage vaqt va holatlari</h2>
        </div>
        <span className="timelineCount">{stages.length} real stage</span>
      </div>
      <div className="timelineList">
        {stages.map((stage) => {
          const active = playbackStageId === stage.id;
          const visited = visitedStageIds.includes(stage.id);
          const playbackState = active ? "active" : visited ? stage.status : "queued";
          return (
            <button
              type="button"
              key={stage.id}
              className={["timelineItem", playbackState].join(" ")}
              onClick={() => onSelect(stage.id)}
            >
              <span className="timelineRail"><i /></span>
              <time>{formatStageTime(stage.started_at)}</time>
              <span className="timelineText">
                <strong>{stage.sequence}. {stage.name}</strong>
                <small>{stage.message}</small>
              </span>
              <span className="timelineMeta">
                <em>{formatBytes(stage.data_size_bytes)} | {stage.data_format}</em>
                <b>{stage.duration_ms} ms</b>
              </span>
            </button>
          );
        })}
      </div>
    </article>
  );
}

function RunReport({
  result,
  playbackRunning,
  running,
  onRetry,
}: {
  result: PipelineResult;
  playbackRunning: boolean;
  running: boolean;
  onRetry: () => void;
}) {
  const destinations = uniqueStrings(
    result.stages
      .map((stage) => stage.output_ref)
      .filter((value): value is string => Boolean(value) && /^(s3|local|clickhouse|postgres|kafka):/.test(value as string)),
  );
  const stageDuration = result.stages.reduce((total, stage) => total + stage.duration_ms, 0);

  return (
    <article className="panel reportPanel">
      <div className="panelHead">
        <div>
          <p>Final report</p>
          <h2>Run yakuni</h2>
        </div>
        <span className={["reportStatus", result.status].join(" ")}>
          {result.status === "done" ? "SUCCESS" : result.status === "error" ? "FAILED" : "WARNING"}
        </span>
      </div>
      <div className="reportBody">
        <div className="reportGrid">
          <ReportValue label="Run ID" value={result.run_id.slice(0, 12)} />
          <ReportValue label="Records" value={String(result.records)} />
          <ReportValue label="Quality" value={result.quality_score + "%"} />
          <ReportValue label="API total" value={formatDuration(result.duration_ms)} />
          <ReportValue label="Stage total" value={formatDuration(stageDuration)} />
          <ReportValue label="Mode" value={result.mode.toUpperCase()} />
        </div>

        <div className="reportSection">
          <strong>Storage va database natijalari</strong>
          <div className="destinationList">
            {destinations.length
              ? destinations.map((item) => <code key={item}>{item}</code>)
              : <span>Pipeline bu nuqtaga yetib kelmadi.</span>}
          </div>
        </div>

        {result.warnings.length > 0 && (
          <div className="reportWarnings">
            <Icon name="alert" />
            <div>
              <strong>{result.warnings.length} warning</strong>
              {result.warnings.map((warning) => <p key={warning}>{warning}</p>)}
            </div>
          </div>
        )}

        <div className="reportFooter">
          <span>{playbackRunning ? "3 soniyalik tushuntirish davom etmoqda" : "Timeline va lineage tekshirishga tayyor"}</span>
          {result.status === "error" && (
            <button className="retryButton" onClick={onRetry} disabled={running || playbackRunning}>
              <Icon name="refresh" /> Retry normal run
            </button>
          )}
        </div>
      </div>
    </article>
  );
}

function ReportValue({ label, value }: { label: string; value: string }) {
  return <div className="reportValue"><span>{label}</span><strong>{value}</strong></div>;
}

function LineageExplorer({ records }: { records: LineageRecord[] }) {
  const [selectedId, setSelectedId] = useState(records[0]?.record_id ?? "");

  useEffect(() => {
    if (!records.some((record) => record.record_id === selectedId)) {
      setSelectedId(records[0]?.record_id ?? "");
    }
  }, [records, selectedId]);

  const selected = records.find((record) => record.record_id === selectedId) ?? records[0];
  if (!selected) return null;

  return (
    <section className="panel lineagePanel">
      <div className="panelHead">
        <div>
          <p>Data lineage</p>
          <h2>Bitta recordning to'liq yo'li</h2>
        </div>
        <label className="lineageSelector">
          <span>Record</span>
          <select value={selected.record_id} onChange={(event) => setSelectedId(event.target.value)}>
            {records.map((record) => <option key={record.record_id} value={record.record_id}>ID {record.record_id}</option>)}
          </select>
        </label>
      </div>
      <div className="lineagePath">
        <LineageNode index="01" title="Source API" state="source" data={selected.source} />
        <span className="lineageArrow"><Icon name="route" /></span>
        <LineageNode index="02" title="Raw Zone" state="raw" data={selected.raw} />
        <span className="lineageArrow"><Icon name="route" /></span>
        <LineageNode index="03" title="Prepared" state={selected.prepared ? "prepared" : "missing"} data={selected.prepared} />
        <span className="lineageArrow"><Icon name="route" /></span>
        <LineageNode index="04" title="Curated" state={selected.curated ? "curated" : "missing"} data={selected.curated} />
        <span className="lineageArrow"><Icon name="route" /></span>
        <LineageNode index="05" title="ClickHouse" state={selected.warehouse ? "warehouse" : "missing"} data={selected.warehouse} />
      </div>
      <div className="lineageDiff">
        <DataDiffView input={selected.raw} output={selected.prepared} title="Raw to Prepared correction lineage" />
        <DataDiffView input={selected.prepared} output={selected.curated} title="Prepared to Curated transform lineage" />
      </div>
    </section>
  );
}

function LineageNode({ index, title, state, data }: { index: string; title: string; state: string; data: unknown }) {
  return (
    <article className={["lineageNode", state].join(" ")}>
      <header><span>{index}</span><strong>{title}</strong></header>
      <JsonBlock value={data} />
    </article>
  );
}

function ScenarioCanvas({
  stageResults,
  visitedStageIds,
  playbackStageId,
  playbackRunning,
  apiRunning,
  totalRecords,
  runStatus,
  onSelect,
}: {
  stageResults: Map<string, StageResult>;
  visitedStageIds: string[];
  playbackStageId: string | null;
  playbackRunning: boolean;
  apiRunning: boolean;
  totalRecords: number;
  runStatus?: PipelineResult["status"];
  onSelect: (stage: StageMeta) => void;
}) {
  const nodeMap = new Map(scenarioNodes.map((node) => [node.id, node]));
  const stageMap = new Map(stageCatalog.map((stage) => [stage.id, stage]));
  const playbackStarted = playbackRunning || visitedStageIds.length > 0;
  const activeLabel = playbackStageId ? stageMap.get(playbackStageId)?.label : null;
  const activeResult = playbackStageId ? stageResults.get(playbackStageId) : undefined;
  const packetEdge = playbackStageId
    ? scenarioEdges.find((edge) => edge.from === playbackStageId) ?? scenarioEdges.find((edge) => edge.to === playbackStageId)
    : undefined;
  const packetFrom = packetEdge ? nodeMap.get(packetEdge.from) : undefined;
  const packetTo = packetEdge ? nodeMap.get(packetEdge.to) : undefined;
  const runLabel = apiRunning
    ? "API javobi kutilmoqda"
    : playbackRunning
      ? `${activeLabel || "Pipeline"} bajarilmoqda`
      : stageResults.size
        ? runStatus === "error" ? "Execution xatolikda to'xtadi" : "Execution tugadi"
        : "Run uchun tayyor";

  return (
    <div className="scenarioViewport">
      <div className="scenarioMap" style={{ width: SCENARIO_WIDTH, height: SCENARIO_HEIGHT }}>
        <span className="canvasGroupLabel ingestionLabel">Ingestion va data lake</span>
        <span className="canvasGroupLabel orchestrationLabel">Orchestration</span>
        <span className="canvasGroupLabel deliveryLabel">Warehouse va delivery</span>

        <div className={["canvasRunBadge", apiRunning || playbackRunning ? "running" : stageResults.size ? "complete" : "idle"].join(" ")}>
          <i />
          <span>{runLabel}</span>
        </div>

        <svg className="scenarioConnections" viewBox={`0 0 ${SCENARIO_WIDTH} ${SCENARIO_HEIGHT}`} aria-hidden="true">
          {scenarioEdges.map((edge) => {
            const from = nodeMap.get(edge.from);
            const to = nodeMap.get(edge.to);
            if (!from || !to) return null;
            const active = playbackStageId === edge.from || playbackStageId === edge.to;
            const complete = visitedStageIds.includes(edge.to);
            const path = scenarioPath(from, to);
            return (
              <g key={`${edge.from}-${edge.to}`}>
                <path
                  d={path}
                  className={["scenarioEdge", edge.kind || "main", active ? "active" : "", complete && !active ? "complete" : ""].filter(Boolean).join(" ")}
                />
                {active && activeResult && (
                  <circle className="packetDot" r="6">
                    <animateMotion dur="1.8s" repeatCount="indefinite" path={path} />
                  </circle>
                )}
              </g>
            );
          })}
        </svg>

        {activeResult && packetFrom && packetTo && (
          <div
            className="dataPacketBadge"
            style={{ left: (packetFrom.x + packetTo.x) / 2, top: (packetFrom.y + packetTo.y) / 2 - 24 }}
          >
            <i />
            <strong>{getStageRecordCount(activeResult, totalRecords)} records</strong>
            <span>{formatBytes(activeResult.data_size_bytes)}</span>
            <span>{activeResult.data_format}</span>
          </div>
        )}

        {scenarioNodes.map((node, index) => {
          const stage = stageMap.get(node.id);
          if (!stage) return null;
          const stageResult = stageResults.get(stage.id);
          const isVisited = visitedStageIds.includes(stage.id);
          const isPlaying = playbackStageId === stage.id;
          const codeStatus = stageCodeSamples[stage.id]?.status;
          const playbackOrder = PLAYBACK_ORDER.indexOf(stage.id) + 1;
          let visualState = codeStatus === "not_connected" ? "notConnected" : "available";
          let stateLabel = codeStatus === "not_connected" ? "NOT CONNECTED" : "AVAILABLE";

          if (isPlaying) {
            visualState = "playing";
            stateLabel = stageResult
              ? "RUNNING 3s"
              : codeStatus === "not_connected"
                ? "NOT CONNECTED"
                : "AVAILABLE 3s";
          } else if (stageResult) {
            if (playbackStarted && !isVisited) {
              visualState = "queued";
              stateLabel = "QUEUED";
            } else {
              visualState = stageResult.status;
              stateLabel = stageResult.status === "done"
                ? "REAL EXECUTED"
                : stageResult.status === "error"
                  ? "TEST ERROR"
                  : "REAL WARNING";
            }
          }

          const style = {
            left: node.x,
            top: node.y,
            "--node-color": stage.color,
          } as CSSProperties & { "--node-color": string };

          return (
            <button
              type="button"
              key={stage.id}
              className={["scenarioNode", visualState, isVisited ? "visited" : ""].filter(Boolean).join(" ")}
              style={style}
              onClick={() => onSelect(stage)}
              title={stage.detail}
            >
              <span className="nodeOrder">{playbackOrder || index + 1}</span>
              <span className="moduleOrb">
                <Icon name={stage.icon} />
                <i className="nodeStateDot" />
              </span>
              <span className="moduleLabel">
                <strong>{stage.label}</strong>
                <small>{stage.layer}</small>
              </span>
              <span className="nodeStatus">{stateLabel}</span>
              {isPlaying && <span className="nodeProgress" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function scenarioPath(from: ScenarioNode, to: ScenarioNode): string {
  if (from.y === to.y) {
    const middle = (from.x + to.x) / 2;
    return "M " + from.x + " " + from.y + " C " + middle + " " + from.y + ", " + middle + " " + to.y + ", " + to.x + " " + to.y;
  }
  if (from.x === to.x) {
    const middle = (from.y + to.y) / 2;
    return "M " + from.x + " " + from.y + " C " + from.x + " " + middle + ", " + to.x + " " + middle + ", " + to.x + " " + to.y;
  }
  const direction = to.x >= from.x ? 1 : -1;
  const curve = Math.max(60, Math.abs(to.x - from.x) * 0.45);
  return "M " + from.x + " " + from.y + " C " + (from.x + curve * direction) + " " + from.y + ", " + (to.x - curve * direction) + " " + to.y + ", " + to.x + " " + to.y;
}

function StageSidePanel({
  stage,
  result,
  active,
  awaitingVersionSelection,
  selectedVersionId,
  onSelectVersion,
  onContinue,
}: {
  stage: StageMeta | null;
  result?: StageResult;
  active: boolean;
  awaitingVersionSelection: boolean;
  selectedVersionId: string | null;
  onSelectVersion: (versionId: string) => void;
  onContinue: () => void;
}) {
  if (!stage) {
    return (
      <section className="panel stageSidebarPanel">
        <div className="stageSidebarEmpty">Tekshirish uchun stage tanlang.</div>
      </section>
    );
  }

  return (
    <section className="panel stageSidebarPanel">
      <div className="panelHead compact stageSidebarHead">
        <span className="stageSidebarIcon" style={{ background: stage.color }}><Icon name={stage.icon} /></span>
        <div>
          <p>{stage.layer} stage</p>
          <h2>{stage.label}</h2>
        </div>
        <span className={["stageSidebarLive", active ? "active" : ""].join(" ")}>{active ? "RUNNING" : "SELECTED"}</span>
      </div>
      <div className="stageSidebarScroll">
        <p className="stageSidebarDetail">{stage.detail}</p>
        <StageRunState stage={stage} result={result} />
        <StageProcessSidebar stage={stage} result={result} active={active} />
        <StageDescriptionBlock stage={stage} />
        <PreparationLifecycle
          stage={stage}
          result={result}
          awaitingVersionSelection={awaitingVersionSelection}
          selectedVersionId={selectedVersionId}
          onSelectVersion={onSelectVersion}
          onContinue={onContinue}
        />
        <StageInspector stage={stage} result={result} fallback={staticStageDetails[stage.id]} />
      </div>
    </section>
  );
}

function PreparationLifecycle({
  stage,
  result,
  awaitingVersionSelection,
  selectedVersionId,
  onSelectVersion,
  onContinue,
}: {
  stage: StageMeta;
  result?: StageResult;
  awaitingVersionSelection: boolean;
  selectedVersionId: string | null;
  onSelectVersion: (versionId: string) => void;
  onContinue: () => void;
}) {
  if (stage.id !== "preparation" && stage.id !== "imputation") return null;

  const metrics = result?.metrics ?? {};
  const artifacts = result?.artifacts ?? {};
  const imputed = Number(metrics.imputed_values ?? 0);
  const applied = Number(metrics.manual_corrections_applied ?? 0);
  const rejected = Number(metrics.manual_corrections_rejected ?? 0);
  const rows = Number(metrics.output_rows ?? metrics.rows ?? 0);
  const preparedKey = String(artifacts.key ?? result?.output_ref ?? "prepared.json kutilmoqda");
  const executed = Boolean(result);
  const hasWarnings = rejected > 0 || result?.status === "warning";

  const previewRows = Array.isArray(result?.output_preview) ? result.output_preview as Record<string, unknown>[] : [];
  const recordVersions = previewRows.slice(0, 6).map((row, index) => {
    const recordId = String(row.id ?? row.dw_id ?? `row-${index + 1}`);
    const base = recordId.replace(/[^a-zA-Z0-9_-]/g, "").slice(-8) || String(index + 1).padStart(2, "0");
    return {
      recordId,
      rawVersion: `raw:${base}:v0`,
      preparedVersion: `prep:${base}:v1`,
      qualityVersion: `qa:${base}:v2`,
      dwhVersion: `dwh:${base}:v3`,
      status: result ? "READY_FOR_DWH" : "WAITING",
    };
  });
  const versionRows = [
    {
      version: "v0",
      title: "Raw original",
      status: executed ? "LOCKED" : "WAITING",
      note: "Manbadan kelgan asl data. Bu version o'zgartirilmaydi.",
      path: result?.input_ref ?? "raw.json kutilmoqda",
    },
    {
      version: "v1",
      title: "Prepared draft",
      status: executed ? "SAVED" : "WAITING",
      note: "Normalize va qo'lda tuzatishlardan keyingi yangi version.",
      path: preparedKey,
    },
    {
      version: "v2",
      title: "Quality checked",
      status: executed ? (hasWarnings ? "WARNING" : "PASSED") : "WAITING",
      note: "Great Expectations quality gate uchun yuboriladigan version.",
      path: "prepared -> quality validation",
    },
    {
      version: "v3",
      title: "Curated model",
      status: executed ? "READY" : "WAITING",
      note: "Business schema va analytics fieldlarga aylantirilgan version.",
      path: "curated.json / Curated Zone",
    },
    {
      version: "DWH",
      title: "Warehouse load",
      status: executed ? "READY_FOR_DWH" : "WAITING",
      note: "Qualitydan o'tgan version ClickHouse DWH ga ketadi.",
      path: "ClickHouse curated_events",
    },
  ];
  const lifecycle = [
    {
      code: "RAW_RECEIVED",
      title: "Raw data qabul qilindi",
      text: "Raw zone ichidagi asl data o'zgartirilmasdan input sifatida olinadi.",
      state: executed ? "done" : "waiting",
    },
    {
      code: "PROFILED",
      title: "Profiling bajarildi",
      text: `${metrics.columns_profiled ?? 0} column, ${rows || 0} row tekshirildi. Type va schema ko'rildi.`,
      state: executed ? "done" : "waiting",
    },
    {
      code: "NORMALIZED",
      title: "Tozalash / normalize",
      text: `${metrics.trimmed_values ?? 0} trim, ${metrics.blank_to_null ?? 0} blank -> NULL amali bajarildi.`,
      state: executed ? "done" : "waiting",
    },
    {
      code: "IMPUTATION_EDIT",
      title: "Imputatsiya / Edit",
      text: `${imputed} ta bo'sh qiymat column default/hisoblangan qiymat bilan to'ldirildi. Kerak bo'lsa operator shu recordni qo'lda edit qiladi.`,
      state: executed ? "done" : "waiting",
    },
    {
      code: "MANUAL_CORRECTION",
      title: "Qo'lda tuzatishlar",
      text: `${applied} ta tuzatish qo'llandi, ${rejected} ta tuzatish rad etildi. Raw data buzilmaydi.`,
      state: !executed ? "waiting" : hasWarnings ? "warning" : "done",
    },
    {
      code: "PREPARED_VERSION_SAVED",
      title: "Prepared version saqlandi",
      text: `Yangi versiya MinIO pathga yozildi: ${preparedKey}`,
      state: executed ? "done" : "waiting",
    },
    {
      code: "QUALITY_GATE",
      title: "DWH oldi quality gate",
      text: "Prepared version Great Expectations validatsiyasidan o'tgandan keyin keyingi stepga uzatiladi.",
      state: executed ? "ready" : "waiting",
    },
    {
      code: "READY_FOR_DWH",
      title: "Data Warehousega ketish statusi",
      text: executed
        ? "Status: READY_FOR_DWH. Keyingi bosqichlar shu prepared versiondan Curated Zone va ClickHouse DWH ga data yuboradi."
        : "Status: WAITING_INPUT. Hali prepared version yaratilmagan, DWH ga yuborilmaydi.",
      state: executed ? "ready" : "waiting",
    },
  ];

  return (
    <section className="preparationLifecycle">
      <div className="detailTitle">
        <Icon name="workflow" />
        <strong>Data Preparation statuslari</strong>
        <span className={["prepGate", executed ? "ready" : "waiting"].join(" ")}>{executed ? "READY FOR DWH" : "WAITING"}</span>
      </div>
      <div className="prepVersionBox">
        <span>
          <strong>Version</strong>
          <b>{executed ? "prepared v1" : "version kutilmoqda"}</b>
        </span>
        <span>
          <strong>Saqlash joyi</strong>
          <code>{preparedKey}</code>
        </span>
        <span>
          <strong>Qoida</strong>
          <b>{"Raw immutable -> Prepared version -> Quality -> DWH"}</b>
        </span>
      </div>
      <div className="recordVersionTable">
        <div className="recordVersionHead">
          <strong>Har bir ma'lumotning version ID lari</strong>
          <span>{recordVersions.length || 0} record preview</span>
        </div>
        <div className="recordVersionRows">
          {recordVersions.length ? recordVersions.map((item) => {
            const selected = selectedVersionId === item.preparedVersion;
            return (
              <button
                type="button"
                key={item.recordId}
                className={["recordVersionRow", selected ? "selected" : ""].join(" ")}
                onClick={() => onSelectVersion(item.preparedVersion)}
              >
                <span>
                  <strong>record_id</strong>
                  <code>{item.recordId}</code>
                </span>
                <span>
                  <strong>Raw</strong>
                  <code>{item.rawVersion}</code>
                </span>
                <span>
                  <strong>Prepared tanlanadi</strong>
                  <code>{item.preparedVersion}</code>
                </span>
                <span>
                  <strong>Quality</strong>
                  <code>{item.qualityVersion}</code>
                </span>
                <span>
                  <strong>DWH</strong>
                  <code>{item.dwhVersion}</code>
                </span>
                <b>{selected ? "SELECTED_VERSION" : item.status}</b>
              </button>
            );
          }) : (
            <article className="recordVersionEmpty">Pipeline ishga tushgandan keyin har bir record uchun version_id lar shu yerda chiqadi.</article>
          )}
        </div>
        {stage.id === "imputation" && (
          <div className={["versionGateControl", awaitingVersionSelection ? "paused" : ""].join(" ")}>
            <div>
              <strong>{awaitingVersionSelection ? "Process shu joyda to'xtadi" : "Version gate"}</strong>
              <span>{selectedVersionId ? `Tanlangan version: ${selectedVersionId}` : "Prepared version ID tanlang"}</span>
            </div>
            <button type="button" onClick={onContinue} disabled={!awaitingVersionSelection || !selectedVersionId}>
              <Icon name="play" /> Continue to Quality
            </button>
          </div>
        )}
      </div>      <div className="prepVersionTimeline">
        {versionRows.map((item) => (
          <article key={item.version} className={["prepVersionCard", item.status.toLowerCase()].join(" ")}>
            <span>{item.version}</span>
            <div>
              <strong>{item.title}</strong>
              <em>{item.status}</em>
              <p>{item.note}</p>
              <code>{item.path}</code>
            </div>
          </article>
        ))}
      </div>
      <ol className="prepLifecycleList">
        {lifecycle.map((item, index) => (
          <li key={item.code} className={item.state}>
            <span>{String(index + 1).padStart(2, "0")}</span>
            <div>
              <strong>{item.title}</strong>
              <em>{item.code}</em>
              <p>{item.text}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
function StageProcessSidebar({
  stage,
  result,
  active,
}: {
  stage: StageMeta;
  result?: StageResult;
  active: boolean;
}) {
  const processes = processMap[stage.id] ?? [];
  const fallbackStatus = stageCodeSamples[stage.id]?.status === "not_connected" ? "NOT CONNECTED" : "AVAILABLE";
  const status = result
    ? result.status === "done" ? "REAL EXECUTED" : result.status === "error" ? "ERROR" : "WARNING"
    : fallbackStatus;

  return (
    <aside className={["stageProcessSidebar", active ? "active" : ""].join(" ")}>
      <header>
        <div><Icon name="workflow" /><span>Process</span></div>
        <strong>{status}</strong>
      </header>
      <ol>
        {processes.map((process, index) => (
          <li key={process} style={{ "--process-index": index } as CSSProperties}>
            <span>{String(index + 1).padStart(2, "0")}</span>
            <div>
              <strong>{process}</strong>
              <small>{result ? result.status : "asset"}</small>
            </div>
            <i />
          </li>
        ))}
      </ol>
      <footer>
        <span>Duration</span>
        <strong>{result ? formatDuration(result.duration_ms) : "-"}</strong>
        <span>Output</span>
        <code>{result?.output_ref ?? "not executed"}</code>
      </footer>
    </aside>
  );
}

function StageDescriptionBlock({ stage }: { stage: StageMeta }) {
  const description = stageDescriptions[stage.id];

  if (!description) return null;

  return (
    <section className="stageDescription">
      <div className="detailTitle"><Icon name="server" /><strong>Tavsif</strong></div>
      <div className="descriptionGrid">
        <DescriptionItem label="Nima uchun kerak" value={stagePresentationTexts[stage.id] ?? description.does} wide />
        <DescriptionItem label="Nima qiladi" value={description.does} />
        <DescriptionItem label="Data oqimi" value={description.flow} />
        <DescriptionItem label="Natija" value={description.result} />
        {description.note && <DescriptionItem label="Izoh" value={description.note} />}
      </div>
    </section>
  );
}

function DescriptionItem({ label, value, wide = false }: { label: string; value: string; wide?: boolean }) {
  return (
    <div className={["descriptionItem", wide ? "wide" : ""].join(" ")}>
      <span>{label}</span>
      <p>{value}</p>
    </div>
  );
}
function StageRunState({ stage, result }: { stage: StageMeta; result?: StageResult }) {
  if (!result) {
    const codeStatus = stageCodeSamples[stage.id]?.status;
    if (codeStatus === "not_connected") {
      return (
        <div className="runState error">
          <Icon name="alert" />
          <span><strong>NOT CONNECTED</strong> - Bu texnologiya arxitekturada bor, lekin hozirgi repository va manual API run bilan ulanmagan.</span>
        </div>
      );
    }
    return (
      <div className="runState available">
        <Icon name="clock" />
        <span><strong>AVAILABLE</strong> - Kod yoki servis asseti mavjud, ammo shu manual API run ichida bajarilmadi.</span>
      </div>
    );
  }

  return (
    <div className={`runState ${result.status}`}>
      <Icon name={result.status === "done" ? "check" : result.status === "warning" ? "alert" : "alert"} />
      <span><strong>{result.status === "done" ? "REAL EXECUTED" : result.status === "error" ? "TEST ERROR" : "REAL WARNING"}</strong> - {result.duration_ms}ms - {result.message}</span>
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
        <TransformationFlow
          inputRef={inputRef}
          outputRef={outputRef}
          input={inputPreview}
          output={outputPreview}
        />
        <DataDiffView input={inputPreview} output={outputPreview} />
        <DetailCard title="Metrics" icon="chart" data={metrics} />
        <CodePanel stage={stage} />
        <DetailCard title="Artifacts / Code" icon="code" data={artifacts} wide />
        <DetailCard title="Raw stage JSON" icon="server" data={result ?? fallback ?? { status: "idle" }} wide />
      </div>
    </div>
  );
}

function TransformationFlow({
  inputRef,
  outputRef,
  input,
  output,
}: {
  inputRef?: string | null;
  outputRef?: string | null;
  input?: unknown;
  output?: unknown;
}) {
  return (
    <article className="detailCard wide transformationCard">
      <div className="detailTitle"><Icon name="workflow" /><strong>Input to Output</strong></div>
      <div className="transformationFlow">
        <section className="flowColumn input">
          <header><span>01</span><strong>Oldin / Input</strong></header>
          {inputRef && <code className="refLine">{inputRef}</code>}
          <JsonBlock value={input} />
        </section>
        <span className="flowArrow"><Icon name="route" /></span>
        <section className="flowColumn output">
          <header><span>02</span><strong>Keyin / Output</strong></header>
          {outputRef && <code className="refLine">{outputRef}</code>}
          <JsonBlock value={output} />
        </section>
      </div>
    </article>
  );
}

type DiffRow = {
  field: string;
  before: unknown;
  after: unknown;
  state: "added" | "removed" | "changed" | "same";
};

function DataDiffView({ input, output, title = "O'zgargan fieldlar" }: { input: unknown; output: unknown; title?: string }) {
  const rows = buildDiffRows(input, output);
  const changed = rows.filter((row) => row.state !== "same").length;

  return (
    <article className="detailCard wide diffCard">
      <div className="detailTitle">
        <Icon name="layers" />
        <strong>{title}</strong>
        <span className="diffCount">{changed} changed</span>
      </div>
      <div className="diffTable">
        <div className="diffHeader"><span>Field</span><span>Oldin</span><span>Keyin</span><span>Holat</span></div>
        {rows.length ? rows.map((row) => (
          <div className={["diffRow", row.state].join(" ")} key={row.field}>
            <code>{row.field}</code>
            <span>{formatDiffValue(row.before)}</span>
            <span>{formatDiffValue(row.after)}</span>
            <em>{row.state}</em>
          </div>
        )) : <div className="diffEmpty">Taqqoslash uchun record mavjud emas.</div>}
      </div>
    </article>
  );
}

function CodePanel({ stage }: { stage: StageMeta }) {
  const sample = stageCodeSamples[stage.id];
  if (!sample) return null;
  const statusLabel = sample.status === "real" ? "REAL CODE" : sample.status === "asset" ? "AVAILABLE ASSET" : "NOT CONNECTED";

  return (
    <article className="detailCard codePanel">
      <div className="detailTitle codeTitle">
        <Icon name="code" />
        <strong>Technology code</strong>
        <span className={["codeStatus", sample.status].join(" ")}>{statusLabel}</span>
      </div>
      <div className="codeMeta"><code>{sample.file}</code><span>{sample.language}</span></div>
      <SyntaxCode code={sample.code} language={sample.language} />
    </article>
  );
}

function SyntaxCode({ code, language }: { code: string; language: string }) {
  return (
    <pre className={["syntaxCode", language].join(" ")}><code>
      {code.split("\n").map((line, index) => (
        <span className="codeLine" key={index}>
          <i>{String(index + 1).padStart(2, "0")}</i>
          <span>{highlightCodeLine(line)}</span>
        </span>
      ))}
    </code></pre>
  );
}

function highlightCodeLine(line: string): React.ReactNode[] {
  const pattern = /(#.*$|--.*$|"(?:\\.|[^"])*"|'(?:\\.|[^'])*'|\b(?:async|await|def|class|return|if|else|for|in|from|import|try|except|with|as|select|insert|into|values|update|set|on|conflict|group|by|create|table|true|false|const|let|function|export|new)\b|\b\d+(?:\.\d+)?\b)/gi;
  const nodes: React.ReactNode[] = [];
  let cursor = 0;

  for (const match of line.matchAll(pattern)) {
    const index = match.index ?? 0;
    if (index > cursor) nodes.push(line.slice(cursor, index));
    const token = match[0];
    const className = token.startsWith("#") || token.startsWith("--")
      ? "comment"
      : token.startsWith('"') || token.startsWith("'")
        ? "string"
        : /^\d/.test(token)
          ? "number"
          : "keyword";
    nodes.push(<span className={className} key={index}>{token}</span>);
    cursor = index + token.length;
  }

  if (cursor < line.length) nodes.push(line.slice(cursor));
  return nodes;
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

function buildDiffRows(input: unknown, output: unknown): DiffRow[] {
  const before = flattenComparable(input);
  const after = flattenComparable(output);
  const fields = [...new Set([...Object.keys(before), ...Object.keys(after)])].slice(0, 24);

  return fields.map((field) => {
    const beforeValue = before[field];
    const afterValue = after[field];
    let state: DiffRow["state"] = "same";
    if (!(field in before)) state = "added";
    else if (!(field in after)) state = "removed";
    else if (JSON.stringify(beforeValue) !== JSON.stringify(afterValue)) state = "changed";
    return { field, before: beforeValue, after: afterValue, state };
  });
}

function flattenComparable(value: unknown): Record<string, unknown> {
  const record = pickComparableRecord(value);
  if (!record) return {};
  const flattened: Record<string, unknown> = {};

  Object.entries(record).forEach(([key, item]) => {
    if (item && typeof item === "object" && !Array.isArray(item)) {
      Object.entries(item as Record<string, unknown>).forEach(([nestedKey, nestedValue]) => {
        flattened[key + "." + nestedKey] = nestedValue;
      });
    } else {
      flattened[key] = item;
    }
  });
  return flattened;
}

function pickComparableRecord(value: unknown): Record<string, unknown> | null {
  if (Array.isArray(value)) {
    const first = value[0];
    return first && typeof first === "object" ? first as Record<string, unknown> : null;
  }
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  if (Array.isArray(record.sample) && record.sample[0] && typeof record.sample[0] === "object") {
    return record.sample[0] as Record<string, unknown>;
  }
  if (record.event && typeof record.event === "object") {
    return record.event as Record<string, unknown>;
  }
  return record;
}

function formatDiffValue(value: unknown): string {
  if (value === undefined) return "--";
  const formatted = typeof value === "object" ? JSON.stringify(value) : String(value);
  return formatted.length > 90 ? formatted.slice(0, 90) + "..." : formatted;
}

function getStageRecordCount(stage: StageResult, fallback: number): number {
  const keys = ["records_received", "records_written", "records_in_event", "input_rows", "output_rows", "inserted_rows", "records"];
  for (const key of keys) {
    const value = stage.metrics?.[key];
    if (typeof value === "number") return value;
  }
  return fallback;
}

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

function formatStageTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--:--:--";
  return date.toLocaleTimeString("uz-UZ", {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    fractionalSecondDigits: 3,
  });
}

function formatDuration(durationMs: number): string {
  if (durationMs < 1000) return durationMs + " ms";
  return (durationMs / 1000).toFixed(2) + " s";
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values)];
}

function getPlaybackStages(result: PipelineResult): StageMeta[] {
  const failureIndex = result.failed_stage ? PLAYBACK_ORDER.indexOf(result.failed_stage) : -1;
  const allowedIds = failureIndex >= 0 ? PLAYBACK_ORDER.slice(0, failureIndex + 1) : PLAYBACK_ORDER;
  return allowedIds
    .map((stageId) => stageCatalog.find((stage) => stage.id === stageId))
    .filter((stage): stage is StageMeta => Boolean(stage));
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
  close: <><path d="M6 6l12 12" /><path d="M18 6L6 18" /></>,
};
