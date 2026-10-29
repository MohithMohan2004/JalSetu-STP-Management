"""
Postgres-backed storage for the app's CSV and JSON data files.

app.py reads and writes its records through ``with open(PATH) as f`` plus
csv.DictReader / csv.DictWriter / json. This module keeps that code working
unchanged while moving the data into Postgres:

* ``register_csv(path, table)`` / ``register_json(path, name)`` mark a file
  as managed.
* ``store.open``, ``store.exists`` and ``store.getsize`` are drop-in
  replacements for ``open``, ``os.path.exists`` and ``os.path.getsize``.
  For a managed path they return a virtual file backed by Postgres; for
  every other path they call the real function.

When DATABASE_URL is not set, nothing is managed and the app keeps using
the files on disk.

Each CSV file becomes a real table (one TEXT column per CSV column, plus a
``_row`` position key), so the data can be queried directly. New CSV columns
are added with ALTER TABLE when the app writes them. A write only touches the
rows that changed. JSON files are stored as JSONB documents.

Tables live in their own schema (DATABASE_SCHEMA, default ``reflow``) so
Supabase's public REST API does not expose them.
"""

import builtins
import csv
import io
import json
import os
import threading

from sqlalchemy import (
    JSON,
    Column,
    Integer,
    MetaData,
    String,
    Table,
    Text,
    create_engine,
    delete,
    insert,
    inspect,
    select,
    text,
    update,
)
from sqlalchemy.dialects.postgresql import JSONB


DATABASE_URL = (os.getenv("DATABASE_URL") or "").strip()
SCHEMA = (os.getenv("DATABASE_SCHEMA") or "reflow").strip()

_csv_tables = {}    # absolute path -> table name
_json_docs = {}     # absolute path -> document name
_lock = threading.RLock()
_cache = {}         # table name -> (version, columns, rows)
_request = threading.local()  # per-request memo of store_files rows

engine = None
_metadata = None
_files_table = None
_docs_table = None
_tables = {}


def _normalise_url(url):
    # Supabase hands out postgres:// or postgresql:// URLs; use psycopg 3.
    for prefix in ("postgres://", "postgresql://"):
        if url.startswith(prefix):
            return "postgresql+psycopg://" + url[len(prefix):]
    return url


def _connect():
    global engine, _metadata, _files_table, _docs_table, SCHEMA

    url = _normalise_url(DATABASE_URL)
    connect_args = {}

    if url.startswith("postgresql"):
        # Supabase's transaction pooler (port 6543) can't use prepared statements.
        connect_args["prepare_threshold"] = None
    else:
        SCHEMA = None  # SQLite has no schemas

    engine = create_engine(
        url,
        pool_pre_ping=True,
        pool_size=5,
        max_overflow=5,
        connect_args=connect_args,
    ) if url.startswith("postgresql") else create_engine(url)

    _metadata = MetaData(schema=SCHEMA)

    # One row per managed file: its column order and a version that every
    # write bumps, so readers can reuse their cached copy.
    _files_table = Table(
        "store_files",
        _metadata,
        Column("name", String(128), primary_key=True),
        Column("columns", JSON().with_variant(JSONB, "postgresql")),
        Column("version", Integer, nullable=False, default=1),
    )

    _docs_table = Table(
        "json_documents",
        _metadata,
        Column("name", String(128), primary_key=True),
        Column("content", JSON().with_variant(JSONB, "postgresql")),
    )

    with engine.begin() as conn:
        if SCHEMA:
            conn.execute(text(f'CREATE SCHEMA IF NOT EXISTS "{SCHEMA}"'))
        _metadata.create_all(conn, tables=[_files_table, _docs_table])


def enabled():
    return engine is not None


def _key(path):
    return os.path.abspath(os.fspath(path))


def register_csv(path, table):
    if enabled():
        _csv_tables[_key(path)] = table


def register_json(path, name):
    if enabled():
        _json_docs[_key(path)] = name


# =========================================================
# CSV TABLES
# =========================================================

