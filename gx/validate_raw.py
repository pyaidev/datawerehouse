import argparse
import json
from pathlib import Path

import pandas as pd
from great_expectations.dataset import PandasDataset


class RawWarehouseDataset(PandasDataset):
    pass


def read_json_any(path: Path) -> pd.DataFrame:
    text = path.read_text(encoding="utf-8").strip()
    if not text:
        return pd.DataFrame()
    if text.startswith("["):
        return pd.DataFrame(json.loads(text))
    return pd.read_json(path, lines=True)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True)
    parser.add_argument("--output", default="data/quality/validation_result.json")
    parser.add_argument("--id-column", default="id")
    args = parser.parse_args()

    df = read_json_any(Path(args.input))
    dataset = RawWarehouseDataset(df)

    results = []
    results.append(dataset.expect_table_row_count_to_be_between(min_value=1))
    if args.id_column in df.columns:
        results.append(dataset.expect_column_values_to_not_be_null(args.id_column))
        results.append(dataset.expect_column_values_to_be_unique(args.id_column))
    results.append(dataset.expect_table_column_count_to_be_between(min_value=2))

    validation = dataset.validate(result_format="SUMMARY")
    output = Path(args.output)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(validation, indent=2, default=str), encoding="utf-8")
    print(f"success={validation['success']} output={output}")


if __name__ == "__main__":
    main()
