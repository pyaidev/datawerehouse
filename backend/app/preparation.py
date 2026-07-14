from copy import deepcopy
from typing import Any


def prepare_rows(
    rows: list[dict[str, Any]],
    corrections: list[dict[str, Any]],
) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    prepared = deepcopy(rows)
    trimmed_values = 0
    blank_to_null = 0

    for row in prepared:
        for column, value in list(row.items()):
            if not isinstance(value, str):
                continue
            normalized = value.strip()
            if normalized != value:
                trimmed_values += 1
            if normalized == "":
                row[column] = None
                blank_to_null += 1
            else:
                row[column] = normalized

    rows_by_id = {str(row.get("id")): row for row in prepared if row.get("id") is not None}
    applied_corrections: list[dict[str, Any]] = []
    rejected_corrections: list[dict[str, Any]] = []

    for correction in corrections:
        record_id = str(correction.get("record_id"))
        column = str(correction.get("column") or "")
        target = rows_by_id.get(record_id)
        if target is None:
            rejected_corrections.append({**correction, "reason": "record topilmadi"})
            continue
        if not column or column not in target:
            rejected_corrections.append({**correction, "reason": "record yoki column topilmadi"})
            continue

        old_value = target.get(column)
        new_value = coerce_value(correction.get("value"), old_value)
        target[column] = new_value
        applied_corrections.append(
            {
                "record_id": record_id,
                "column": column,
                "before": old_value,
                "after": new_value,
            }
        )

    columns = sorted({column for row in prepared for column in row})
    profile = {
        "rows": len(prepared),
        "columns": len(columns),
        "column_names": columns,
        "types": infer_column_types(prepared, columns),
        "trimmed_values": trimmed_values,
        "blank_to_null": blank_to_null,
        "manual_corrections_applied": len(applied_corrections),
        "manual_corrections_rejected": len(rejected_corrections),
        "applied_corrections": applied_corrections,
        "rejected_corrections": rejected_corrections,
    }
    return prepared, profile


def infer_column_types(rows: list[dict[str, Any]], columns: list[str]) -> dict[str, str]:
    result: dict[str, str] = {}
    for column in columns:
        value = next((row.get(column) for row in rows if row.get(column) is not None), None)
        result[column] = type(value).__name__ if value is not None else "null"
    return result


def coerce_value(value: Any, current: Any) -> Any:
    if not isinstance(value, str):
        return value
    normalized = value.strip()
    if normalized == "":
        return None
    if current is None:
        return normalized
    try:
        if isinstance(current, bool):
            return normalized.lower() in {"1", "true", "yes", "ha"}
        if isinstance(current, int):
            return int(normalized)
        if isinstance(current, float):
            return float(normalized)
    except ValueError:
        return normalized
    return normalized
