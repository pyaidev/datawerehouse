# Data Warehouse Pipeline Steplari Tafsiloti

Bu hujjat loyihadagi har bir Data Warehouse stepida real nima bajarilishini tushuntiradi. Frontenddagi stage card bosilganda modal ichida shu mantiqning qisqa varianti ko'rinadi: `Oldin / Input`, `Process`, `Keyin / Output`, `Metrics`, `Artifacts / Code` va `Raw stage JSON`.

## Umumiy Flow

```text
Source API -> FastAPI -> Kafka -> MinIO Landing -> MinIO Raw -> Quality Check -> Transform -> Curated Zone -> ClickHouse -> PostgreSQL Audit -> Next.js UI
```

Manual `Run Pipeline` tugmasi hozir FastAPI endpointni chaqiradi:

```text
POST /api/backend/pipeline/run
```

Next.js bu so'rovni backendga proxy qiladi:

```text
POST http://localhost:8000/pipeline/run
```

Default mode frontendda `api` qilib qo'yilgan.

---

## 1. FastAPI API Gateway Extract

### Nima qiladi

FastAPI frontenddan kelgan requestni qabul qiladi, request body ni validate qiladi va tanlangan source bo'yicha test API dan data oladi.

### Input

Frontend yoki tashqi tizimdan quyidagi JSON keladi:

```json
{
  "source": "products",
  "limit": 5,
  "mode": "api"
}
```

### Process

1. `source`, `limit`, `mode` Pydantic schema orqali tekshiriladi.
2. `source` qiymatiga qarab endpoint topiladi.
3. DummyJSON endpointga HTTP GET yuboriladi.
4. JSON payload qaytariladi.
5. Payload keyingi bosqichlar uchun normalized raw rows holatiga tayyorlanadi.

### Output

Misol:

```text
GET /products -> 5 records
```

Stage response ichida:

- `input_ref`: `POST /pipeline/run -> external source`
- `output_ref`: external API URL
- `input_preview`: request parametrlari
- `output_preview`: top-level keys, records count, sample rows
- `metrics`: `records_received`, `top_level_keys`

### Kodlar

- `backend/app/main.py`
- `backend/app/schemas.py`
- `backend/app/pipeline.py`
- `backend/app/sources.py`
- `backend/app/transform.py` (`normalize_payload`)

---

## 2. Kafka Ingestion Event

### Nima qiladi

Pipeline run haqida ingestion event yaratadi va Kafka topicga publish qiladi. Bu real-time yoki near-real-time monitoring uchun ishlatiladi.

### Input

FastAPI extractdan keyingi summary:

```json
{
  "run_id": "uuid",
  "source": "products",
  "mode": "api",
  "records": 5,
  "created_at": "2026-07-14T...Z"
}
```

### Process

1. Pipeline run metadata eventga yig'iladi.
2. Event JSON qilib serialize qilinadi.
3. Kafka producer `dwh.ingestion.events` topicga yozadi.
4. Kafka broker topic, partition va offset qaytaradi.

### Output

Misol:

```text
kafka://dwh.ingestion.events/0/6
```

Stage response ichida:

- `input_preview`: event JSON
- `output_ref`: Kafka topic/partition/offset
- `output_preview`: topic va event
- `metrics`: `events_published`, `records_in_event`
- `artifacts`: bootstrap servers va topic nomi

### Kodlar

- `backend/app/kafka_bus.py`
- `backend/app/pipeline.py`
- `kafka/producer_dummyjson.py`
- `kafka/consumer_to_raw.py`

---

## 3. MinIO Landing Zone

### Nima qiladi

External source dan kelgan original payloadni o'zgartirmasdan object storage ga yozadi. Bu audit va replay uchun kerak.

### Input

FastAPI olgan original JSON payload.

### Process

1. Object key yaratiladi.
2. Landing bucket mavjudligi tekshiriladi.
3. JSON object MinIO ga yoziladi.
4. S3-style path qaytariladi.

