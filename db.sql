
CREATE TABLE IF NOT EXISTS tickets (
  id TEXT PRIMARY KEY,
  issued_at TEXT NOT NULL,
  employee_id TEXT,
  items_json TEXT NOT NULL,
  unit_totals_json TEXT NOT NULL,
  total_amount REAL NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('issued','redeemed','void')) DEFAULT 'issued',
  expires_at TEXT,
  hash TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets(status);