def _table(conn, name, columns):
    """Return the SQLAlchemy table for ``name``, creating it or adding columns."""
    table = _tables.get(name)

    if table is None:
        if inspect(conn).has_table(name, schema=SCHEMA):
            table = Table(name, MetaData(schema=SCHEMA), autoload_with=conn)
        else:
            table = Table(
                name,
                MetaData(schema=SCHEMA),
                Column("_row", Integer, primary_key=True),
                *[Column(column, Text) for column in columns],
            )
            table.create(conn)
        _tables[name] = table

    missing = [column for column in columns if column not in table.c]
    if missing:
        prefix = f'"{SCHEMA}".' if SCHEMA else ""
        for column in missing:
            quoted = column.replace('"', '""')
            conn.execute(text(
                f'ALTER TABLE {prefix}"{name}" ADD COLUMN "{quoted}" TEXT'
            ))
        _tables.pop(name)
        table = Table(name, MetaData(schema=SCHEMA), autoload_with=conn)
        _tables[name] = table

    return table


def begin_request():
    """Within one web request, look up each table's version only once."""
    _request.info = {}


def end_request():
    _request.info = None


def _file_info(conn, name):
    memo = getattr(_request, "info", None)
    if memo is not None and name in memo:
        return memo[name]

    info = conn.execute(
        select(_files_table.c.columns, _files_table.c.version)
        .where(_files_table.c.name == name)
    ).first()

    if memo is not None:
        memo[name] = info
    return info


def _forget(name):
    memo = getattr(_request, "info", None)
    if memo is not None:
        memo.pop(name, None)


def read_csv_table(name):
    """Return (columns, rows) for a CSV table, or None if it doesn't exist yet."""
    with _lock, engine.connect() as conn:
        info = _file_info(conn, name)
        if info is None:
            return None

        columns, version = list(info.columns or []), info.version
        cached = _cache.get(name)
        if cached and cached[0] == version:
            return cached[1], cached[2]

        rows = []
        if columns:
            table = _table(conn, name, columns)
            result = conn.execute(
                select(*[table.c[column] for column in columns])
                .order_by(table.c._row)
            )
            rows = [
                ["" if value is None else value for value in row]
                for row in result
            ]

        _cache[name] = (version, columns, rows)
        return columns, rows


def write_csv_table(name, columns, rows):
    """Replace a CSV table's contents, touching only the rows that changed."""
    columns = list(columns)
    if len(set(columns)) != len(columns) or any(
        not column or column == "_row" for column in columns
    ):
        raise ValueError(f"store: bad CSV header for {name}: {columns}")

    width = len(columns)
    rows = [
        (list(row) + [""] * width)[:width]
        for row in rows
    ]

    with _lock, engine.begin() as conn:
        table = _table(conn, name, columns)

        old = {}
        if _file_info(conn, name) is not None:
            result = conn.execute(
                select(table.c._row, *[table.c[column] for column in columns])
            )
            old = {
                row[0]: ["" if value is None else value for value in row[1:]]
                for row in result
            }

        new_rows, changed = [], []
        for index, row in enumerate(rows):
            if index not in old:
                new_rows.append({"_row": index, **dict(zip(columns, row))})
            elif old[index] != row:
                changed.append((index, dict(zip(columns, row))))

        if new_rows:
            conn.execute(insert(table), new_rows)
        for index, values in changed:
            conn.execute(
                update(table).where(table.c._row == index).values(**values)
            )
        if len(old) > len(rows):
            conn.execute(delete(table).where(table.c._row >= len(rows)))

        _forget(name)
        info = _file_info(conn, name)
        if info is None:
            conn.execute(insert(_files_table).values(
                name=name, columns=columns, version=1
            ))
            version = 1
        else:
            version = info.version + 1
            conn.execute(
                update(_files_table)
                .where(_files_table.c.name == name)
                .values(columns=columns, version=version)
            )

    _cache[name] = (version, columns, rows)
    _forget(name)


def _csv_text(columns, rows):
    buffer = io.StringIO()
    if columns:
        writer = csv.writer(buffer)
        writer.writerow(columns)
        writer.writerows(rows)
    return buffer.getvalue()


# =========================================================
# JSON DOCUMENTS
# =========================================================

def read_json_document(name):
    with engine.connect() as conn:
        row = conn.execute(
            select(_docs_table.c.content).where(_docs_table.c.name == name)
        ).first()
    return None if row is None else row.content


def write_json_document(name, content):
    with _lock, engine.begin() as conn:
        exists = conn.execute(
            select(_docs_table.c.name).where(_docs_table.c.name == name)
        ).first()
        if exists:
            conn.execute(
                update(_docs_table)
                .where(_docs_table.c.name == name)
                .values(content=content)
            )
        else:
            conn.execute(insert(_docs_table).values(name=name, content=content))


# =========================================================
# FILE-LIKE INTERFACE
# =========================================================

