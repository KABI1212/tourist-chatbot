"""
Utility script: export all SQLite tables to an Excel file.
Run from the project root:  python excel.py
"""
import sqlite3
from pathlib import Path
import pandas as pd

BASE_DIR = Path(__file__).resolve().parent
db_path = BASE_DIR / "db.sqlite3"
excel_path = BASE_DIR / "output.xlsx"

if not db_path.exists():
    print(f"Database not found at {db_path}")
    raise SystemExit(1)

conn = sqlite3.connect(db_path)

query = "SELECT name FROM sqlite_master WHERE type='table';"
tables = pd.read_sql(query, conn)

with pd.ExcelWriter(excel_path, engine="openpyxl") as writer:
    for table in tables["name"]:
        df = pd.read_sql(f"SELECT * FROM {table};", conn)
        df.to_excel(writer, sheet_name=table[:31], index=False)  # sheet name max 31 chars

conn.close()
print(f"Excel file saved to: {excel_path}")
