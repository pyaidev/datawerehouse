HOST ?= 0.0.0.0
PUBLIC_HOST ?= 172.16.4.138
PORT ?= 7777
API_URL ?= http://localhost:8000

.PHONY: help run backend frontend build stop-port test-api pipeline-test down ps

help:
	@echo "Data Warehouse runner"
	@echo ""
	@echo "  make run           Backendni ko'taradi va frontendni http://$(PUBLIC_HOST):$(PORT) da run qiladi"
	@echo "  make backend       Docker FastAPI va kerakli servislarni ko'taradi"
	@echo "  make build         Next.js production build qiladi"
	@echo "  make frontend      Frontendni $(HOST):$(PORT) da start qiladi"
	@echo "  make stop-port     $(PORT) portni ushlab turgan eski processni to'xtatadi"
	@echo "  make test-api      Local null test API ni tekshiradi"
	@echo "  make pipeline-test Local null API bilan pipeline run qiladi"
	@echo "  make down          Docker servislarni to'xtatadi"

run: backend build stop-port frontend

backend:
	docker compose up -d --build fastapi

build:
	powershell -NoProfile -ExecutionPolicy Bypass -Command "Set-Location frontend; npm run build"

frontend:
	@echo "Frontend: http://$(PUBLIC_HOST):$(PORT)"
	powershell -NoProfile -ExecutionPolicy Bypass -Command "$$env:DWH_API_URL='$(API_URL)'; Set-Location frontend; npm run start -- -p $(PORT) -H $(HOST)"

stop-port:
	powershell -NoProfile -ExecutionPolicy Bypass -Command "$$line = netstat -ano | Select-String ':$(PORT)' | Select-String 'LISTENING' | Select-Object -First 1; if ($$line) { $$parts = ($$line.ToString() -split '\s+') | Where-Object { $$_ }; $$processIdToStop = [int]$$parts[-1]; Stop-Process -Id $$processIdToStop -Force; Write-Host \"Stopped process $$processIdToStop on port $(PORT)\" } else { Write-Host \"Port $(PORT) is free\" }"

test-api:
	powershell -NoProfile -ExecutionPolicy Bypass -Command "$$api = Invoke-RestMethod -Uri 'http://localhost:8000/test-api/products-null?limit=5' -TimeoutSec 15; [pscustomobject]@{scenario=$$api.scenario; count=$$api.products.Count; hasNullBrand=($$null -eq $$api.products[0].brand); hasNullPrice=($$null -eq $$api.products[1].price)} | Format-List"

pipeline-test:
	powershell -NoProfile -ExecutionPolicy Bypass -Command "$$body=@{source='local_null_products'; limit=5; mode='api'; failure_stage='none'; corrections=@()} | ConvertTo-Json -Depth 5; $$run=Invoke-RestMethod -Uri 'http://localhost:8000/pipeline/run' -Method Post -ContentType 'application/json' -Body $$body -TimeoutSec 30; $$prep=$$run.stages | Where-Object id -eq 'preparation'; [pscustomobject]@{status=$$run.status; records=$$run.records; quality=$$run.quality_score; imputed=$$prep.metrics.imputed_values; blankToNull=$$prep.metrics.blank_to_null} | Format-List"

down:
	docker compose down

ps:
	docker compose ps
