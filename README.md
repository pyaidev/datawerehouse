# Data Warehouse Operations Console

Real API bilan ishlaydigan Data Warehouse demo stack. Loyiha faqat UI maket emas: FastAPI pipeline tashqi test API dan data oladi, Kafka event chiqaradi, MinIO landing/raw/prepared/curated object yozadi, manual correction va data quality check qiladi, curated model yaratadi, ClickHouse ga load qiladi, Trino orqali real SQL verification bajaradi, Supersetda ClickHouse database/datasetini avtomatik provision qiladi va PostgreSQL ga audit yozadi. Next.js frontend har bir stage bosilganda input, process, output, metrics va artifacts/code tafsilotlarini o'ng inspector sidebarida ko'rsatadi.

## Stack

- Frontend: Next.js 15, React 19
- API Gateway: FastAPI
- Streaming: Apache Kafka
- Object Storage: MinIO
- Validation: Great Expectations style checks
- Transform: Python transform + PySpark job namunasi
- Warehouse: ClickHouse 25.3
- Distributed SQL: Trino 482
- BI: Apache Superset 6.0 + clickhouse-connect
- ODS / metadata: PostgreSQL
- Orchestration assets: Airflow DAG, NiFi setup script, dbt models
- Monitoring: Prometheus config

## Documentation

- [STEP_DETAILS.md](STEP_DETAILS.md) - har bir Data Warehouse stepida nima bajarilishi, input/output, kodlar va tekshiruvlar.

## Quick Start

Backend stackni ko'tarish:

```powershell
docker compose up -d --build
```

Next.js frontendni ishga tushirish:

```powershell
cd frontend
npm install
npm run dev -- -p 7777 -H 0.0.0.0
```

Local ochish:

```text
http://localhost:7777
```

Network orqali ochish:

```text
http://172.16.4.138:7777
```

## Asosiy URLlar

- Next.js frontend: `http://localhost:7777`
- FastAPI docs: `http://localhost:8000/docs`
- Pipeline endpoint: `POST http://localhost:8000/pipeline/run`
- MinIO console: `http://localhost:9001` (`minioadmin` / `minioadmin`)
- NiFi: `http://localhost:8080`
- Airflow: `http://localhost:8088` (`admin` / `admin`)
- Trino UI/API: `http://localhost:8089`
- Apache Superset: `http://localhost:8087` (`admin` / `admin`)
- Prometheus: `http://localhost:9095`

## API Test

```powershell
Invoke-RestMethod `
  -Method Post `
  -Uri http://localhost:8000/pipeline/run `
  -ContentType 'application/json' `
  -Body (@{ source='products'; limit=5; mode='api' } | ConvertTo-Json -Compress)
```

Next proxy orqali:

```powershell
Invoke-RestMethod `
  -Method Post `
  -Uri http://localhost:7777/api/backend/pipeline/run `
  -ContentType 'application/json' `
  -Body (@{ source='products'; limit=5; mode='api' } | ConvertTo-Json -Compress)
```

## Pipeline Bosqichlari

1. FastAPI requestni qabul qiladi va test API dan payload oladi.
2. Kafka ingestion event yozadi.
3. MinIO Landing original payloadni saqlaydi.
4. MinIO Raw normalized rows saqlaydi.
5. Data Preparation profiling, normalization va manual correction rule'larni qo'llab `prepared.json` yozadi.
6. Great Expectations style validation prepared data uchun quality score chiqaradi.
7. Transform layer curated schema yaratadi.
8. Curated zone object yoziladi.
9. ClickHouse `curated_events` jadvaliga analytic rows insert qilinadi.
10. PostgreSQL `pipeline_runs` jadvaliga audit yoziladi.

Frontend stage inspector sidebarida shu ma'lumotlar ko'rinadi:

- Oldin / Input
- Process steps
- Keyin / Output
- Metrics
- Artifacts / Code
- Raw stage JSON

## Execution Tushuntirish UI

Runner jarayonni faqat diagramma sifatida emas, real API response asosida ko'rsatadi:

