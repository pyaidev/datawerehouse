"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { HealthResponse, LineageRecord, ManualCorrection, PipelineResult, QualityCheck, SourcesResponse, StageResult } from "../lib/types";
import { stageCodeSamples } from "../lib/stage-code";

import type { CSSProperties } from "react";

type Mode = "batch" | "stream" | "api";
type View = "raw" | "prepared" | "curated";
type FailureStage = "none" | "kafka" | "gx" | "clickhouse";
type ResultModalStageId = "preparation" | "trino" | "superset" | "api";

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
  { id: "source", label: "Ma'lumot manbalari", layer: "Sources", detail: "4 ta manbadan bittasini tanlab pipeline run qilinadi", icon: "layers", color: "#475569" },
  { id: "fastapi", label: "FastAPI Gateway", layer: "Gateway", detail: "Source API dan data qabul qiladi", icon: "api", color: "#159570" },
  { id: "kafka", label: "NiFi / Kafka Ingestion", layer: "Ingestion", detail: "Flow routing va ingestion event", icon: "stream", color: "#252b36" },
  { id: "landing", label: "MinIO Landing / Raw", layer: "Data Lake", detail: "Original payload va raw rows MinIO ga yoziladi", icon: "bucket", color: "#2e8b57" },
  { id: "preparation", label: "Data Preparation / Imputation", layer: "Prepare", detail: "Profiling, null to'ldirish, edit va version", icon: "workflow", color: "#0e7490" },
  { id: "gx", label: "Quality Gate", layer: "Quality", detail: "DWH oldidan data quality nazorati", icon: "shield", color: "#16a34a" },
  { id: "spark", label: "Transform / Curated Model", layer: "Model", detail: "Business schema va curated data", icon: "spark", color: "#f97316" },
  { id: "warehouse", label: "Warehouse Modeling", layer: "SQL Model", detail: "dbt, fact/dimension va KPI modellari", icon: "code", color: "#e05d44" },
  { id: "clickhouse", label: "ClickHouse DWH", layer: "DWH", detail: "Analytical table va real batch load", icon: "warehouse", color: "#d99b00" },
  { id: "postgres", label: "PostgreSQL Audit", layer: "Audit", detail: "Run metadata va monitoring auditi", icon: "database", color: "#336791" },
  { id: "trino", label: "Trino Query", layer: "Query", detail: "Bir nechta storage va bazada ad-hoc SQL", icon: "search", color: "#7c3aed" },
  { id: "superset", label: "Apache Superset", layer: "BI", detail: "ClickHouse datasetidan dashboard va KPI", icon: "chart", color: "#16a6a1" },
  { id: "api", label: "Visualization / Delivery", layer: "Delivery", detail: "Portal, API va export natijasi", icon: "globe", color: "#2563eb" },
];

const PRIMARY_SOURCE_OPTIONS: Array<{ id: string; label: string; detail: string; icon: IconName }> = [
  { id: "products", label: "eStat 4.0", detail: "12-korxona / Iyun CSV", icon: "database" },
  { id: "local_null_products", label: "Local Test API", detail: "Null qiymatli JSON", icon: "api" },
  { id: "users", label: "SIAT API", detail: "Idoralar integratsiyasi", icon: "route" },
  { id: "carts", label: "Planshet Survey", detail: "Birlamchi survey data", icon: "layers" },
];

const SCENARIO_WIDTH = 1620;
const SCENARIO_HEIGHT = 760;

const scenarioNodes: ScenarioNode[] = [
  { id: "source", x: 135, y: 305 },
  { id: "fastapi", x: 320, y: 260 },
  { id: "kafka", x: 480, y: 260 },
  { id: "landing", x: 640, y: 260 },
  { id: "preparation", x: 800, y: 260 },
  { id: "gx", x: 960, y: 260 },
  { id: "spark", x: 1120, y: 260 },
  { id: "warehouse", x: 1280, y: 260 },
  { id: "clickhouse", x: 1450, y: 260 },
  { id: "postgres", x: 1450, y: 525 },
  { id: "trino", x: 1270, y: 525 },
  { id: "superset", x: 1090, y: 525 },
  { id: "api", x: 910, y: 525 },
];

const scenarioEdges: ScenarioEdge[] = [
  { from: "source", to: "fastapi" },
  { from: "fastapi", to: "kafka" },
  { from: "kafka", to: "landing" },
  { from: "landing", to: "preparation" },
  { from: "preparation", to: "gx" },
  { from: "gx", to: "spark" },
  { from: "spark", to: "warehouse" },
  { from: "warehouse", to: "clickhouse" },
  { from: "clickhouse", to: "postgres", kind: "branch" },
  { from: "clickhouse", to: "trino" },
  { from: "clickhouse", to: "superset", kind: "branch" },
  { from: "clickhouse", to: "api", kind: "branch" },
];

const processImages: Record<string, string> = {
  source: "/process-images/source.svg",
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
  warehouse: "/process-images/dbt.svg",
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
  source: ["4 ta source ro'yxati", "Bitta manbani tanlash", "Source ID ni run requestga berish"],
  fastapi: ["Request body validate", "DummyJSON endpoint call", "Payload normalize"],
  nifi: ["FlowFile create", "Route source", "Attach metadata"],
  kafka: ["NiFi route/source metadata", "Build Kafka event", "Publish ingestion signal", "Notify downstream services"],
  landing: ["Write original landing JSON", "Normalize collection rows", "Write raw.json", "Return MinIO paths"],
  preparation: ["PROFILED: column/type profile", "NORMALIZED: trim/null cleanup", "IMPUTATION_EDIT: null qiymatlarni toldirish", "VERSION_GATE: prepared version tanlash"],
  gx: ["Record count", "Primary key", "Schema and null threshold"],
  spark: ["Read prepared version", "Map business fields", "Create curated model", "Write curated JSON"],
  warehouse: ["Build staging model", "Create fact/dimension", "Calculate KPI rules", "Run SQL tests"],
  clickhouse: ["Receive modeled batch", "Create analytical table", "Insert curated rows", "Expose query metrics"],
  postgres: ["Create audit table", "Upsert run", "Store warnings"],
  airflow: ["DAG trigger", "Quality gate", "Lineage print"],
  dbt: ["Build staging", "Build mart", "Run tests"],
  superset: ["GET /health", "Authenticate REST API", "Ensure ClickHouse database", "Ensure curated_events dataset"],
  trino: ["POST /v1/statement", "Route ClickHouse catalog", "Execute run SQL", "Return result metrics"],
  api: ["Portal view", "API response", "Export options"],
  portal: ["Load view model", "Render table", "Render operations"],
  export: ["Select format", "Build file", "Publish download"],
};


