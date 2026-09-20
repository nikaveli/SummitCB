CREATE TABLE IF NOT EXISTS inquiries (
  id TEXT PRIMARY KEY,
  received_at TEXT NOT NULL,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL DEFAULT '',
  city TEXT NOT NULL,
  service TEXT NOT NULL,
  timing TEXT NOT NULL DEFAULT '',
  message TEXT NOT NULL,
  landing_path TEXT NOT NULL DEFAULT '',
  referring_host TEXT NOT NULL DEFAULT '',
  channel TEXT NOT NULL,
  delivery_status TEXT NOT NULL,
  delivery_error TEXT
);

CREATE INDEX IF NOT EXISTS inquiries_received_at ON inquiries(received_at DESC);

CREATE TABLE IF NOT EXISTS inquiry_attempts (
  fingerprint TEXT NOT NULL,
  attempted_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS inquiry_attempts_lookup ON inquiry_attempts(fingerprint, attempted_at);