- connector ustida record soni, payload hajmi va format ko'rsatiladigan data packet;
- har bir stage uchun Input -> Process -> Output va field-level diff;
- backend qaytargan timestamp va duration asosidagi execution timeline;
- REAL EXECUTED, AVAILABLE, NOT CONNECTED statuslari;
- repositorydagi haqiqiy FastAPI, Kafka, MinIO, quality, transform, ClickHouse, PostgreSQL, NiFi, Airflow va dbt kod previewlari;
- Kafka, Great Expectations yoki ClickHouse bosqichida boshqariladigan TEST FAILURE va normal retry;
- bitta record uchun Source -> Raw -> Prepared -> Curated -> ClickHouse lineage;
- record va column bo'yicha manual correction queue, type coercion va qayta run;
- run status, total duration, quality, warning va storage/database manzillari bilan final report.

Test failure requestiga failure_stage maydoni beriladi. Qiymatlar: none, kafka, gx, clickhouse. Bu production xatosi emas, UI va retry oqimini ko'rsatish uchun nazoratli test rejimi.

## Muhim Kodlar

- FastAPI app: `backend/app/main.py`
- Pipeline runner: `backend/app/pipeline.py`
- Schemas: `backend/app/schemas.py`
- MinIO connector: `backend/app/storage.py`
- Kafka connector: `backend/app/kafka_bus.py`
- ClickHouse/PostgreSQL connector: `backend/app/databases.py`
- Trino/Superset connector: `backend/app/analytics.py`
- Trino catalog: `trino/catalog/clickhouse.properties`
- Superset image/config: `superset/Dockerfile`, `superset/superset_config.py`
- Transform: `backend/app/transform.py`
- Quality checks: `backend/app/quality.py`
- Next dashboard: `frontend/components/Dashboard.tsx`
- Next API proxy: `frontend/app/api/backend/*`
- PySpark job: `spark/jobs/dummyjson_curate.py`
- Great Expectations validator: `gx/validate_raw.py`
- Airflow DAG: `airflow/dags/dwh_dummyjson_pipeline.py`
- dbt models: `dbt/dwh_project/models`
- NiFi setup script: `nifi/create_dummyjson_flow.py`
- SQL migrations: `sql/clickhouse`, `sql/postgres`

## Environment

Backend `.env.example` va frontend `frontend/.env.local.example` fayllarini nusxa qilib local env yarating.

```powershell
Copy-Item .env.example .env
Copy-Item frontend/.env.local.example frontend/.env.local
```

Frontend backend URL:

```text
DWH_API_URL=http://localhost:8000
```

## Verification

Build tekshirish:

```powershell
cd frontend
npm run build
```

Docker service holati:

```powershell
docker compose ps
```

ClickHouse tekshiruv namunasi:

```powershell
docker compose exec -T clickhouse clickhouse-client --user dwh --password dwh --database dwh --query "select source_entity, count() from curated_events group by source_entity"
```

PostgreSQL audit tekshiruv namunasi:

```powershell
docker compose exec -T postgres psql -U dwh -d dwh -c "select run_id, source, mode, records, quality_score, status from pipeline_runs order by created_at desc limit 5;"
```


Trino orqali ClickHouse query:
```powershell
Invoke-RestMethod -Method Post -Uri http://localhost:8089/v1/statement -Headers @{"X-Trino-User"="dwh";"X-Trino-Catalog"="clickhouse";"X-Trino-Schema"="dwh"} -ContentType "text/plain" -Body "select count(*) from clickhouse.dwh.curated_events"
```
Superset health va UI:
```powershell
Invoke-RestMethod http://localhost:8087/health
Start-Process http://localhost:8087
```

##  Cheklovlar

- NiFi flow setup script bor, lekin manual `Run Pipeline` tugmasi NiFi processorlarini trigger qilmaydi.
- Airflow DAG bor, lekin frontenddagi manual run bevosita FastAPI endpointni chaqiradi.
- dbt project skeleton va model joylari bor, manual API run ichida dbt CLI ishlatilmaydi.
- Spark cluster compose ichida yoqilmagan; PySpark job alohida `spark-submit` uchun berilgan.
- Keycloak realm asset bor, lekin FastAPI JWT verification majburiy yoqilmagan.
- ELK stack config hali qo'shilmagan; loglar container stdout orqali ko'riladi.
