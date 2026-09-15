CREATE TABLE IF NOT EXISTS ltp_meta (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  revision INTEGER NOT NULL DEFAULT 0,
  schema_version TEXT NOT NULL,
  app_version TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS ltp_records (
  collection TEXT NOT NULL,
  id TEXT NOT NULL,
  json TEXT NOT NULL CHECK (json_valid(json)),
  updated_at TEXT NOT NULL,
  PRIMARY KEY (collection, id)
);

CREATE INDEX IF NOT EXISTS idx_ltp_records_collection ON ltp_records(collection);

CREATE TABLE IF NOT EXISTS ltp_write_lock (
  id TEXT PRIMARY KEY,
  holder TEXT NOT NULL,
  expires_at INTEGER NOT NULL
);
