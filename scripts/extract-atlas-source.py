import json
import sys
from pathlib import Path

import openpyxl


def clean(value):
    if value is None:
        return None
    if hasattr(value, "isoformat"):
        return value.isoformat(sep=" ")
    return value


def main():
    if len(sys.argv) != 3:
        raise SystemExit("usage: extract-atlas-source.py <input.xlsx> <output.json>")

    input_path = Path(sys.argv[1])
    output_path = Path(sys.argv[2])
    wb = openpyxl.load_workbook(input_path, data_only=True)
    ws = wb["Transactions"]

    transactions = []
    for row_index, row in enumerate(ws.iter_rows(min_row=2, values_only=True), start=2):
        date, category, description, amount, comment = (list(row) + [None] * 5)[:5]
        if not any([date, category, description, amount, comment]):
            continue
        transactions.append(
            {
                "source_row": row_index,
                "date": clean(date),
                "original_category": clean(category),
                "description": clean(description),
                "amount": float(amount or 0),
                "comment": clean(comment),
            }
        )

    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(
        json.dumps({"transactions": transactions}, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )


if __name__ == "__main__":
    main()