### Output

Misol:

```text
s3://landing-zone/products/<run_id>/landing.json
```

Stage response ichida:

- `input_ref`: external API URL
- `input_preview`: original payload summary
- `output_ref`: landing object path
- `output_preview`: bucket, key, format
- `metrics`: records written, object count

### Kodlar

- `backend/app/storage.py`
- `backend/app/pipeline.py`
- `docker-compose.yml` (`minio`, `minio-init`)

---

## 4. MinIO Raw Zone

### Nima qiladi

Original payloaddan collection list ajratib olinadi va normalized raw rows sifatida saqlanadi.

### Input

Landing payload:

```text
s3://landing-zone/products/<run_id>/landing.json
```

### Process

1. Source collection key aniqlanadi: masalan `products`, `users`, `carts`.
2. Payload ichidan list rows olinadi.
3. Rows raw zone objectga yoziladi.
4. Raw object key pipeline metadata sifatida qaytariladi.

### Output

Misol:

```text
s3://raw-zone/products/<run_id>/raw.json
```

Stage response ichida:

- `input_preview`: landing payload summary
- `output_preview`: raw sample rows
- `metrics`: records written, sample rows count
- `artifacts`: raw bucket va object key

### Kodlar

- `backend/app/transform.py` (`normalize_payload`)
- `backend/app/storage.py`
- `backend/app/pipeline.py`

---

## 5. Great Expectations Style Quality Check

### Nima qiladi

Raw rows sifatini tekshiradi. Bu loyiha ichida yengil validator yozilgan, Great Expectations uslubidagi checklar bilan ishlaydi.

### Input

Raw rows:

```text
s3://raw-zone/products/<run_id>/raw.json
```

### Process

Quyidagi checklar bajariladi:

1. `record_count` - row soni 0 dan katta bo'lishi kerak.
2. `primary_key` - har bir rowda `id` bo'lishi kerak.
3. `schema_not_empty` - row bo'sh schema bo'lmasligi kerak.
4. `null_threshold` - null/empty qiymatlar ko'p bo'lmasligi kerak.

### Output

Misol:

```text
quality_score=100
```

Stage response ichida:

- `output_preview`: har bir quality check natijasi
- `metrics`: total checks, passed checks, quality score
- `artifacts`: validator file va strict gate natijasi

### Kodlar

- `backend/app/quality.py`
- `backend/app/pipeline.py`
- `gx/validate_raw.py`

---

## 6. Transform / PySpark Compatible Layer

### Nima qiladi

Raw rows ni curated business schema ga o'tkazadi. Hozir manual API run ichida Python transform ishlaydi, PySpark job esa alohida `spark-submit` uchun tayyorlangan.

### Input

Raw sample rows:

```text
s3://raw-zone/products/<run_id>/raw.json
```

### Process

1. Har bir row uchun `dw_id`, `run_id`, `source_system`, `source_entity`, `ingestion_mode`, `loaded_at` qo'shiladi.
2. Source turiga qarab business mapping qilinadi.
3. `entity_name`, `category`, `metric_name`, `metric_value`, `status` maydonlari yaratiladi.
4. Curated rows keyingi storage va warehouse load uchun tayyorlanadi.

### Output

Curated row namunasi:

```json
{
  "dw_id": "products_1",
  "source_system": "eStat 4.0",
  "source_entity": "products",
  "ingestion_mode": "api",
  "entity_name": "Essence Mascara Lash Princess",
  "category": "beauty",
  "metric_name": "price",
  "metric_value": 9.99,
  "status": "In Stock"
}
```

Stage response ichida:

- `input_preview`: raw sample rows
- `output_preview`: curated sample rows
- `metrics`: input rows, output rows, curated fields count
- `artifacts`: runtime transform, PySpark job va dbt model pathlari

### Kodlar

- `backend/app/transform.py`
- `backend/app/pipeline.py`
- `spark/jobs/dummyjson_curate.py`
- `dbt/dwh_project/models`

