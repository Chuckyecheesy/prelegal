"""SQLite database wiring.

Per the project's target architecture, the database is recreated from
scratch on every startup — no persistence across restarts, no migrations.
"""

import sqlite3
from pathlib import Path

from app.nda_fields import NDA_DOCUMENT_TYPE

DB_PATH = Path(__file__).resolve().parent.parent / "prelegal.db"

SCHEMA = f"""
CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE sessions (
    token TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE documents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    document_type TEXT NOT NULL DEFAULT '{NDA_DOCUMENT_TYPE}',
    party_a_name TEXT NOT NULL,
    party_b_name TEXT NOT NULL,
    fields_json TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
"""


def reset_db() -> None:
    """Delete any existing database file and recreate it with a fresh schema."""
    DB_PATH.unlink(missing_ok=True)
    conn = sqlite3.connect(DB_PATH)
    try:
        conn.executescript(SCHEMA)
        conn.commit()
    finally:
        conn.close()


def get_connection() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn
