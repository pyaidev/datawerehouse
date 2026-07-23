from __future__ import annotations

import csv
import re
from functools import lru_cache
from itertools import islice
from pathlib import Path
from typing import Any

IDENTIFIER_COLUMNS = {"inn", "soato", "okpo"}
INTEGER_PATTERN = re.compile(r"^-?\d+$")
DECIMAL_PATTERN = re.compile(r"^-?\d+[.,]\d+$")


def estat_12_korxona(
    configured_path: str,
    *,
    limit: int = 20,
    skip: int = 0,
) -> dict[str, Any]:
    path = resolve_estat_csv(configured_path)
    requested_limit = max(1, min(limit, 100))
    requested_skip = max(0, skip)
    stat = path.stat()
    total = csv_row_count(str(path), stat.st_mtime_ns)

    records: list[dict[str, Any]] = []
    with path.open("r", encoding="utf-8-sig", newline="") as stream:
        reader = csv.DictReader(stream, delimiter=";")
        columns = list(reader.fieldnames or [])
        for row_number, row in enumerate(
            islice(reader, requested_skip, requested_skip + requested_limit),
            start=requested_skip + 1,
        ):
            row.pop(None, None)
            record = {
                column: parse_csv_value(column, row.get(column))
                for column in columns
            }
            record["id"] = f"{record.get('inn') or 'unknown'}:{row_number}"
            record["_row_number"] = row_number
            records.append(record)

    null_cells = sum(
        1
        for record in records
        for column in columns
        if record.get(column) is None
    )
    organizations = len(
        {record.get("inn") for record in records if record.get("inn")}
    )

    return {
        "records": records,
        "total": total,
        "skip": requested_skip,
        "limit": requested_limit,
        "source": "eStat 4.0",
        "form": "12-korxona",
        "period": "Iyun",
        "file": path.name,
        "encoding": "utf-8",
        "delimiter": ";",
        "columns": columns,
        "column_count": len(columns),
        "organizations_in_page": organizations,
        "null_cells_in_page": null_cells,
        "description": (
            "12-korxona shakli Iyun CSV faylidan limit/skip bilan "
            "o'qilgan real eStat test API."
        ),
    }


def resolve_estat_csv(configured_path: str) -> Path:
    configured = Path(configured_path)
    candidates = [
        configured,
        Path.cwd() / configured,
        Path.cwd().parent / configured,
    ]
    for candidate in candidates:
        if candidate.is_file():
            return candidate.resolve()

    for base in (Path.cwd(), Path.cwd().parent):
        match = next(base.glob("12-korxona*.csv"), None)
        if match and match.is_file():
            return match.resolve()

    raise FileNotFoundError(
        f"eStat CSV topilmadi: configured_path={configured_path}"
    )


@lru_cache(maxsize=8)
def csv_row_count(path: str, modified_ns: int) -> int:
    del modified_ns
    with Path(path).open("r", encoding="utf-8-sig", newline="") as stream:
        reader = csv.reader(stream, delimiter=";")
        return max(sum(1 for _ in reader) - 1, 0)


def parse_csv_value(column: str, value: str | None) -> Any:
    if value is None:
        return None
    normalized = value.strip()
    if not normalized:
        return None
    if column in IDENTIFIER_COLUMNS:
        return normalized
    if INTEGER_PATTERN.fullmatch(normalized):
        return int(normalized)
    if DECIMAL_PATTERN.fullmatch(normalized):
        return float(normalized.replace(",", "."))
    return normalized
