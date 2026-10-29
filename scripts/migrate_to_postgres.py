"""
Copy the app's local CSV/JSON data into Postgres (see store.py).

    DATABASE_URL=postgresql://... venv/bin/python scripts/migrate_to_postgres.py

Run it once, from the machine that has the real data, before starting the app
with DATABASE_URL set. A table that already holds rows in Postgres is skipped
unless you pass --force, so running it twice never duplicates or overwrites
data. The local files are left untouched.
"""

import builtins
import csv
import json
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)

from dotenv import load_dotenv  # noqa: E402

load_dotenv(os.path.join(ROOT, ".env"))

import store  # noqa: E402


def main():
    if not store.enabled():
        sys.exit("DATABASE_URL is not set (in the environment or .env).")

    force = "--force" in sys.argv[1:]

    for relative, table in store.CSV_FILES.items():
        path = os.path.join(ROOT, relative)
        if not os.path.exists(path):
            print(f"skip   {table:26} (no local {relative})")
            continue

        with builtins.open(path, newline="", encoding="utf-8-sig") as f:
            reader = csv.reader(f)
            header = next(reader, None) or []
            rows = [row for row in reader if row]

        existing = store.read_csv_table(table)
        if existing and existing[1] and not force:
            print(f"skip   {table:26} (already has {len(existing[1])} rows; --force to replace)")
            continue

        store.write_csv_table(table, header, rows)
        print(f"copied {table:26} {len(rows)} rows")

    for relative, name in store.JSON_FILES.items():
        path = os.path.join(ROOT, relative)
        if not os.path.exists(path):
            print(f"skip   {name:26} (no local {relative})")
            continue

        with builtins.open(path, encoding="utf-8") as f:
            content = json.load(f)

        if store.read_json_document(name) and not force:
            print(f"skip   {name:26} (already in Postgres; --force to replace)")
            continue

        store.write_json_document(name, content)
        print(f"copied {name:26} JSON document")


if __name__ == "__main__":
    main()