class _VirtualFile(io.StringIO):
    """In-memory file that saves its contents to Postgres when closed."""

    def __init__(self, initial, save, writable):
        super().__init__(initial)
        self._save = save if writable else None
        self._failed = False
        if writable:
            self.seek(0, io.SEEK_END)

    def __exit__(self, exc_type, exc, tb):
        # Like a transaction: don't save a half-written file.
        self._failed = exc_type is not None
        return super().__exit__(exc_type, exc, tb)

    def close(self):
        if not self.closed and self._save and not self._failed:
            self._save(self.getvalue())
        super().close()


def _save_csv(name, content):
    reader = csv.reader(io.StringIO(content))
    header = next(reader, None) or []
    write_csv_table(name, header, [row for row in reader if row])


def _save_json(name, content):
    write_json_document(name, json.loads(content) if content.strip() else None)


def _mode_kind(mode):
    if "b" in mode:
        raise ValueError(f"store: binary mode {mode!r} isn't supported for managed files")
    if "+" in mode:
        raise ValueError(f"store: mode {mode!r} isn't supported for managed files")
    return mode[0]


def open(file, mode="r", *args, **kwargs):
    key = _key(file) if isinstance(file, (str, os.PathLike)) else None

    if key in _csv_tables:
        name = _csv_tables[key]
        kind = _mode_kind(mode)

        if kind == "w":
            initial = ""
        else:
            existing = read_csv_table(name)
            if existing is None:
                if kind == "r":
                    raise FileNotFoundError(f"store: {name} has no data yet")
                initial = ""
            else:
                initial = _csv_text(*existing)

        return _VirtualFile(
            initial,
            lambda content: _save_csv(name, content),
            writable=kind in "wa",
        )

    if key in _json_docs:
        name = _json_docs[key]
        kind = _mode_kind(mode)
        if kind == "a":
            raise ValueError("store: append mode isn't supported for JSON documents")

        initial = ""
        if kind == "r":
            if not exists(file):
                raise FileNotFoundError(f"store: {name} has no data yet")
            initial = json.dumps(read_json_document(name), indent=2)

        return _VirtualFile(
            initial,
            lambda content: _save_json(name, content),
            writable=kind == "w",
        )

    return builtins.open(file, mode, *args, **kwargs)


def exists(path):
    key = _key(path)

    if key in _csv_tables:
        with engine.connect() as conn:
            return _file_info(conn, _csv_tables[key]) is not None

    if key in _json_docs:
        with engine.connect() as conn:
            return conn.execute(
                select(_docs_table.c.name)
                .where(_docs_table.c.name == _json_docs[key])
            ).first() is not None

    return os.path.exists(path)


def getsize(path):
    key = _key(path)

    if key in _csv_tables:
        existing = read_csv_table(_csv_tables[key])
        if existing is None:
            raise FileNotFoundError(f"store: {_csv_tables[key]} has no data yet")
        return len(_csv_text(*existing).encode("utf-8"))

    if key in _json_docs:
        if not exists(path):
            raise FileNotFoundError(f"store: {_json_docs[key]} has no data yet")
        return len(json.dumps(read_json_document(_json_docs[key])).encode("utf-8"))

    return os.path.getsize(path)


# Non-synthetic data files that move to Postgres, relative to the project root.
# Uploads, OCEMS sheets, synthetic datasets and ML data stay on disk.
CSV_FILES = {
    "database/orders.csv": "orders",
    "database/stp_registrations.csv": "stp_registrations",
    "database/stp_transfers.csv": "stp_transfers",
    "database/tanker_registrations.csv": "tanker_registrations",
    "database/tanker_vehicles.csv": "tanker_vehicles",
    "database/tanker_vehicle_documents.csv": "tanker_vehicle_documents",
    "database/ocems_submissions.csv": "ocems_submissions",
    "data/stp_pricing.csv": "stp_pricing",
    "database/stp_pricing.csv": "stp_pricing_fallback",
}

JSON_FILES = {
    "data/stp_data.json": "stps",
    "data/stp_status.json": "stp_status",
    "data/profile_overrides.json": "profile_overrides",
}

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

if DATABASE_URL:
    _connect()
    for _file, _name in CSV_FILES.items():
        register_csv(os.path.join(BASE_DIR, _file), _name)
    for _file, _name in JSON_FILES.items():
        register_json(os.path.join(BASE_DIR, _file), _name)
