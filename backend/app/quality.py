from .schemas import QualityCheck


def validate_rows(rows: list[dict]) -> tuple[int, list[QualityCheck]]:
    total = len(rows)
    has_id = sum(1 for row in rows if row.get("id") is not None)
    has_data = sum(1 for row in rows if len(row.keys()) > 1)

    null_safe = 0
    for row in rows:
        values = list(row.values())
        if not values:
            continue
        empty = sum(1 for value in values if value is None or value == "")
        if empty / len(values) < 0.35:
            null_safe += 1

    checks = [
        QualityCheck(name="record_count", passed=total > 0, value=f"{total} rows"),
        QualityCheck(name="primary_key", passed=total > 0 and has_id == total, value=f"{has_id}/{total}"),
        QualityCheck(name="schema_not_empty", passed=total > 0 and has_data == total, value=f"{has_data}/{total}"),
        QualityCheck(name="null_threshold", passed=total > 0 and null_safe / total >= 0.9, value=f"{null_safe}/{total}"),
    ]
    score = round(sum(1 for check in checks if check.passed) / len(checks) * 100)
    return score, checks