const stageDescriptions: Record<string, StageDescription> = {
  source: {
    does: "Operator 4 ta asosiy ma'lumot manbasidan bittasini tanlaydi va pipeline shu source ID bilan ishga tushadi.",
    flow: "Tanlangan source endpoint, collection va entity metadata FastAPI requestga qo'shiladi.",
    result: "Bitta aniq source aktiv bo'ladi; qolganlari tanlanmagan holatda turadi va run faqat aktiv manbadan data oladi.",
    note: "Demo uchun Local Test API, eStat 4.0, SIAT API va Planshet Survey ko'rsatiladi.",
  },
  fastapi: {
    does: "Frontenddan kelgan pipeline requestni qabul qiladi, source va limitni tekshiradi va tanlangan manbadan real payload oladi. Default eStat manbasi 12-korxona Iyun CSV yozuvlarini JSON API sifatida qaytaradi.",
    flow: "Request Next proxy orqali FastAPI backendga o'tadi; eStat tanlanganda CSV parser limit/skip bo'yicha yozuvlarni o'qiydi, null qiymatlarni saqlaydi va raw rows uchun normalize qiladi.",
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
    does: "Raw datani DWHga yuborishdan oldin profil qiladi, tozalaydi, null qiymatlarni to'ldiradi, qo'lda edit va prepared version tanlashni boshqaradi.",
    flow: "Raw rows o'qiladi, column profile olinadi, blank/null qiymatlar normalize qilinadi, imputation rules ishlaydi va operator tanlagan prepared version quality gatega uzatiladi.",
    result: "Prepared version, imputed values, manual edit audit va record version ID lari tayyor bo'ladi.",
    note: "Oldingi Data Preparation va Imputatsiya/Edit UI uchun bitta stepga birlashtirildi; backendda metrikalar preparation stage ichida qaytadi.",
  },
  gx: {
    does: "Prepared data sifatini tekshiradi: record count, id mavjudligi, schema bo'sh emasligi va null threshold.",
    flow: "Prepared rows validatorga beriladi, har bir quality rule pass/fail natija qaytaradi.",
    result: "Quality score va checks list hosil bo'ladi; UI dagi Quality panel shu natijani ko'rsatadi.",
  },
  spark: {
    does: "Prepared datani business-ready curated modelga aylantiradi va shu modelni saqlashga tayyorlaydi.",
    flow: "Prepared rows transform qilinadi, entity/category/metric fieldlar yaratiladi va curated JSON model hosil bo'ladi.",
    result: "ClickHouse va dashboardlar ishlatadigan yagona curated schema paydo bo'ladi.",
    note: "PySpark transform va Curated Zone UI uchun bitta Transform / Curated Model stepiga birlashtirildi.",
  },
  warehouse: {
    does: "Curated datani warehouse business modeliga moslaydi: staging, fact/dimension, KPI va business rule SQL qatlamlarini tayyorlaydi.",
    flow: "dbt staging model curated schema'ni qabul qiladi, keyin fact/dimension va KPI mart modellari build hamda test qilinadi.",
    result: "ClickHouse yuklashi uchun tartibli, testdan o'tgan warehouse SQL modeli tayyor bo'ladi.",
    note: "dbt project va SQL model assetlari mavjud; manual API run ichida dbt CLI alohida ishga tushmaydi.",
  },
  clickhouse: {
    does: "Warehouse modelidan chiqqan tayyor datani analitik ClickHouse bazasiga real batch sifatida yuklaydi.",
    flow: "ClickHouse curated_events table yaratiladi yoki topiladi va modelga mos curated rows batch insert qilinadi.",
    result: "Dashboard, KPI va tezkor analytical querylar uchun ClickHouse ichida real DWH jadvali paydo bo'ladi.",
    note: "Bu step modeling qilmaydi; uning vazifasi tayyor modelni saqlash va analytical queryga berish.",
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
    does: "ClickHouse DWHni BI database sifatida ulaydi, curated_events datasetini ro'yxatdan o'tkazadi va har bir run uchun real dashboard hamda table chart yaratadi.",
    flow: "Pipeline Superset healthni tekshiradi, REST API orqali login qiladi, database/datasetni ensure qiladi, keyin run_id filterli chart va dashboard layoutini yaratadi.",
    result: "Real database_id, dataset_id, dashboard_id, chart_id va dashboard URL qaytadi; modal shu dashboardni iframe orqali ochadi.",
    note: "Superset Docker service 8087 portda ishlaydi. Service ishlamasa bu step WARNING beradi, REAL EXECUTED deb ko'rsatilmaydi.",
  },
  trino: {
    does: "ClickHouse catalogi ustidan distributed SQL bajarib, aynan joriy run DWHga real yozilganini tekshiradi.",
    flow: "Backend Trino /v1/statement endpointiga SQL yuboradi; Trino clickhouse.dwh.curated_events jadvaliga query route qiladi va result pagesni qaytaradi.",
    result: "query_id, records, metric_sum, source_count va query stats real Trino javobidan olinadi.",
    note: "Trino Docker service 8089 portda ishlaydi va ClickHouse catalogi statik properties fayli bilan ulangan.",
  },
  api: {
    does: "Tayyor warehouse natijasini foydalanuvchi va tashqi tizimlarga real API orqali ko'rsatish yoki uzatish qatlamini bildiradi.",
    flow: "Superset va Trino qatlamlaridan keyin portal /delivery/runs/{run_id} endpointini chaqiradi va ClickHouse rowlarini version/dw_id kontekstida ko'rsatadi.",
    result: "Rahbariyat dashboard natijasini ko'radi, tashqi tizimlar esa run_id bo'yicha real ClickHouse JSON API yoki export orqali tayyor datani oladi.",
    note: "Superset va Trino endi xaritada alohida step; bu yakuniy step portal, API va export natijasini birlashtiradi.",
  },
};
const stagePresentationTexts: Record<string, string> = {
  source: "Pipeline qaysi tizimdan data olayotgani boshidan aniq bo'lishi kerak. Operator 4 ta source ichidan bittasini tanlaydi; tanlangan source ID, endpoint va collection keyingi FastAPI requestga uzatiladi.",
  fastapi: "Barcha source data bitta nazoratli kirish nuqtasidan o\'tishi kerak. FastAPI source va limitni tekshiradi; default eStat source uchun 12-korxona Iyun CSV faylidan null qiymatlari saqlangan real JSON payload yaratadi va pipeline run_id bilan ishni boshlaydi.",
  nifi: "Productionda source'lar ko'p bo'ladi va ularni qo'lda ulash qiyin. NiFi routing, filtering va flow boshqaruvi uchun kerak. Demo ichida bu alohida ishga tushmagan, lekin real tizimda qaysi source qayerga borishini NiFi boshqaradi.",
  kafka: "Source kop bolsa routing va event signal alohida boshqarilishi kerak. NiFi data oqimini marshrutlash goyasini beradi, Kafka esa ingestion eventni uzatadi.",
  landing: "Bu bosqich original payload va ishlov beriladigan raw rowlarni MinIO data lake ichida birga saqlaydi. Landing qismi audit uchun asl JSONni saqlaydi, Raw qismi esa keyingi Data Preparation ishlashi uchun row formatni tayyorlaydi. Shu sababli UIda bitta MinIO Landing / Raw step sifatida ko'rsatiladi.",
  raw: "Original payload ko'pincha ichma-ich JSON bo'ladi, pipeline esa rowlar bilan ishlaydi. Raw Zone collectionni ajratadi va xom rowlar sifatida saqlaydi. Bu hali biznes model emas, lekin keyingi profiling va tozalash uchun qulay format.",
  preparation: "Xom data DWHga togridan-togri ketmasligi kerak. Bu step profiling, cleanup, null imputation, manual edit va version tanlashni bitta nazorat nuqtasiga yigadi. Quality gatega faqat tanlangan prepared version otadi.",
  imputation: "DWHga null yoki sifatsiz qiymatlar nazoratsiz ketmasligi kerak. Bu step missing fieldlarni topadi, hisoblangan/default qiymat bilan to'ldiradi va kerak bo'lsa operator qo'lda tuzatadi. Shu joyda flow to'xtab, prepared version tanlangandan keyin qualityga o'tadi.",
  gx: "Tozalangan data ham DWHga kirishdan oldin quality gate'dan o'tishi kerak. Great Expectations record count, id, schema va null threshold kabi qoidalarni tekshiradi. Xato bo'lsa DWHga noto'g'ri data ketmasdan shu yerda to'xtaydi.",
  airflow: "Productionda pipeline tugmani bosib emas, jadval yoki event asosida avtomatik yurishi kerak. Airflow DAG, retry, schedule va task statusni boshqaradi. Demo manual run bilan ko'rsatilgan, Airflow esa orchestration qatlami sifatida tayyor turadi.",
  spark: "Prepared data hali analytics modeli emas. Transform / Curated Model stepi uni business schemaga otkazadi va qayta ishlatish uchun curated model sifatida saqlaydi. Shundan keyin DWH bir xil formatdagi datani qabul qiladi.",
  curated: "Transform natijasini faqat xotirada qoldirib bo'lmaydi. Curated Zone business-ready datani qayta ishlatish, replay qilish va warehousega qayta yuklash uchun saqlaydi. Bu Rawdan farqli ravishda dashboard va DWHga yaqin model.",
  dbt: "Warehouse ichida SQL model, fact/dimension va KPI qoidalari tartibli saqlanishi kerak. dbt shu modeling qatlamini standartlashtiradi. Demo transformni backend bajargan, dbt esa productionda SQL model va testlarni boshqaradi.",
  warehouse: "Curated data DWHga yozilishidan oldin fact/dimension, KPI va business rule bo'yicha tartibli SQL modelga aylanishi kerak. Warehouse Modeling stepi dbt assetlari orqali aynan shu mantiqiy modelni tayyorlaydi.",
  clickhouse: "Warehouse Modeling tayyorlagan data katta hajmdagi analytical querylar uchun fizik DWH bazasiga yuklanadi. ClickHouse stepi real table yaratish, batch insert va tez aggregatsiya so'rovlarini ta'minlaydi.",
  postgres: "Pipeline natijasining auditi alohida saqlanishi kerak. PostgreSQL run_id, status, records, quality_score va warninglarni yozadi. Bu DWH datasi emas, balki jarayonni kuzatish va troubleshooting uchun operational metadata.",
  superset: "Rahbariyat va analitiklar DWHdagi datani dashboard orqali ko'rishi kerak. Pipeline Superset REST API orqali ClickHouse connection va curated_events datasetini real yaratadi yoki mavjudini topadi. O'ng panelda database_id, dataset_id va Explore URL chiqadi.",
  trino: "Ayrim holatda bir nechta storage va database ustidan ad-hoc SQL qilish kerak bo'ladi. Trino ClickHouse catalogiga real ulangan va joriy run uchun count hamda metric_sum querysini bajaradi. Natijadagi query_id va rows o'ng panelda ko'rinadi.",
  api: "DWH natijasi faqat bazada qolmasligi kerak. Visualization / Delivery stepi yakuniy portal, API response va export natijasini ko'rsatadi. Superset BI va Trino query qatlamlari xaritada undan oldin alohida ko'rsatiladi.",
  portal: "Foydalanuvchi pipeline holatini bitta oynada ko'rishi kerak. Portal run qilish, step statusi, timeline, lineage, preview va xatoliklarni ko'rsatadi. Bu demo'da rahbariyat ko'rayotgan asosiy web interfeys shu.",
  export: "Ayrim foydalanuvchilar data yoki hisobotni fayl ko'rinishida olishni xohlaydi. Export CSV, Excel, PDF yoki JSON chiqarish uchun kerak. Demo scope'da bu hali ulanmagan, shuning uchun NOT CONNECTED holatda ko'rsatilgan.",
};
const staticStageDetails: Record<string, StaticStageDetail> = {
  source: {
    input_ref: "Operator source selection",
    output_ref: "PipelineRunRequest.source",
    input_preview: { available_sources: ["products", "local_null_products", "users", "carts"] },
    output_preview: { selected_source: "UI da tanlangan source ID" },
    artifacts: { endpoint: "GET /sources", selection: "frontend scenario source step" },
  },
  fastapi: {
    input_ref: "POST http://localhost:8000/pipeline/run",
    output_ref: "backend/app/pipeline.py -> extract()",
    input_preview: { body: { source: "products", limit: "1..100", mode: "api" } },
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
    input_preview: { operation: "profile + normalize + imputation + version gate" },
    artifacts: { module: "backend/app/preparation.py", persisted_object: "prepared.json", raw_immutable: true, includes: ["Data Preparation", "Imputatsiya / Edit"] },
  },
  gx: { artifacts: { validator: "backend/app/quality.py", checks: ["record_count", "primary_key", "schema_not_empty", "null_threshold"] } },
  spark: { artifacts: { pyspark_job: "spark/jobs/dummyjson_curate.py", runtime_transform: "backend/app/transform.py" } },
  curated: { artifacts: { storage: "MinIO raw-zone/curated", format: "json/parquet-compatible schema" } },
  warehouse: {
    input_ref: "dbt/dwh_project/models/staging",
    output_ref: "dbt/dwh_project/models/marts",
    input_preview: { source_relation: "curated_events", transform: "staging -> fact/dimension -> KPI" },
    output_preview: { note: "Warehouse SQL model asseti tayyor; manual API run ichida dbt CLI bajarilmagan." },
    artifacts: { project: "dbt/dwh_project", includes: ["staging", "fact/dimension", "KPI", "tests"] },
  },
  clickhouse: { artifacts: { database: "dwh", table: "curated_events", code: "backend/app/databases.py", includes: ["table create", "batch insert", "analytics query"] } },
  dbt: {
    input_ref: "dbt/dwh_project/models/staging",
    output_ref: "dbt/dwh_project/models/marts",
    input_preview: { source_relation: "curated_events", transform: "SQL model" },
    output_preview: { note: "dbt project bor; bu manual API run ichida dbt CLI ishga tushirilmagan." },
    artifacts: { project: "dbt/dwh_project", models: "dbt/dwh_project/models" },
  },
  superset: {
    input_ref: "ClickHouse dwh.curated_events",
    output_ref: "http://localhost:8087/explore/",
    output_preview: { result: "database_id, dataset_id va Explore URL pipeline runtime'da qaytadi" },
    artifacts: { service: "Apache Superset", endpoint: "http://localhost:8087", driver: "clickhouse-connect", code: "backend/app/analytics.py" },
  },
  trino: {
    input_ref: "ClickHouse dwh.curated_events",
    output_ref: "http://localhost:8089/v1/statement",
    output_preview: { result: "query_id, rows va stats pipeline runtime'da qaytadi" },
    artifacts: { service: "Trino", catalog: "clickhouse", schema: "dwh", code: "backend/app/analytics.py" },
  },
  api: {
    input_ref: "Superset dashboard / Trino result / Portal state",
    output_ref: "Visualization and delivery layer",
    input_preview: { includes: ["Portal", "API Services", "Export"] },
    output_preview: { note: "Portal va JSON API real ishlaydi; file export keyingi integration sifatida ko'rsatilgan." },
    artifacts: { frontend: "Next.js", route: "frontend/app/api/backend", delivery: ["Portal", "API", "Export"] },
  },
};

