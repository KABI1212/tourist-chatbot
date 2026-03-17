import sqlite3
import pandas as pd

# Specify database file path
db_path = "D:\\project\\tourists\\tourist_chatbot\\db.sqlite3"  # Replace with your database file path
excel_path = "output.xlsx"  # Desired Excel file output path

# Connect to the SQLite database
conn = sqlite3.connect(db_path)

# Get all table names
query = "SELECT name FROM sqlite_master WHERE type='table';"
tables = pd.read_sql(query, conn)

# Automatically create and populate the Excel file
with pd.ExcelWriter(excel_path, engine="openpyxl") as writer:
    for table in tables["name"]:
        # Fetch the table data
        df = pd.read_sql(f"SELECT * FROM {table};", conn)
        # Write the table data to a sheet named after the table
        df.to_excel(writer, sheet_name=table, index=False)

# Close the database connection
conn.close()

print(f"Excel file '{excel_path}' created successfully with all database tables.")
