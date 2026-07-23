import json
from typing import Any

import httpx

from .config import Settings


class TrinoQueryService:
    def __init__(self, settings: Settings):
        self.settings = settings

    async def query_run(self, run_id: str) -> dict[str, Any]:
        safe_run_id = run_id.replace("'", "''")
        table = (
            f'"{self.settings.trino_catalog}".'
            f'"{self.settings.trino_schema}".'
            '"curated_events"'
        )
        query = (
            "select count(*) as records, "
            "coalesce(sum(metric_value), 0) as metric_sum, "
            "count(distinct source_entity) as source_count "
            f"from {table} where run_id = '{safe_run_id}'"
        )
        headers = {
            "X-Trino-User": self.settings.trino_user,
            "X-Trino-Catalog": self.settings.trino_catalog,
            "X-Trino-Schema": self.settings.trino_schema,
            "Content-Type": "text/plain",
        }

        columns: list[str] = []
        data: list[list[Any]] = []
        query_id: str | None = None
        stats: dict[str, Any] = {}

        async with httpx.AsyncClient(
            base_url=self.settings.trino_url.rstrip("/"),
            timeout=30,
        ) as client:
            response = await client.post("/v1/statement", content=query, headers=headers)
            _raise_for_service(response, "Trino query")

            while True:
                payload = response.json()
                if payload.get("error"):
                    error = payload["error"]
                    raise RuntimeError(
                        f"Trino {error.get('errorName', 'QUERY_ERROR')}: "
                        f"{error.get('message', 'query failed')}"
                    )

                query_id = payload.get("id") or query_id
                stats = payload.get("stats") or stats
                if payload.get("columns"):
                    columns = [column["name"] for column in payload["columns"]]
                if payload.get("data"):
                    data.extend(payload["data"])

                next_uri = payload.get("nextUri")
                if not next_uri:
                    break
                response = await client.get(next_uri, headers=headers)
                _raise_for_service(response, "Trino query page")

        rows = [dict(zip(columns, row, strict=False)) for row in data]
        return {
            "query_id": query_id,
            "query": query,
            "catalog": self.settings.trino_catalog,
            "schema": self.settings.trino_schema,
            "columns": columns,
            "rows": rows,
            "stats": stats,
        }


