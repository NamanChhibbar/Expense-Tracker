'''SQLite schema and connection helper.'''

import sqlite3
from collections.abc import Iterator
from contextlib import contextmanager

from .config import DB_PATH

SCHEMA = '''
PRAGMA journal_mode = WAL;
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE COLLATE NOCASE,
  emoji TEXT NOT NULL DEFAULT '🌸',
  currency TEXT NOT NULL DEFAULT 'USD',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS expenses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
  category TEXT NOT NULL,
  spent_on TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_expenses_user ON expenses(user_id, spent_on);
'''

USER_COLS = 'id, name, emoji, currency'
EXPENSE_COLS = 'id, description, amount_cents, category, spent_on'


@contextmanager
def connect() -> Iterator[sqlite3.Connection]:
  '''Open a connection, commit on success, roll back on error, always close.'''
  conn = sqlite3.connect(DB_PATH)
  conn.row_factory = sqlite3.Row
  conn.execute('PRAGMA foreign_keys = ON')
  try:
    with conn:
      yield conn
  finally:
    conn.close()


def init_db() -> None:
  '''Create the data folder and tables if they don't exist yet.'''
  DB_PATH.parent.mkdir(parents=True, exist_ok=True)
  with connect() as conn:
    conn.executescript(SCHEMA)
