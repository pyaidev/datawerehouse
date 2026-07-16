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

    imputed_values = apply_imputation(prepared)

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
        "imputed_values": len(imputed_values),
        "imputation_rules": imputed_values[:20],
        "manual_corrections_applied": len(applied_corrections),
        "manual_corrections_rejected": len(rejected_corrections),
        "applied_corrections": applied_corrections,
        "rejected_corrections": rejected_corrections,
    }
    return prepared, profile



def apply_imputation(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    columns = sorted({column for row in rows for column in row})
    defaults = {column: infer_default(rows, column) for column in columns}
    imputed: list[dict[str, Any]] = []

    for row in rows:
        record_id = row.get("id") or row.get("dw_id") or "unknown"
        for column in columns:
            if column in {"id", "dw_id"}:
                continue
            if row.get(column) is not None:
                continue
            value = defaults.get(column)
            if value is None:
                continue
            row[column] = value
            imputed.append(
                {
                    "record_id": str(record_id),
                    "column": column,
                    "method": "column_default",
                    "value": value,
                }
            )
    return imputed


def infer_default(rows: list[dict[str, Any]], column: str) -> Any:
    values = [row.get(column) for row in rows if row.get(column) is not None]
    if not values:
        return "IMPUTED_UNKNOWN"
    sample = values[0]
    if isinstance(sample, bool):
        true_count = sum(1 for value in values if value is True)
        return true_count >= len(values) / 2
    if isinstance(sample, int) and not isinstance(sample, bool):
        numeric_values = [value for value in values if isinstance(value, int) and not isinstance(value, bool)]
        return round(sum(numeric_values) / len(numeric_values)) if numeric_values else 0
    if isinstance(sample, float):
        numeric_values = [value for value in values if isinstance(value, (int, float)) and not isinstance(value, bool)]
        return round(sum(numeric_values) / len(numeric_values), 2) if numeric_values else 0.0
    text_values = [str(value).strip() for value in values if str(value).strip()]
    return most_common(text_values) if text_values else "IMPUTED_UNKNOWN"


def most_common(values: list[str]) -> str:
    counts: dict[str, int] = {}
    for value in values:
        counts[value] = counts.get(value, 0) + 1
    return sorted(counts.items(), key=lambda item: (-item[1], item[0]))[0][0]

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