---

## 7. Curated Zone Write

### Nima qiladi

Curated rows ni object storage da saqlaydi. Bu DWH load qayta ishlatilishi, replay va audit uchun kerak.

### Input

Memory ichidagi curated rows:

```text
memory://curated_rows
```

### Process

1. Curated object key yaratiladi.
2. Curated rows JSON sifatida object storage ga yoziladi.
3. Object path qaytariladi.

### Output

Misol:

```text
s3://raw-zone/products/<run_id>/curated.json
```

Stage response ichida:

- `input_preview`: curated sample rows
- `output_ref`: curated object path
- `output_preview`: curated sample rows
- `metrics`: records written, object count

### Kodlar

- `backend/app/storage.py`
- `backend/app/pipeline.py`

Eslatma: compose ichida bucket nomi hozir `raw-zone` ichida curated key bilan yozilyapti. Arxitektura bo'yicha alohida `curated-zone` bucket ham bor, keyingi refactor shu joyni alohida bucketga chiqarishi mumkin.

---

## 8. ClickHouse Warehouse Load

### Nima qiladi

Curated rows ni analytic warehouse jadvaliga insert qiladi. Dashboard, KPI va BI layer shu jadvaldan o'qishi mumkin.

### Input

Curated object:

```text
s3://raw-zone/products/<run_id>/curated.json
```

### Process

1. ClickHouse client ulanadi.
2. `curated_events` jadvali kerak bo'lsa yaratiladi.
3. Curated rows ustunlarga moslab normalize qilinadi.
4. Batch insert bajariladi.

### Output

Misol:

```text
clickhouse://curated_events?rows=5
```

Stage response ichida:

- `input_preview`: curated sample rows
- `output_preview`: database, table, inserted rows, sample metric sum
- `metrics`: inserted rows, target table
- `artifacts`: DDL owner va MergeTree engine

### Kodlar

- `backend/app/databases.py`
- `backend/app/pipeline.py`
- `sql/clickhouse/001_create_curated_events.sql`
- `sql/clickhouse/002_create_dwh_user.sql`

### Tekshiruv

```powershell
docker compose exec -T clickhouse clickhouse-client --user dwh --password dwh --database dwh --query "select source_entity, count() from curated_events group by source_entity"
```

---

## 9. PostgreSQL ODS / Audit

### Nima qiladi

Pipeline run metadata va audit ma'lumotlarini PostgreSQL jadvaliga yozadi.

### Input

Pipeline runtime summary:

```json
{
  "run_id": "uuid",
  "source": "products",
  "mode": "api",
  "status": "done",
  "records": 5,
  "quality_score": 100,
  "warnings": []
}
```

### Process

1. `pipeline_runs` jadvali kerak bo'lsa yaratiladi.
2. Run metadata insert qilinadi.
3. Agar run_id oldin bo'lsa, upsert orqali yangilanadi.
4. Audit path stage output sifatida qaytariladi.

### Output

```text
postgres://pipeline_runs
```

Stage response ichida:

- `input_preview`: audit dict
- `output_preview`: audit row summary
- `metrics`: audit rows upserted, records, quality score
- `artifacts`: table va primary key

### Kodlar

- `backend/app/databases.py`
- `backend/app/pipeline.py`
- `sql/postgres/001_create_metadata.sql`

### Tekshiruv

```powershell
docker compose exec -T postgres psql -U dwh -d dwh -c "select run_id, source, mode, records, quality_score, status from pipeline_runs order by created_at desc limit 5;"
```

---

## 10. Next.js Frontend / Visualization Portal

### Nima qiladi

Frontend pipeline runni boshqaradi va stage holatlarini visual ko'rsatadi. Har bir stage card bosilganda deep inspector modal ochiladi.

### Input

Next API proxy route:

```text
POST /api/backend/pipeline/run
```

### Process