const PLAYBACK_STEP_MS = 3000;
const PLAYBACK_ORDER = [
  "source",
  "fastapi",
  "kafka",
  "landing",
  "preparation",
  "gx",
  "spark",
  "warehouse",
  "clickhouse",
  "trino",
  "superset",
  "postgres",
  "api",
];

export function Dashboard() {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [sources, setSources] = useState<SourcesResponse>({});
  const [source, setSource] = useState("products");
  const mode: Mode = "api";
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
  const [resultModalStageId, setResultModalStageId] = useState<ResultModalStageId | null>(null);
  const playbackTimers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const playbackStagesRef = useRef<StageMeta[]>([]);
  const playbackIndexRef = useRef(0);
  const resultModalAutoResumeRef = useRef(false);

  useEffect(() => {
    setFrontendHost(window.location.host);
    void loadInitial();
    return () => clearPlaybackTimers();
  }, []);

  const stageResults = useMemo(() => {
    const map = new Map<string, StageResult>();
    result?.stages.forEach((stage) => map.set(stage.id, stage));
    const fastapiStage = map.get("fastapi");
    const selectedSource = sources[source];
    if (result && fastapiStage) {
      map.set("source", {
        id: "source",
        name: selectedSource?.title ?? source,
        status: "done",
        sequence: 0,
        started_at: result.started_at,
        ended_at: fastapiStage.started_at,
        duration_ms: 0,
        data_size_bytes: 0,
        data_format: "Source selection",
        message: (selectedSource?.title ?? source) + " tanlandi; collection=" + (selectedSource?.collection ?? "unknown"),
        warnings: [],
        input_ref: "GET /sources",
        output_ref: selectedSource?.endpoint ?? source,
        input_preview: PRIMARY_SOURCE_OPTIONS.map((item) => ({ id: item.id, title: sources[item.id]?.title ?? item.label })),
        output_preview: {
          selected_source: source,
          title: selectedSource?.title ?? source,
          endpoint: selectedSource?.endpoint,
          collection: selectedSource?.collection,
          entity: selectedSource?.entity,
        },
        metrics: { available_sources: PRIMARY_SOURCE_OPTIONS.length, selected: 1 },
        artifacts: { source_id: source, endpoint: selectedSource?.endpoint, collection: selectedSource?.collection },
      });
    }
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
    const spark = map.get("spark");
    const curated = map.get("curated");
    if (spark && curated) {
      const combinedStatus = spark.status === "error" || curated.status === "error"
        ? "error"
        : spark.status === "warning" || curated.status === "warning"
          ? "warning"
          : "done";
      map.set("spark", {
        ...spark,
        name: "Transform / Curated Model",
        status: combinedStatus,
        message: `${spark.message}; ${curated.message}`,
        ended_at: curated.ended_at,
        duration_ms: spark.duration_ms + curated.duration_ms,
        data_size_bytes: spark.data_size_bytes + curated.data_size_bytes,
        output_ref: curated.output_ref ?? spark.output_ref,
        output_preview: {
          transform: spark.output_preview,
          curated: curated.output_preview,
        },
        metrics: {
          ...(spark.metrics ?? {}),
          curated_records_written: curated.metrics?.records_written,
          curated_object_count: curated.metrics?.object_count,
        },
        artifacts: {
          ...(spark.artifacts ?? {}),
          curated_artifacts: curated.artifacts,
          curated_output_ref: curated.output_ref,
        },
        warnings: [...(spark.warnings ?? []), ...(curated.warnings ?? [])],
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
  }, [result, source, sources]);

  const rows = view === "raw"
    ? result?.raw_preview || []
    : view === "prepared"
      ? result?.prepared_preview || []
      : result?.curated_preview || [];
  const columns = getColumns(rows, view);
  const qualityChecks = result?.quality_checks || [];
  const activeStageResult = activeStage ? stageResults.get(activeStage.id) : undefined;
  const selectedDeliveryDwId: string | null = null;
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
    setResultModalStageId(null);
    resultModalAutoResumeRef.current = false;
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

  function savePreparedVersion(
    updatedRows: Record<string, unknown>[],
    versionId: string,
  ) {
    setResult((current) => {
      if (!current) return current;
      const preparedPreview = updatedRows.map((row, index) => ({
        ...withoutInternalVersionFields(row),
        id: row.id ?? current.prepared_preview[index]?.id ?? ("row-" + (index + 1)),
        __prepared_version_id: versionId,
      }));
      const preparedById = new Map(
        preparedPreview.map((row) => [String(row.id), withoutInternalVersionFields(row)]),
      );
      const lineage = current.lineage.map((item) => ({
        ...item,
        prepared: preparedById.get(String(item.record_id)) ?? item.prepared,
      }));
      return { ...current, prepared_preview: preparedPreview, lineage };
    });
    setSelectedVersionId(versionId);
    addLog("MANUAL_FILE_VERSION_SAVED: rows=" + updatedRows.length + "; version=" + versionId);
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
    setResultModalStageId(null);
    resultModalAutoResumeRef.current = false;
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

      if (stage.id === "preparation") {
        setPlaybackRunning(false);
        setAwaitingVersionSelection(true);
        resultModalAutoResumeRef.current = false;
        setResultModalStageId("preparation");
        addLog("WAITING_VERSION_SELECTION: Data Preparation / Imputation result modali ochildi. Version tanlang va davom ettiring.");
        return;
      }

      if (stage.id === "trino" || stage.id === "superset" || stage.id === "api") {
        setPlaybackRunning(false);
        resultModalAutoResumeRef.current = true;
        setResultModalStageId(stage.id);
        addLog(`RESULT_MODAL_OPEN: ${stage.id} real natijasi ko'rsatilmoqda.`);
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
    setResultModalStageId(null);
    resultModalAutoResumeRef.current = false;
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
  function closeResultModal() {
    const shouldResume = resultModalAutoResumeRef.current;
    resultModalAutoResumeRef.current = false;
    setResultModalStageId(null);
    if (!shouldResume) return;

    const nextIndex = playbackIndexRef.current + 1;
    if (nextIndex >= playbackStagesRef.current.length) {
      setPlaybackRunning(false);
      setPlaybackStageId(null);
      return;
    }
    setPlaybackRunning(true);
    schedulePlaybackStep(nextIndex, 0);
  }
  function selectPipelineSource(nextSource: string) {
    if (running || playbackRunning || awaitingVersionSelection) return;
    clearPlaybackTimers();
    setSource(nextSource);
    setCorrections([]);
    setResult(null);
    setPlaybackRunning(false);
    setPlaybackStageId(null);
    setVisitedStageIds([]);
    setManualStopped(false);
    setSelectedVersionId(null);
    setResultModalStageId(null);
    resultModalAutoResumeRef.current = false;
    setActiveStage(stageCatalog.find((stage) => stage.id === "source") ?? stageCatalog[0]);
    addLog("SOURCE_SELECTED: " + nextSource);
  }

  function handleStageSelect(stage: StageMeta) {
    setActiveStage(stage);
    if (stage.id === "preparation" || stage.id === "trino" || stage.id === "superset" || stage.id === "api") {
      resultModalAutoResumeRef.current = false;
      setResultModalStageId(stage.id);
      addLog(`RESULT_MODAL_OPEN_MANUAL: ${stage.id}`);
      return;
    }
    if (stage.id === "fastapi") {
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
              onChange={(event) => selectPipelineSource(event.target.value)}
              disabled={running || playbackRunning || awaitingVersionSelection}
            >
              {PRIMARY_SOURCE_OPTIONS.map((option) => (
                <option key={option.id} value={option.id}>
                  {sources[option.id]?.title ?? option.label} / {sources[option.id]?.collection ?? option.detail}
                </option>
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
            sources={sources}
            selectedSourceId={source}
            sourceSelectionDisabled={running || playbackRunning || awaitingVersionSelection}
            onSourceChange={selectPipelineSource}
            onSelect={handleStageSelect}
          />
          <ScenarioStepNotes
            stageResults={stageResults}
            visitedStageIds={visitedStageIds}
            playbackStageId={playbackStageId}
            onSelect={handleStageSelect}
          />

        </article>

        <aside className="runSidebar">
          <StageSidePanel
            stage={activeStage}
            result={activeStageResult}
            pipelineResult={result}
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

      {resultModalStageId ? (
        <ResultModal
          stageId={resultModalStageId}
          stageResult={stageResults.get(resultModalStageId)}
          pipelineResult={result}
          stageResults={stageResults}
          selectedVersionId={selectedVersionId}
          selectedDeliveryDwId={selectedDeliveryDwId}
          frontendHost={frontendHost}
          awaitingVersionSelection={awaitingVersionSelection}
          autoResume={resultModalAutoResumeRef.current}
          onClose={closeResultModal}
          onSelectVersion={setSelectedVersionId}
          onSavePreparedVersion={savePreparedVersion}
          onContinueVersion={continueAfterVersionSelection}
        />
      ) : null}
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

type DeliveryWarehouseResponse = {
  source: string;
  database: string;
  table: string;
  run_id: string;
  selected_version_id?: string | null;
  dw_id_filter?: string | null;
  records_total: number;
  metric_sum: number;
  limit: number;
  columns: string[];
  rows: Record<string, unknown>[];
};

function ResultModal({
  stageId,
  stageResult,
  pipelineResult,
  stageResults,
  selectedVersionId,
  selectedDeliveryDwId,
  frontendHost,
  awaitingVersionSelection,
  autoResume,
  onClose,
  onSelectVersion,
  onSavePreparedVersion,
  onContinueVersion,
}: {
  stageId: ResultModalStageId;
  stageResult?: StageResult;
  pipelineResult: PipelineResult | null;
  stageResults: Map<string, StageResult>;
  selectedVersionId: string | null;
  selectedDeliveryDwId: string | null;
  frontendHost: string;
  awaitingVersionSelection: boolean;
  autoResume: boolean;
  onClose: () => void;
  onSelectVersion: (versionId: string) => void;
  onSavePreparedVersion: (
    rows: Record<string, unknown>[],
    versionId: string,
  ) => void;
  onContinueVersion: () => void;
}) {
  const stage = stageCatalog.find((item) => item.id === stageId) ?? stageCatalog[0];

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && stageId !== "preparation") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [onClose, stageId]);

  return (
    <div className="resultModalBackdrop" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget && stageId !== "preparation") onClose();
    }}>
      <section className="resultModalWindow" role="dialog" aria-modal="true" aria-labelledby="result-modal-title">
        <header className="resultModalHeader">
          <span className="resultModalIcon" style={{ background: stage.color }}><Icon name={stage.icon} /></span>
          <div>
            <p>{stage.layer} result</p>
            <h2 id="result-modal-title">{stage.label}</h2>
            <span>{stageResult?.message ?? "Scenario resulti kutilmoqda"}</span>
          </div>
          <div className="resultModalHeaderState">
            <strong className={stageResult?.status ?? "waiting"}>{stageResult ? stageResult.status.toUpperCase() : "WAITING"}</strong>
            <button type="button" className="iconButton" onClick={onClose} aria-label="Result oynasini yopish" title="Yopish"><Icon name="close" /></button>
          </div>
        </header>

        <div className="resultModalBody">
          {stageId === "preparation" ? (
            <PrepareImputationDeepBlock
              result={pipelineResult}
              stageResults={stageResults}
              selectedVersionId={selectedVersionId}
              awaitingVersionSelection={awaitingVersionSelection}
              onSelectVersion={onSelectVersion}
              onSaveVersion={onSavePreparedVersion}
              onContinue={onContinueVersion}
            />
          ) : stageId === "trino" ? (
            <TrinoResultContent result={stageResult} />
          ) : stageId === "superset" ? (
            <SupersetResultContent
              result={stageResult}
              trinoResult={stageResults.get("trino")}
              frontendHost={frontendHost}
            />
          ) : (
            <DeliveryResultContent
              pipelineResult={pipelineResult}
              selectedVersionId={selectedVersionId}
              selectedDeliveryDwId={selectedDeliveryDwId}
            />
          )}
        </div>

        {stageId !== "preparation" ? (
          <footer className="resultModalFooter">
            <span>{autoResume ? "Oyna yopilganda scenario keyingi stepga davom etadi." : "Bu natija real bajarilgan stage response'idan olindi."}</span>
            <button type="button" onClick={onClose}>
              <Icon name={autoResume ? "play" : "close"} /> {autoResume ? "Yopish va davom etish" : "Yopish"}
            </button>
          </footer>
        ) : null}
      </section>
    </div>
  );
}

function TrinoResultContent({ result, compact = false }: { result?: StageResult; compact?: boolean }) {
  const output = asRecord(result?.output_preview);
  const rows = asRecordArray(output?.rows);
  const columns = asStringArray(output?.columns);
  const stats = asRecord(output?.stats);
  const query = typeof output?.query === "string" ? output.query : "Trino query hali bajarilmagan.";

  return (
    <section className={["analyticsResult", compact ? "compact" : ""].filter(Boolean).join(" ")}>
      <div className="analyticsResultKpis">
        <ReportValue label="Query ID" value={String(output?.query_id ?? "-")} />
        <ReportValue label="Catalog / schema" value={`${String(output?.catalog ?? "-")} / ${String(output?.schema ?? "-")}`} />
        <ReportValue label="Rows" value={String(result?.metrics?.records_queried ?? rows.length)} />
        <ReportValue label="Runtime" value={formatDuration(result?.duration_ms ?? 0)} />
      </div>
      <div className="sqlResultBlock">
        <div><Icon name="search" /><strong>Bajarilgan real Trino SQL</strong></div>
        <pre>{query}</pre>
      </div>
      <ResultRowsTable rows={rows} columns={columns} emptyText={result?.warnings?.[0] ?? "Trino result hali yo'q"} />
      {stats ? <div className="analyticsStatsLine">{Object.entries(stats).slice(0, 8).map(([key, value]) => <span key={key}><b>{key}</b>{formatCell(value)}</span>)}</div> : null}
    </section>
  );
}

function SupersetResultContent({
  result,
  trinoResult,
  frontendHost,
}: {
  result?: StageResult;
  trinoResult?: StageResult;
  frontendHost: string;
}) {
  const output = asRecord(result?.output_preview);
  const dashboardUrl = browserServiceUrl(
    String(output?.dashboard_url ?? result?.output_ref ?? ""),
    frontendHost,
  );
  const chartUrl = browserServiceUrl(String(output?.chart_url ?? output?.explore_url ?? ""), frontendHost);

  return (
    <section className="supersetResultLayout">
      <div className="analyticsResultKpis">
        <ReportValue label="Dashboard ID" value={String(output?.dashboard_id ?? "-")} />
        <ReportValue label="Chart ID" value={String(output?.chart_id ?? "-")} />
        <ReportValue label="Dataset ID" value={String(output?.dataset_id ?? "-")} />
        <ReportValue label="Database ID" value={String(output?.database_id ?? "-")} />
      </div>
      <div className="supersetToolbar">
        <div>
          <Icon name="chart" />
          <span><strong>Real Apache Superset dashboard</strong><small>{String(output?.dashboard_title ?? "DWH dashboard")}</small></span>
        </div>
        <div>
          {chartUrl ? <a href={chartUrl} target="_blank" rel="noreferrer">Chart / Explore</a> : null}
          {dashboardUrl ? <a href={dashboardUrl} target="_blank" rel="noreferrer">Dashboardni ochish</a> : null}
        </div>
      </div>
      {dashboardUrl && result?.status === "done" ? (
        <iframe
          className="supersetDashboardFrame"
          src={dashboardUrl}
          title="Apache Superset real dashboard"
          allow="fullscreen"
        />
      ) : (
        <div className="analyticsEmpty"><Icon name="alert" /><span><strong>Superset dashboard ochilmadi</strong>{result?.warnings?.[0] ?? "Pipeline Superset stage natijasini kutmoqda."}</span></div>
      )}
      <div className="linkedTrinoResult">
        <div className="linkedResultHead"><Icon name="search" /><span><strong>Shu run uchun Trino SQL result</strong><small>ClickHouse yozuvi distributed SQL orqali qayta tekshirildi</small></span></div>
        <TrinoResultContent result={trinoResult} compact />
      </div>
    </section>
  );
}

function DeliveryResultContent({
  pipelineResult,
  selectedVersionId,
  selectedDeliveryDwId,
}: {
  pipelineResult: PipelineResult | null;
  selectedVersionId: string | null;
  selectedDeliveryDwId: string | null;
}) {
  const [delivery, setDelivery] = useState<DeliveryWarehouseResponse | null>(null);
  const [deliveryError, setDeliveryError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const runId = pipelineResult?.run_id;
  const query = new URLSearchParams({ limit: "100" });
  if (selectedVersionId) query.set("version_id", selectedVersionId);
  if (selectedDeliveryDwId) query.set("dw_id", selectedDeliveryDwId);
  const apiUrl = runId ? `/api/backend/delivery/runs/${encodeURIComponent(runId)}?${query.toString()}` : "";

  useEffect(() => {
    if (!apiUrl) return;
    let active = true;
    setLoading(true);
    setDeliveryError(null);
    void fetchJson<DeliveryWarehouseResponse>(apiUrl)
      .then((data) => { if (active) setDelivery(data); })
      .catch((error) => { if (active) setDeliveryError(formatError(error)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [apiUrl]);

  return (
    <section className="deliveryApiResult">
      <div className="deliveryApiIntro">
        <div><Icon name="api" /><span><strong>Warehouse Delivery API</strong><small>ClickHouse curated_events jadvalidan real SELECT</small></span></div>
        {apiUrl ? <a href={apiUrl} target="_blank" rel="noreferrer">JSON API'ni ochish</a> : null}
      </div>
      <code className="deliveryApiUrl">GET {apiUrl || "/api/backend/delivery/runs/{run_id}"}</code>
      <div className="analyticsResultKpis">
        <ReportValue label="Run ID" value={runId?.slice(0, 12) ?? "-"} />
        <ReportValue label="Version" value={selectedVersionId ?? "run snapshot"} />
        <ReportValue label="Records" value={String(delivery?.records_total ?? pipelineResult?.records ?? 0)} />
        <ReportValue label="Metric sum" value={formatNumber(delivery?.metric_sum ?? 0)} />
      </div>
      {loading ? <div className="analyticsEmpty"><Icon name="refresh" /><span><strong>ClickHouse o'qilmoqda</strong>Warehouse API response kutilmoqda.</span></div> : null}
      {deliveryError ? <div className="analyticsEmpty error"><Icon name="alert" /><span><strong>Delivery API xatosi</strong>{deliveryError}</span></div> : null}
      {delivery ? <ResultRowsTable rows={delivery.rows} columns={delivery.columns} emptyText="Bu run/version uchun DWH row topilmadi" /> : null}
    </section>
  );
}

function ResultRowsTable({ rows, columns, emptyText }: { rows: Record<string, unknown>[]; columns?: string[]; emptyText: string }) {
  const visibleColumns = (columns?.length ? columns : Object.keys(rows[0] ?? {})).slice(0, 11);
  if (!rows.length) return <div className="analyticsEmpty"><Icon name="database" /><span><strong>Result bo'sh</strong>{emptyText}</span></div>;
  return (
    <div className="resultModalTableWrap">
      <table>
        <thead><tr>{visibleColumns.map((column) => <th key={column}>{column}</th>)}</tr></thead>
        <tbody>{rows.map((row, index) => <tr key={String(row.dw_id ?? row.id ?? index)}>{visibleColumns.map((column) => <td key={column}>{formatCell(row[column])}</td>)}</tr>)}</tbody>
      </table>
    </div>
  );
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function asRecordArray(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object" && !Array.isArray(item)) : [];
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function browserServiceUrl(value: string, frontendHost: string): string {
  if (!value) return "";
  try {
    const url = new URL(value);
    if ((url.hostname === "localhost" || url.hostname === "127.0.0.1") && frontendHost && frontendHost !== "loading") {
      url.hostname = frontendHost.split(":")[0];
    }
    return url.toString();
  } catch {
    return value;
  }
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("uz-UZ", { maximumFractionDigits: 2 }).format(value);
}
type DatasetVersion = {
  fileId: string;
  fileName: string;
  base: string;
  raw: string;
  prepared: string;
  integration: string;
  metrics: string;
};

type EditableDatasetVersion = {
  sourceLabel: string;
  sourceVersionId: string;
  rows: Record<string, unknown>[];
};

function withoutInternalVersionFields(record: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(record).filter(([key]) => !key.startsWith("__")));
}

function datasetFileName(result: PipelineResult): string {
  if (result.source === "products") return "12-korxona shakli_Iyun_1700_\u0432\u0441\u0435.csv";
  if (result.source === "local_null_products") return "local-null-products.json";
  if (result.source === "users") return "siat-users.json";
  if (result.source === "carts") return "planshet-survey.json";
  return result.source + "-dataset.json";
}

function buildDatasetVersion(result: PipelineResult): DatasetVersion {
  const fileName = datasetFileName(result);
  const base = result.source.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 24) || "dataset";
  const explicitPreparedVersion = result.prepared_preview.find(
    (row) => typeof row.__prepared_version_id === "string",
  )?.__prepared_version_id;
  return {
    fileId: "FILE-" + result.run_id.slice(0, 8).toUpperCase(),
    fileName,
    base,
    raw: "raw:" + base + ":v0",
    prepared: typeof explicitPreparedVersion === "string"
      ? explicitPreparedVersion
      : "prep:" + base + ":v1",
    integration: "integration:" + base + ":v2",
    metrics: "metrics:" + base + ":v3",
  };
}

function downloadVersionJson(versionId: string, payload: unknown) {
  const safeName = versionId.replace(/[^a-zA-Z0-9._-]/g, "_");
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = safeName + ".json";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function PrepareImputationDeepBlock({
  result,
  stageResults,
  selectedVersionId,
  awaitingVersionSelection,
  onSelectVersion,
  onSaveVersion,
  onContinue,
}: {
  result: PipelineResult | null;
  stageResults: Map<string, StageResult>;
  selectedVersionId: string | null;
  awaitingVersionSelection: boolean;
  onSelectVersion: (versionId: string) => void;
  onSaveVersion: (
    rows: Record<string, unknown>[],
    versionId: string,
  ) => void;
  onContinue: () => void;
}) {
  const preparation = stageResults.get("preparation");
  const imputation = stageResults.get("imputation") ?? preparation;
  const metrics = imputation?.metrics ?? {};
  const preparedRows = result?.prepared_preview ?? [];
  const datasetVersion = result ? buildDatasetVersion(result) : null;
  const [editingVersion, setEditingVersion] = useState<EditableDatasetVersion | null>(null);
  const [draftJson, setDraftJson] = useState("");
  const [editorError, setEditorError] = useState<string | null>(null);
  const [savedVersionId, setSavedVersionId] = useState<string | null>(null);

  const flow = [
    ["01", "Birlamchi ma'lumot", "Manbadan kelgan butun fayl Raw Zone da o'zgartirilmagan v0 nusxa sifatida saqlanadi."],
    ["02", "Qayta ishlangan", "Fayldagi barcha recordlar profiling, type aniqlash, trim va null normalize jarayonidan o'tadi."],
    ["03", "Imputatsiya / Edit", "Bo'sh qiymatlar to'ldiriladi. Edit butun fayl uchun yangi manual Prepared version yaratadi."],
    ["04", "Integratsiya", "Tanlangan fayl versiyasi quality check va integratsiya qoidalaridan o'tadi."],
    ["05", "Ko'rsatkichlar", "Tasdiqlangan fayldan Curated model, KPI va ClickHouse ko'rsatkichlari hosil qilinadi."],
  ];

  function beginEdit(
    sourceLabel: string,
    sourceVersionId: string,
    rows: Record<string, unknown>[],
  ) {
    const cleanRows = rows.map(withoutInternalVersionFields);
    setEditingVersion({ sourceLabel, sourceVersionId, rows: cleanRows });
    setDraftJson(JSON.stringify(cleanRows, null, 2));
    setEditorError(null);
  }

  function saveEdit() {
    if (!editingVersion || !datasetVersion) return;
    try {
      const parsed = JSON.parse(draftJson);
      if (!Array.isArray(parsed) || !parsed.length) {
        throw new Error("Fayl JSON array ko'rinishida va kamida bitta recorddan iborat bo'lishi kerak.");
      }
      const rows = parsed.map((row, index) => {
        if (!row || typeof row !== "object" || Array.isArray(row)) {
          throw new Error((index + 1) + "-record JSON object bo'lishi kerak.");
        }
        return withoutInternalVersionFields(row as Record<string, unknown>);
      });
      const revision = Date.now().toString(36).slice(-6);
      const nextVersionId = "prep:" + datasetVersion.base + ":manual-" + revision;
      onSaveVersion(rows, nextVersionId);
      onSelectVersion(nextVersionId);
      setSavedVersionId(nextVersionId);
      setEditingVersion(null);
      setEditorError(null);
    } catch (error) {
      setEditorError(formatError(error));
    }
  }

  function versionPayload(
    label: string,
    versionId: string,
    data: unknown,
  ) {
    return {
      run_id: result?.run_id ?? null,
      record_id: datasetVersion?.fileId ?? null,
      file_name: datasetVersion?.fileName ?? null,
      record_count: preparedRows.length,
      stage: label,
      version_id: versionId,
      exported_at: new Date().toISOString(),
      data,
    };
  }

  const integrationPayload = {
    rows: preparedRows.map(withoutInternalVersionFields),
    quality_score: result?.quality_score ?? 0,
    quality_checks: result?.quality_checks ?? [],
  };
  const metricsPayload = {
    rows: result?.curated_preview ?? [],
    records: result?.records ?? 0,
    quality_score: result?.quality_score ?? 0,
    curated_fields: result?.curated_fields ?? 0,
  };

  return (
    <section className="prepareDeepBlock">
      <div className="prepareDeepHead">
        <div>
          <p>Prepare stage</p>
          <h3>Imputatsiya / Edit va fayl versiyasini tanlash</h3>
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
            <ReportValue label="Records" value={String(metrics.output_rows ?? preparedRows.length)} />
            <ReportValue label="Imputed" value={String(metrics.imputed_values ?? 0)} />
            <ReportValue label="Manual edit" value={String(metrics.manual_corrections_applied ?? 0)} />
            <ReportValue label="Rejected" value={String(metrics.manual_corrections_rejected ?? 0)} />
          </div>
          <code>{imputation?.output_ref ?? "prepared.json va file version pipeline ishga tushganda chiqadi"}</code>
        </article>
      </div>

      <div className="prepareVersionSelect">
        <div className="prepareVersionTitle">
          <strong>Bitta fayl versiyasini tanlash</strong>
          <span>{selectedVersionId ? "Tanlangan: " + selectedVersionId : "Qayta ishlangan fayl versiyasi tanlanmagan"}</span>
        </div>
        {savedVersionId ? (
          <div className="prepareVersionSaved"><Icon name="check" /><span><b>Yangi manual fayl versiyasi saqlandi</b><code>{savedVersionId}</code></span></div>
        ) : null}

        {datasetVersion && preparedRows.length ? (
          <div className={["prepareVersionRow", selectedVersionId === datasetVersion.prepared ? "selected" : ""].join(" ")}>
            <span className="prepareRecordIdentity">
              <b>record_id</b>
              <code title={datasetVersion.fileId}>{datasetVersion.fileId}</code>
              <small title={datasetVersion.fileName}>{datasetVersion.fileName}</small>
              <em>{preparedRows.length} ta record</em>
            </span>

            {[
              {
                key: "raw",
                label: "Birlamchi ma'lumot",
                id: datasetVersion.raw,
                payload: result?.raw_preview ?? [],
                editRows: result?.raw_preview ?? [],
              },
              {
                key: "prepared",
                label: "Qayta ishlangan",
                id: datasetVersion.prepared,
                payload: preparedRows.map(withoutInternalVersionFields),
                editRows: preparedRows,
              },
              {
                key: "integration",
                label: "Integratsiya",
                id: datasetVersion.integration,
                payload: integrationPayload,
                editRows: preparedRows,
              },
              {
                key: "metrics",
                label: "Ko'rsatkichlar",
                id: datasetVersion.metrics,
                payload: metricsPayload,
                editRows: result?.curated_preview ?? [],
              },
            ].map((version) => (
              <div className="prepareVersionCell" key={version.key}>
                <b>{version.label}</b>
                <code title={version.id}>{version.id}</code>
                <small>{version.editRows.length} ta record</small>
                <div className="prepareVersionCellActions">
                  <button
                    type="button"
                    title={version.label + " faylini edit qilish"}
                    aria-label={version.label + " faylini edit qilish"}
                    onClick={() => beginEdit(version.label, version.id, version.editRows)}
                  >
                    <Icon name="code" /> Edit
                  </button>
                  <button
                    type="button"
                    title={version.label + " faylini yuklab olish"}
                    aria-label={version.label + " faylini yuklab olish"}
                    onClick={() => downloadVersionJson(
                      version.id,
                      versionPayload(version.label, version.id, version.payload),
                    )}
                  >
                    <Icon name="download" /> Yuklash
                  </button>
                </div>
              </div>
            ))}

            <button
              type="button"
              className="prepareVersionChoose"
              onClick={() => onSelectVersion(datasetVersion.prepared)}
            >
              <Icon name={selectedVersionId === datasetVersion.prepared ? "check" : "layers"} />
              {selectedVersionId === datasetVersion.prepared ? "TANLANGAN" : "TANLASH"}
            </button>
          </div>
        ) : (
          <div className="prepareVersionEmpty">Run scenario qiling. Barcha recordlar bitta fayl qatori sifatida shu yerda ko'rsatiladi.</div>
        )}

        {editingVersion ? (
          <section className="prepareVersionEditor">
            <header>
              <span><Icon name="code" /></span>
              <div>
                <p>{editingVersion.sourceLabel} faylidan copy-on-write</p>
                <h4>Barcha recordlar uchun yangi Prepared version</h4>
                <code>{editingVersion.sourceVersionId}</code>
              </div>
              <button type="button" className="iconButton" onClick={() => setEditingVersion(null)} title="Editni yopish" aria-label="Editni yopish"><Icon name="close" /></button>
            </header>
            <div className="prepareDatasetEditorMeta">
              <span><b>Fayl</b>{datasetVersion?.fileName}</span>
              <span><b>Recordlar</b>{editingVersion.rows.length}</span>
              <span><b>Format</b>JSON array</span>
            </div>
            <textarea
              className="prepareDatasetJsonEditor"
              value={draftJson}
              onChange={(event) => setDraftJson(event.target.value)}
              spellCheck={false}
              aria-label="Butun fayl JSON editori"
            />
            {editorError ? <div className="prepareEditorError"><Icon name="alert" />{editorError}</div> : null}
            <footer>
              <span>Asl fayl o'zgarmaydi. Saqlash barcha recordlar uchun yangi <code>prep:*:manual-*</code> versiya yaratadi.</span>
              <div>
                <button type="button" className="prepareEditorCancel" onClick={() => setEditingVersion(null)}>Bekor qilish</button>
                <button type="button" className="prepareEditorSave" onClick={saveEdit}><Icon name="check" /> Fayl versiyasini saqlash</button>
              </div>
            </footer>
          </section>
        ) : null}

        <div className="prepareContinueBar">
          <span>{awaitingVersionSelection ? "Flow shu yerda to'xtagan. Fayl versiyasini tanlang va davom ettiring." : "Imputatsiya stepga kelganda bu gate avtomatik pause qiladi."}</span>
          <button type="button" onClick={onContinue} disabled={!awaitingVersionSelection || !selectedVersionId}>
            <Icon name="play" /> Tanlangan fayl versiyasi bilan davom etish
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
  sources,
  selectedSourceId,
  sourceSelectionDisabled,
  onSourceChange,
  onSelect,
}: {
  stageResults: Map<string, StageResult>;
  visitedStageIds: string[];
  playbackStageId: string | null;
  playbackRunning: boolean;
  apiRunning: boolean;
  totalRecords: number;
  runStatus?: PipelineResult["status"];
  sources: SourcesResponse;
  selectedSourceId: string;
  sourceSelectionDisabled: boolean;
  onSourceChange: (sourceId: string) => void;
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
        <span className="canvasGroupLabel sourcesLabel">Ma'lumot manbalari</span>
        <span className="canvasGroupLabel ingestionLabel">Ingestion va data lake</span>
        <span className="canvasGroupLabel deliveryLabel">Query, BI va audit</span>
        <section className="warehouseZoneHeader" aria-label="Data Warehouse qatlami">
          <span>Analitik qatlam</span>
          <strong>DATA WAREHOUSE</strong>
          <p>Model yaratish, saqlash, SQL query, BI dataset va audit</p>
          <div>
            <b>Warehouse Modeling</b>
            <b>ClickHouse DWH</b>
            <b>Trino Query</b>
            <b>Apache Superset</b>
            <b>PostgreSQL Audit</b>
          </div>
        </section>

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

          if (stage.id === "source") {
            return (
              <section
                key={stage.id}
                className={["sourceStackNode", visualState, isVisited ? "visited" : ""].filter(Boolean).join(" ")}
                style={style}
              >
                <button type="button" className="sourceStageHeader" onClick={() => onSelect(stage)}>
                  <span className="nodeOrder">{playbackOrder || index + 1}</span>
                  <span className="sourceStageHeaderIcon"><Icon name="layers" /></span>
                  <span>
                    <strong>Source tanlash</strong>
                    <small>1 ta source aktiv bo'ladi</small>
                  </span>
                  <em>{stateLabel}</em>
                </button>
                <div className="sourceStageList">
                  {PRIMARY_SOURCE_OPTIONS.map((option) => {
                    const definition = sources[option.id];
                    const selected = selectedSourceId === option.id;
                    return (
                      <button
                        type="button"
                        key={option.id}
                        className={["sourceStageChoice", selected ? "selected" : ""].join(" ")}
                        onClick={() => onSourceChange(option.id)}
                        disabled={sourceSelectionDisabled}
                        aria-pressed={selected}
                      >
                        <span><Icon name={option.icon} /></span>
                        <span>
                          <strong>{definition?.title ?? option.label}</strong>
                          <small>{definition?.collection ?? option.detail}</small>
                        </span>
                        <i>{selected ? "ACTIVE" : "SELECT"}</i>
                      </button>
                    );
                  })}
                </div>
                <footer>
                  <span>Selected source</span>
                  <strong>{sources[selectedSourceId]?.title ?? selectedSourceId}</strong>
                </footer>
                {isPlaying && <span className="sourceStageProgress" />}
              </section>
            );
          }

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
  pipelineResult,
  active,
  awaitingVersionSelection,
  selectedVersionId,
  onSelectVersion,
  onContinue,
}: {
  stage: StageMeta | null;
  result?: StageResult;
  pipelineResult: PipelineResult | null;
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
        <StageDescriptionBlock stage={stage} />
        <StageRunState stage={stage} result={result} />
        <StageResultVisualization stage={stage} result={result} fallback={staticStageDetails[stage.id]} />
        <StageProcessSidebar stage={stage} result={result} active={active} />
        <PreparationLifecycle
          stage={stage}
          result={result}
          awaitingVersionSelection={awaitingVersionSelection}
          selectedVersionId={selectedVersionId}
          onSelectVersion={onSelectVersion}
          onContinue={onContinue}
        />
        <DeliveryResultPanel stage={stage} result={pipelineResult} deliveryStage={result} />
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
        {stage.id === "preparation" && (
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

function DeliveryResultPanel({
  stage,
  result,
  deliveryStage,
}: {
  stage: StageMeta;
  result: PipelineResult | null;
  deliveryStage?: StageResult;
}) {
  if (stage.id !== "api") return null;

  const rows = result?.curated_preview ?? [];
  const clickhouseStage = result?.stages.find((item) => item.id === "clickhouse");
  const postgresStage = result?.stages.find((item) => item.id === "postgres");
  const status = result?.status ?? "waiting";
  const totalMetric = rows.reduce((sum, row) => sum + Number(row.metric_value ?? row.price ?? row.total ?? 0), 0);
  const categories = rows.reduce<Record<string, number>>((acc, row) => {
    const key = String(row.category ?? row.entity_name ?? row.status ?? "other");
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});
  const categoryRows = Object.entries(categories).slice(0, 5);
  const maxCategory = Math.max(1, ...categoryRows.map(([, count]) => count));
  const apiResponse = result ? {
    status: result.status,
    run_id: result.run_id,
    source: result.source,
    records: result.records,
    quality_score: result.quality_score,
    dashboard_rows: rows.slice(0, 3),
  } : {
    status: "waiting",
    message: "Run scenario tugagandan keyin real API response shu yerda chiqadi.",
  };
  const uploadResult = result ? {
    clickhouse_table: "dwh.curated_events",
    uploaded_records: result.records,
    curated_fields: result.curated_fields,
    storage_path: clickhouseStage?.output_ref ?? "ClickHouse output kutilmoqda",
    audit: postgresStage?.output_ref ?? "PostgreSQL audit kutilmoqda",
  } : {
    clickhouse_table: "dwh.curated_events",
    uploaded_records: 0,
    storage_path: "kutilmoqda",
  };

  return (
    <section className="deliveryResultPanel">
      <div className="detailTitle">
        <Icon name="globe" />
        <strong>Final dashboard / API / upload result</strong>
        <span className={["deliveryStatus", status].join(" ")}>{result ? status.toUpperCase() : "WAITING"}</span>
      </div>

      <div className="deliveryKpis">
        <ReportValue label="Dashboard rows" value={String(rows.length)} />
        <ReportValue label="API records" value={String(result?.records ?? 0)} />
        <ReportValue label="Quality" value={`${result?.quality_score ?? 0}%`} />
        <ReportValue label="Total metric" value={totalMetric ? totalMetric.toLocaleString("en-US", { maximumFractionDigits: 2 }) : "0"} />
      </div>

      <div className="deliveryDashboardPreview">
        <div className="deliveryMiniChart">
          <strong>Dashboard preview</strong>
          {categoryRows.length ? categoryRows.map(([label, count]) => (
            <div className="deliveryBar" key={label}>
              <span>{label}</span>
              <i style={{ width: `${Math.max(12, Math.round((count / maxCategory) * 100))}%` }} />
              <b>{count}</b>
            </div>
          )) : <p>Curated data hali yo'q.</p>}
        </div>
        <div className="deliveryTableMini">
          <strong>Real data result</strong>
          <div>
            {rows.slice(0, 4).map((row, index) => (
              <span key={String(row.dw_id ?? row.id ?? index)}>
                <b>{String(row.entity_name ?? row.title ?? row.id ?? `row-${index + 1}`)}</b>
                <em>{String(row.category ?? row.status ?? "ready")}</em>
                <code>{formatCell(row.metric_value ?? row.price ?? row.total ?? row.dw_id)}</code>
              </span>
            ))}
            {!rows.length && <p>Scenario tugagandan keyin DWHdan kelgan preview rows shu yerda chiqadi.</p>}
          </div>
        </div>
      </div>

      <div className="deliveryResultGrid">
        <article>
          <span><Icon name="api" /> API response</span>
          <code>GET /api/backend/pipeline/run/{result?.run_id?.slice(0, 8) ?? "{run_id}"}/result</code>
          <JsonBlock value={apiResponse} />
        </article>
        <article>
          <span><Icon name="warehouse" /> Upload / DWH load</span>
          <code>{clickhouseStage?.message ?? deliveryStage?.message ?? "ClickHouse load result kutilmoqda"}</code>
          <JsonBlock value={uploadResult} />
        </article>
      </div>

      <div className="deliveryEndpoints">
        <span><Icon name="download" /> Export</span>
        <code>/exports/{result?.run_id ?? "run_id"}/curated.csv</code>
        <code>/exports/{result?.run_id ?? "run_id"}/dashboard.json</code>
        <small>{result ? `${formatBytes(clickhouseStage?.data_size_bytes ?? 0)} uploaded, ${formatDuration(result.duration_ms)} total runtime` : "Run tugagandan keyin export pathlar real run_id bilan chiqadi."}</small>
      </div>
    </section>
  );
}
function StageResultVisualization({
  stage,
  result,
  fallback,
}: {
  stage: StageMeta;
  result?: StageResult;
  fallback?: StaticStageDetail;
}) {
  const output = result?.output_preview ?? fallback?.output_preview;
  const metrics = { ...(fallback?.metrics ?? {}), ...(result?.metrics ?? {}) };
  const rows = extractStageVisualRows(output);
  const columns = rows.length
    ? Object.keys(rows[0]).filter((key) => rows.some((row) => row[key] !== undefined)).slice(0, 6)
    : [];
  const numericMetrics = Object.entries(metrics)
    .filter((entry): entry is [string, number] => typeof entry[1] === "number")
    .slice(0, 5);
  const maxMetric = Math.max(1, ...numericMetrics.map(([, value]) => Math.abs(value)));
  const recordCount = result ? getStageRecordCount(result, rows.length) : rows.length;
  const outputRef = result?.output_ref ?? fallback?.output_ref;

  return (
    <section className={["stageResultVisualization", result ? result.status : "waiting"].join(" ")}>
      <div className="stageResultHead">
        <div>
          <Icon name="chart" />
          <span>
            <small>REAL DATA VISUAL</small>
            <strong>{stage.label} natijasi</strong>
          </span>
        </div>
        <em>{result ? result.status === "done" ? "REAL EXECUTED" : result.status.toUpperCase() : "RUN KUTILMOQDA"}</em>
      </div>

      <div className="stageResultKpis">
        <ReportValue label="Records" value={String(recordCount)} />
        <ReportValue label="Duration" value={result ? formatDuration(result.duration_ms) : "-"} />
        <ReportValue label="Payload" value={result ? formatBytes(result.data_size_bytes) : "-"} />
        <ReportValue label="Format" value={result?.data_format ?? "-"} />
      </div>

      {rows.length ? (
        <div className="stageResultTableWrap">
          <div className="stageResultTable" style={{ "--result-columns": columns.length } as CSSProperties}>
            <div className="stageResultTableHead">
              {columns.map((column) => <span key={column}>{column}</span>)}
            </div>
            {rows.slice(0, 5).map((row, rowIndex) => (
              <div className="stageResultTableRow" key={String(row.id ?? row.dw_id ?? rowIndex)}>
                {columns.map((column) => <span key={column} title={formatCell(row[column])}>{formatCell(row[column]) || "NULL"}</span>)}
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="stageResultEmpty">
          <Icon name="server" />
          <span>{result ? "Output table ko'rinishiga aylantiriladigan row topilmadi." : "Scenario ishlaganda real output shu yerda table va KPI sifatida chiqadi."}</span>
        </div>
      )}

      {numericMetrics.length > 0 && (
        <div className="stageMetricBars">
          {numericMetrics.map(([label, value]) => (
            <div key={label}>
              <span>{label}</span>
              <i><b style={{ width: Math.max(5, Math.round(Math.abs(value) / maxMetric * 100)) + "%" }} /></i>
              <strong>{value.toLocaleString("en-US")}</strong>
            </div>
          ))}
        </div>
      )}

      {outputRef && (
        outputRef.startsWith("http")
          ? <a className="stageResultLink" href={outputRef} target="_blank" rel="noreferrer"><Icon name="globe" /> Real natijani ochish</a>
          : <code className="stageResultRef">{outputRef}</code>
      )}
    </section>
  );
}

function extractStageVisualRows(value: unknown): Record<string, unknown>[] {
  if (Array.isArray(value)) {
    return value.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object").slice(0, 5);
  }
  if (!value || typeof value !== "object") return [];

  const record = value as Record<string, unknown>;
  for (const key of ["rows", "sample", "records", "curated", "raw", "transform"]) {
    const candidate = record[key];
    if (Array.isArray(candidate)) {
      const rows = candidate.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object");
      if (rows.length) return rows.slice(0, 5);
    }
  }

  const scalarRecord = Object.fromEntries(
    Object.entries(record).filter(([, item]) => item === null || ["string", "number", "boolean"].includes(typeof item)),
  );
  return Object.keys(scalarRecord).length ? [scalarRecord] : [];
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
        <DetailCard title="Texnik artifacts" icon="server" data={artifacts} wide />
        <DetailCard title="Raw stage JSON" icon="server" data={result ?? fallback ?? { status: "idle" }} wide />
        <CodePanel stage={stage} />
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
