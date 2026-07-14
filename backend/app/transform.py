from datetime import UTC, datetime
from typing import Any


def normalize_payload(payload: Any, collection_key: str) -> list[dict]:
    if isinstance(payload, list):
        return payload
    if isinstance(payload, dict) and isinstance(payload.get(collection_key), list):
        return payload[collection_key]
    return []


def curate_rows(rows: list[dict], *, source_id: str, source_title: str, mode: str, run_id: str) -> list[dict]:
    loaded_at = datetime.now(UTC).isoformat()
    curated: list[dict] = []

    for row in rows:
        base = {
            "dw_id": f"{source_id}_{row.get('id', len(curated) + 1)}",
            "run_id": run_id,
            "source_system": source_title,
            "source_entity": source_id,
            "ingestion_mode": mode,
            "loaded_at": loaded_at,
        }

        if source_id == "products":
            record = {
                **base,
                "entity_name": row.get("title"),
                "category": row.get("category"),
                "metric_name": "price",
                "metric_value": float(row.get("price") or 0),
                "status": row.get("availabilityStatus") or "active",
            }
        elif source_id == "users":
            record = {
                **base,
                "entity_name": " ".join(part for part in [row.get("firstName"), row.get("lastName")] if part),
                "category": (row.get("company") or {}).get("department") or row.get("role") or "user",
                "metric_name": "age",
                "metric_value": float(row.get("age") or 0),
                "status": "verified" if row.get("email") else "missing_email",
            }
        elif source_id == "carts":
            record = {
                **base,
                "entity_name": f"Cart {row.get('id')}",
                "category": f"user_{row.get('userId')}",
                "metric_name": "total",
                "metric_value": float(row.get("total") or 0),
                "status": f"{row.get('totalProducts') or 0} products",
            }
        else:
            record = {
                **base,
                "entity_name": row.get("title") or row.get("todo") or row.get("quote") or f"Record {row.get('id')}",
                "category": first_tag(row) or str(row.get("userId") or "general"),
                "metric_name": "generic_value",
                "metric_value": float(((row.get("reactions") or {}).get("likes")) or int(row.get("completed") is True)),
                "status": "completed" if row.get("completed") is True else "active",
            }
        curated.append(record)

    return curated


def first_tag(row: dict) -> str | None:
    tags = row.get("tags")
    if isinstance(tags, list) and tags:
        return str(tags[0])
    return None