1. User source, limit va mode tanlaydi.
2. Default mode `api`.
3. `Run Pipeline` bosilganda Next API proxy FastAPI ga request yuboradi.
4. Response ichidagi `stages`, `raw_preview`, `curated_preview`, `quality_checks` state ga yoziladi.
5. UI cardlar stage statusiga qarab `done`, `warning`, `error`, `idle` ko'rinish oladi.
6. Stage bosilganda modal stage detailni ko'rsatadi.

### Output

UI quyidagilarni ko'rsatadi:

- Run ID
- Records count
- Quality score
- Curated fields count
- Pipeline stage cards
- Quality checks
- Raw/Curated preview table
- Run logs
- Stage deep inspector modal

### Kodlar

- `frontend/components/Dashboard.tsx`
- `frontend/app/globals.css`
- `frontend/app/api/backend/health/route.ts`
- `frontend/app/api/backend/sources/route.ts`
- `frontend/app/api/backend/pipeline/run/route.ts`
- `frontend/lib/backend.ts`
- `frontend/lib/types.ts`

### Run

```powershell
cd frontend
npm run dev -- -p 7777 -H 0.0.0.0
```

URL:

```text
http://172.16.4.138:7777
```

---

## 11. NiFi Stage

### Hozirgi holati

NiFi stack ichida service sifatida bor va setup script yozilgan. Lekin frontenddagi manual `Run Pipeline` tugmasi hozir NiFi processorlarini trigger qilmaydi.

### Nima uchun bor

NiFi real production flow uchun kerak bo'ladi:

- source route qilish,
- FlowFile metadata attach qilish,
- retry/error handling,
- visual dataflow boshqarish.

### Kodlar

- `nifi/create_dummyjson_flow.py`
- `nifi/requirements.txt`
- `docker-compose.yml` (`nifi` service)

### URL

```text
http://localhost:8080
```

---

## 12. Airflow Stage

### Hozirgi holati

Airflow DAG file bor. Lekin frontend manual run FastAPI endpointni bevosita chaqiradi; DAG trigger qilinmaydi.

### Nima uchun bor

Airflow production scheduler sifatida ishlatiladi:

- batch pipeline schedule,
- dependency boshqarish,
- retry,
- task status monitoring,
- lineage log yozish.

### Kodlar

- `airflow/dags/dwh_dummyjson_pipeline.py`
- `docker-compose.yml` (`airflow` service)

### URL

```text
http://localhost:8088
```

Login:

```text
admin / admin
```

---

## 13. dbt Stage

### Hozirgi holati

dbt project skeleton va SQL model fayllari bor. Manual API run ichida dbt CLI ishga tushirilmaydi.

### Nima uchun bor

dbt curated/warehouse layerda SQL modeling uchun kerak:

- staging model,
- mart/fact model,
- testlar,
- lineage documentation,
- SQL transform standartlashtirish.

### Kodlar

- `dbt/dwh_project/dbt_project.yml`
- `dbt/dwh_project/models/staging/stg_curated_events.sql`
- `dbt/dwh_project/models/marts/fct_source_metrics.sql`
- `dbt/dwh_project/models/staging/sources.yml`

---

## 14. Prometheus Monitoring

### Nima qiladi

Prometheus backend metrics endpointdan metrikalarni scrape qilish uchun configga ega.

### Kodlar

- `monitoring/prometheus.yml`
- `backend/app/main.py` (`/metrics` endpoint)
- `docker-compose.yml` (`prometheus` service)

### URL

```text
http://localhost:9095
```

---

## 15. Keycloak IAM / SSO

### Hozirgi holati

Keycloak realm export asset bor, lekin FastAPI JWT verification hali majburiy yoqilmagan.

### Nima uchun bor

Productionda quyidagilar uchun kerak:

- IAM,
- SSO,
- role-based access control,
- API authentication,
- user/session management.

### Kodlar

- `keycloak/realm-export.json`

---