class SupersetService:
    def __init__(self, settings: Settings):
        self.settings = settings

    async def ensure_clickhouse_dataset(self, run_id: str) -> dict[str, Any]:
        base_url = self.settings.superset_url.rstrip("/")
        async with httpx.AsyncClient(
            base_url=base_url,
            timeout=45,
            follow_redirects=False,
        ) as client:
            health = await client.get("/health")
            _raise_for_service(health, "Superset health")

            login_page = await client.get("/login/")
            _raise_for_service(login_page, "Superset login page")
            try:
                login_csrf = (
                    login_page.text.split('name="csrf_token"', 1)[1]
                    .split('value="', 1)[1]
                    .split('"', 1)[0]
                )
            except IndexError as exc:
                raise RuntimeError("Superset login CSRF token topilmadi") from exc

            login = await client.post(
                "/login/",
                data={
                    "username": self.settings.superset_username,
                    "password": self.settings.superset_password,
                    "csrf_token": login_csrf,
                },
                headers={"Referer": f"{base_url}/login/"},
            )
            if login.status_code not in {302, 303} or login.headers.get(
                "location", ""
            ).startswith("/login"):
                _raise_for_service(login, "Superset session login")
                raise RuntimeError("Superset session login muvaffaqiyatsiz")

            auth_headers: dict[str, str] = {}
            csrf_response = await client.get(
                "/api/v1/security/csrf_token/",
                headers=auth_headers,
            )
            _raise_for_service(csrf_response, "Superset CSRF")
            csrf_token = csrf_response.json().get("result")
            write_headers = {
                **auth_headers,
                "X-CSRFToken": str(csrf_token),
                "Referer": f"{base_url}/",
            }
            public_role = await self._find_role(client, auth_headers, "Public")
            if public_role is None:
                raise RuntimeError("Superset Public role topilmadi")
            public_role_id = int(public_role["id"])

            database = await self._find_database(client, auth_headers)
            database_created = database is None
            if database is None:
                response = await client.post(
                    "/api/v1/database/",
                    headers=write_headers,
                    json={
                        "database_name": self.settings.superset_database_name,
                        "sqlalchemy_uri": self.settings.superset_clickhouse_uri,
                        "expose_in_sqllab": True,
                        "allow_ctas": True,
                        "allow_cvas": True,
                        "allow_dml": False,
                    },
                )
                _raise_for_service(response, "Superset database create")
                database_id = _extract_resource_id(response.json())
                database = {
                    "id": database_id,
                    "database_name": self.settings.superset_database_name,
                }

            database_id = int(database["id"])
            dataset = await self._find_dataset(client, auth_headers, database_id)
            dataset_created = dataset is None
            if dataset is None:
                response = await client.post(
                    "/api/v1/dataset/",
                    headers=write_headers,
                    json={
                        "database": database_id,
                        "schema": self.settings.superset_dataset_schema,
                        "table_name": self.settings.superset_dataset_table,
                    },
                )
                _raise_for_service(response, "Superset dataset create")
                dataset_id = _extract_resource_id(response.json())
                dataset = {
                    "id": dataset_id,
                    "schema": self.settings.superset_dataset_schema,
                    "table_name": self.settings.superset_dataset_table,
                }

            dataset_id = int(dataset["id"])
            dashboard_title = f"DWH Run {run_id[:8]}"
            dashboard = await self._find_dashboard(client, auth_headers, dashboard_title)
            dashboard_created = dashboard is None
            if dashboard is None:
                response = await client.post(
                    "/api/v1/dashboard/",
                    headers=write_headers,
                    json={
                        "dashboard_title": dashboard_title,
                        "published": True,
                        "roles": [public_role_id],
                        "slug": f"dwh-run-{run_id[:8]}",
                        "json_metadata": json.dumps({"native_filter_configuration": []}),
                    },
                )
                _raise_for_service(response, "Superset dashboard create")
                dashboard_id = _extract_resource_id(response.json())
                dashboard = {"id": dashboard_id, "dashboard_title": dashboard_title}

            dashboard_id = int(dashboard["id"])
            chart_name = f"DWH records {run_id[:8]}"
            chart = await self._find_chart(client, auth_headers, chart_name)
            chart_created = chart is None
            if chart is None:
                chart_params = {
                    "datasource": f"{dataset_id}__table",
                    "viz_type": "table",
                    "query_mode": "raw",
                    "all_columns": [
                        "dw_id",
                        "entity_name",
                        "category",
                        "metric_name",
                        "metric_value",
                        "status",
                        "loaded_at",
                    ],
                    "adhoc_filters": [
                        {
                            "clause": "WHERE",
                            "comparator": run_id,
                            "expressionType": "SIMPLE",
                            "operator": "==",
                            "subject": "run_id",
                        }
                    ],
                    "row_limit": 100,
                    "server_page_length": 20,
                    "include_search": True,
                    "show_cell_bars": True,
                }
                response = await client.post(
                    "/api/v1/chart/",
                    headers=write_headers,
                    json={
                        "slice_name": chart_name,
                        "viz_type": "table",
                        "datasource_id": dataset_id,
                        "datasource_type": "table",
                        "dashboards": [dashboard_id],
                        "description": f"ClickHouse curated_events, run_id={run_id}",
                        "params": json.dumps(chart_params),
                    },
                )
                _raise_for_service(response, "Superset chart create")
                chart_id = _extract_resource_id(response.json())
                chart = {"id": chart_id, "slice_name": chart_name}

            chart_id = int(chart["id"])
            dashboard_update: dict[str, Any] = {
                "published": True,
                "roles": [public_role_id],
            }
            if dashboard_created or chart_created:
                dashboard_update["position_json"] = json.dumps(
                    _dashboard_position(chart_id, chart_name)
                )
            response = await client.put(
                f"/api/v1/dashboard/{dashboard_id}",
                headers=write_headers,
                json=dashboard_update,
            )
            _raise_for_service(response, "Superset dashboard public access update")

            return {
                "health": health.text.strip() or "OK",
                "database_id": database_id,
                "database_name": self.settings.superset_database_name,
                "database_created": database_created,
                "dataset_id": dataset_id,
                "dataset_created": dataset_created,
                "dashboard_id": dashboard_id,
                "dashboard_title": dashboard_title,
                "dashboard_created": dashboard_created,
                "public_role_id": public_role_id,
                "anonymous_access": True,
                "dashboard_url": (
                    f"{self.settings.superset_public_url.rstrip('/')}"
                    f"/superset/dashboard/{dashboard_id}/?standalone=1"
                ),
                "chart_id": chart_id,
                "chart_name": chart_name,
                "chart_created": chart_created,
                "chart_url": (
                    f"{self.settings.superset_public_url.rstrip('/')}"
                    f"/explore/?slice_id={chart_id}"
                ),
                "schema": self.settings.superset_dataset_schema,
                "table": self.settings.superset_dataset_table,
                "explore_url": (
                    f"{self.settings.superset_public_url.rstrip('/')}"
                    f"/explore/?datasource={dataset_id}__table"
                ),
            }

    async def _find_role(
        self,
        client: httpx.AsyncClient,
        headers: dict[str, str],
        role_name: str,
    ) -> dict[str, Any] | None:
        response = await client.get(
            "/api/v1/security/roles/",
            headers=headers,
            params={
                "q": (
                    "(filters:!((col:name,opr:eq,"
                    f"value:'{role_name}')),page_size:100)"
                )
            },
        )
        _raise_for_service(response, "Superset role list")
        for item in response.json().get("result", []):
            if item.get("name") == role_name:
                return item
        return None

    async def _find_database(
        self,
        client: httpx.AsyncClient,
        headers: dict[str, str],
    ) -> dict[str, Any] | None:
        response = await client.get(
            "/api/v1/database/",
            headers=headers,
            params={
                "q": (
                    "(filters:!((col:database_name,opr:eq,"
                    f"value:'{self.settings.superset_database_name}')),page_size:100)"
                )
            },
        )
        _raise_for_service(response, "Superset database list")
        for item in response.json().get("result", []):
            if item.get("database_name") == self.settings.superset_database_name:
                return item

        dataset_response = await client.get(
            "/api/v1/dataset/",
            headers=headers,
            params={"q": "(page_size:100)"},
        )
        _raise_for_service(dataset_response, "Superset dataset database fallback")
        for item in dataset_response.json().get("result", []):
            database = item.get("database") or {}
            if (
                isinstance(database, dict)
                and database.get("database_name") == self.settings.superset_database_name
            ):
                return {
                    "id": database["id"],
                    "database_name": database["database_name"],
                }
        return None

    async def _find_dataset(
        self,
        client: httpx.AsyncClient,
        headers: dict[str, str],
        database_id: int,
    ) -> dict[str, Any] | None:
        response = await client.get(
            "/api/v1/dataset/",
            headers=headers,
            params={
                "q": (
                    "(filters:!((col:table_name,opr:eq,"
                    f"value:'{self.settings.superset_dataset_table}'),"
                    "(col:schema,opr:eq,"
                    f"value:'{self.settings.superset_dataset_schema}')),"
                    "page_size:100)"
                )
            },
        )
        _raise_for_service(response, "Superset dataset list")
        for item in response.json().get("result", []):
            database = item.get("database") or {}
            item_database_id = database.get("id") if isinstance(database, dict) else database
            if (
                item.get("table_name") == self.settings.superset_dataset_table
                and item.get("schema") == self.settings.superset_dataset_schema
                and (item_database_id is None or int(item_database_id) == database_id)
            ):
                return item
        return None

    async def _find_dashboard(
        self,
        client: httpx.AsyncClient,
        headers: dict[str, str],
        dashboard_title: str,
    ) -> dict[str, Any] | None:
        response = await client.get(
            "/api/v1/dashboard/",
            headers=headers,
            params={
                "q": (
                    "(filters:!((col:dashboard_title,opr:eq,"
                    f"value:'{dashboard_title}')),page_size:100)"
                )
            },
        )
        _raise_for_service(response, "Superset dashboard list")
        for item in response.json().get("result", []):
            if item.get("dashboard_title") == dashboard_title:
                return item
        return None

    async def _find_chart(
        self,
        client: httpx.AsyncClient,
        headers: dict[str, str],
        chart_name: str,
    ) -> dict[str, Any] | None:
        response = await client.get(
            "/api/v1/chart/",
            headers=headers,
            params={
                "q": (
                    "(filters:!((col:slice_name,opr:eq,"
                    f"value:'{chart_name}')),page_size:100)"
                )
            },
        )
        _raise_for_service(response, "Superset chart list")
        for item in response.json().get("result", []):
            if item.get("slice_name") == chart_name:
                return item
        return None


