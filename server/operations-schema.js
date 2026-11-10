// Additive operational controls; posted financial records are never rewritten.
import { atomic } from "./db.js";
export function migrateOperations(db) {
  if (db.prepare("SELECT 1 FROM migrations WHERE version=11").get()) return;
  atomic(db, () =>
    db.exec(`
    CREATE TABLE cash_shifts (
      id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), account_id TEXT NOT NULL REFERENCES accounts(id),
      opening INTEGER NOT NULL CHECK(typeof(opening)='integer' AND opening>=0), opened_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open','submitted','approved','rejected')),
      counted INTEGER, expected INTEGER, difference INTEGER, note TEXT NOT NULL DEFAULT '', closed_at TEXT,
      reviewer TEXT REFERENCES users(id), decision_reason TEXT, decided_at TEXT,
      request_key TEXT NOT NULL UNIQUE
    );
    CREATE UNIQUE INDEX one_open_shift ON cash_shifts(user_id,account_id) WHERE status='open';
    CREATE TABLE shift_receipts (transaction_id TEXT PRIMARY KEY REFERENCES transactions(id), shift_id TEXT NOT NULL REFERENCES cash_shifts(id));
    CREATE INDEX receipts_by_shift ON shift_receipts(shift_id);
    CREATE TABLE budgets (id TEXT PRIMARY KEY, month TEXT NOT NULL, category TEXT NOT NULL, amount INTEGER NOT NULL CHECK(typeof(amount)='integer' AND amount>0), user_id TEXT NOT NULL REFERENCES users(id), changed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, UNIQUE(month,category));
    CREATE TABLE document_followups (id TEXT PRIMARY KEY, kind TEXT NOT NULL CHECK(kind IN ('customer','supplier')), document_id TEXT NOT NULL,
      owner_id TEXT NOT NULL REFERENCES users(id), promised_date TEXT NOT NULL, note TEXT NOT NULL, user_id TEXT NOT NULL REFERENCES users(id), created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
    CREATE INDEX followup_document ON document_followups(kind,document_id,created_at);
    CREATE TABLE recurring_templates (id TEXT PRIMARY KEY, kind TEXT NOT NULL CHECK(kind IN ('invoice','expense')), name TEXT NOT NULL,
      contact_id TEXT NOT NULL REFERENCES contacts(id), amount INTEGER NOT NULL CHECK(typeof(amount)='integer' AND amount>0),
      category TEXT NOT NULL DEFAULT '', description TEXT NOT NULL, next_date TEXT NOT NULL, interval_months INTEGER NOT NULL CHECK(interval_months BETWEEN 1 AND 12),
      due_days INTEGER NOT NULL CHECK(due_days BETWEEN 0 AND 365), active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)), user_id TEXT NOT NULL REFERENCES users(id));
    CREATE TABLE recurring_drafts (id TEXT PRIMARY KEY, template_id TEXT NOT NULL REFERENCES recurring_templates(id), occurrence TEXT NOT NULL,
      payload TEXT NOT NULL CHECK(json_valid(payload)), status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','published','dismissed')),
      result_id TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, UNIQUE(template_id,occurrence));
    CREATE TABLE purchase_requests (id TEXT PRIMARY KEY, number TEXT NOT NULL UNIQUE, contact_id TEXT NOT NULL REFERENCES contacts(id),
      description TEXT NOT NULL, amount INTEGER NOT NULL CHECK(typeof(amount)='integer' AND amount>0), user_id TEXT NOT NULL REFERENCES users(id),
      status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected')), reason TEXT NOT NULL DEFAULT '',
      reviewer TEXT REFERENCES users(id), decided_at TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE purchase_orders (id TEXT PRIMARY KEY, request_id TEXT NOT NULL UNIQUE REFERENCES purchase_requests(id), number TEXT NOT NULL UNIQUE, created_by TEXT NOT NULL REFERENCES users(id), created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE purchase_bill_links (order_id TEXT PRIMARY KEY REFERENCES purchase_orders(id), bill_id TEXT NOT NULL UNIQUE REFERENCES supplier_bills(id), user_id TEXT NOT NULL REFERENCES users(id), created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE backup_policy (id INTEGER PRIMARY KEY CHECK(id=1), enabled INTEGER NOT NULL DEFAULT 0 CHECK(enabled IN (0,1)), interval_hours INTEGER NOT NULL DEFAULT 24 CHECK(interval_hours BETWEEN 1 AND 168), retention_count INTEGER NOT NULL DEFAULT 14 CHECK(retention_count BETWEEN 2 AND 90), changed_by TEXT REFERENCES users(id), changed_at TEXT);
    INSERT INTO backup_policy(id) VALUES(1);
    CREATE TABLE backup_runs (id TEXT PRIMARY KEY, status TEXT NOT NULL CHECK(status IN ('running','verified','failed')), filename TEXT, sha256 TEXT, error TEXT, started_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, completed_at TEXT);
    CREATE TABLE mfa_credentials (user_id TEXT PRIMARY KEY REFERENCES users(id), secret TEXT NOT NULL, enabled INTEGER NOT NULL DEFAULT 0 CHECK(enabled IN (0,1)), recovery TEXT NOT NULL DEFAULT '[]', last_counter INTEGER NOT NULL DEFAULT -1, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE reminder_states (user_id TEXT NOT NULL REFERENCES users(id), reminder_id TEXT NOT NULL, snoozed_until TEXT, completed INTEGER NOT NULL DEFAULT 0 CHECK(completed IN (0,1)), PRIMARY KEY(user_id,reminder_id));
    INSERT INTO migrations(version) VALUES(11);
  `),
  );
}