## 16. Export Service

### Hozirgi holati

Frontendda API response JSON preview va table ko'rinish bor. CSV/PDF export endpoint hali alohida yozilmagan.

### Keyingi ish

Albatta productionga yaqin qilish uchun quyidagilar qo'shiladi:

- `POST /exports` endpoint,
- CSV export,
- Excel export,
- PDF report export,
- export audit log.

---

## Men Qilgan Asosiy Ishlar

1. Data Warehouse arxitekturasiga mos real backend stack yozildi.
2. FastAPI pipeline endpoint yaratildi.
3. DummyJSON test API source sifatida ulandi.
4. Kafka event publish qilindi.
5. MinIO landing/raw/curated write ishlatildi.
6. Quality check logic yozildi.
7. Curated transform logic yozildi.
8. ClickHouse warehouse load yozildi.
9. PostgreSQL audit yozildi.
10. Next.js frontend alohida yaratildi.
11. Next API proxy route lar yozildi.
12. Stage cardlar icon va status bilan qilindi.
13. Stage bosilganda deep inspector modal qo'shildi.
14. Modalga before/after data, metrics, artifacts va raw JSON qo'shildi.
15. Default active mode `api` qilindi.
16. Next server 7777 portda network host bilan ishga tushirildi.
17. README yangilandi.
18. Public GitHub repo yaratildi va kod push qilindi.

## Halol Yakuniy Holat

Manual pipeline real ishlaydigan qismlar:

- FastAPI
- Kafka
- MinIO Landing
- MinIO Raw
- Quality Check
- Transform
- Curated write
- ClickHouse
- PostgreSQL
- Next.js UI

Manual run ichida hali bevosita trigger qilinmaydigan, lekin kod/asset sifatida tayyorlangan qismlar:

- NiFi flow setup
- Airflow DAG scheduler
- dbt model execution
- Spark cluster runtime
- Keycloak JWT enforcement
- ELK log stack
- CSV/PDF export endpoint
## 17. Step Animation / Auto Modal

### Nima qo'shildi

Pipeline run tugagandan keyin frontend real backend response ichidagi stage natijalarini sekin playback qiladi. Har bir real stage navbat bilan highlight bo'ladi va o'sha stage modali avtomatik ochiladi.

### Qanday ishlaydi

1. User `Run Pipeline` bosadi.
2. Next.js `POST /api/backend/pipeline/run` orqali FastAPI ga request yuboradi.
3. Backend barcha stage natijalarini qaytaradi.
4. Frontend `startStagePlayback()` bilan stage'larni ketma-ket ko'rsatadi.
5. Har stage uchun 1.8 sekund vaqt beriladi.
6. Current stage card `playing` class oladi.
7. Oldin o'tgan stage card `visited` class oladi.
8. `activeStage` avtomatik o'zgaradi va modal o'zi ochiladi.
9. Replay tugmasi shu animatsiyani qayta ko'rsatadi.

### Kodlar

- `frontend/components/Dashboard.tsx`
  - `PLAYBACK_STEP_MS = 1800`
  - `playbackStageId`
  - `playbackRunning`
  - `visitedStageIds`
  - `startStagePlayback()`
  - `clearPlaybackTimers()`
- `frontend/app/globals.css`
  - `.stageCard.playing`
  - `.stageCard.visited`
  - `.playbackBadge`
  - `@keyframes stagePulse`
  - `@keyframes stageProgress`
  - `@keyframes modalRise`

### Halol izoh

Bu hozir backend streaming emas. Backend response bitta marta qaytadi, frontend esa shu real natijani foydalanuvchiga tushunarli qilish uchun step-by-step playback qiladi. Real-time streaming kerak bo'lsa keyingi bosqichda SSE yoki WebSocket endpoint qo'shiladi.

## Modal Tavsiflari

Har bir stage modali Tavsif blokini ko'rsatadi: Nima qiladi, Data oqimi, Natija, Izoh.
