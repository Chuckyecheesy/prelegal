"""SQLite database wiring.

Per the project's target architecture, the database is recreated from
scratch on every startup — no persistence across restarts, no migrations.
"""

import sqlite3
from pathlib import Path

DB_PATH = Path(__file__).resolve().parent.parent / "prelegal.db"


def reset_db() -> None:
    """Delete any existing database file and create a fresh one."""
    DB_PATH.unlink(missing_ok=True)
    DB_PATH.touch()


def get_connection() -> sqlite3.Connection:
    return sqlite3.connect(DB_PATH)