def _dashboard_position(chart_id: int, chart_name: str) -> dict[str, Any]:
    row_id = f"ROW-{chart_id}"
    chart_key = f"CHART-{chart_id}"
    return {
        "DASHBOARD_VERSION_KEY": "v2",
        "ROOT_ID": {
            "id": "ROOT_ID",
            "type": "ROOT",
            "children": ["GRID_ID"],
        },
        "GRID_ID": {
            "id": "GRID_ID",
            "type": "GRID",
            "children": [row_id],
            "parents": ["ROOT_ID"],
        },
        row_id: {
            "id": row_id,
            "type": "ROW",
            "children": [chart_key],
            "parents": ["ROOT_ID", "GRID_ID"],
            "meta": {"background": "BACKGROUND_TRANSPARENT"},
        },
        chart_key: {
            "id": chart_key,
            "type": "CHART",
            "children": [],
            "parents": ["ROOT_ID", "GRID_ID", row_id],
            "meta": {
                "chartId": chart_id,
                "height": 60,
                "width": 12,
                "sliceName": chart_name,
            },
        },
    }

def _extract_resource_id(payload: dict[str, Any]) -> int:
    if payload.get("id") is not None:
        return int(payload["id"])
    result = payload.get("result")
    if isinstance(result, dict) and result.get("id") is not None:
        return int(result["id"])
    raise RuntimeError(f"Superset resource id qaytarmadi: {payload}")


def _raise_for_service(response: httpx.Response, action: str) -> None:
    if response.is_error:
        body = response.text.replace("\n", " ")[:500]
        raise RuntimeError(f"{action} HTTP {response.status_code}: {body}")
