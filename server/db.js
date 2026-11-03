import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import {
  randomUUID,
  randomBytes,
  scryptSync,
  timingSafeEqual,
} from "node:crypto";

export const id = () => randomUUID();
export function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  return `${salt}:${scryptSync(password, salt, 64).toString("hex")}`;
}
export function verifyPassword(password, stored) {
  if (
    typeof stored !== "string" ||
    !/^[a-f0-9]{32}:[a-f0-9]{128}$/.test(stored)
  )
    return false;
  const [salt, hash] = stored.split(":");
  return timingSafeEqual(
    Buffer.from(hash, "hex"),
    scryptSync(password, salt, 64),
  );
}
export function money(value) {
  if (typeof value !== "string" || !/^\d{1,10}(\.\d{1,2})?$/.test(value))
    throw new Error("Enter a positive amount with at most two decimal places.");
  const [whole, fraction = ""] = value.split(".");
  const minor = Number(BigInt(whole) * 100n + BigInt(fraction.padEnd(2, "0")));
  if (!Number.isSafeInteger(minor) || minor <= 0)
    throw new Error("Amount must be greater than zero.");
  return minor;
}
export function isoDate(value) {
  const parsed =
    typeof value === "string" ? new Date(value + "T00:00:00Z") : null;
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
    !Number.isFinite(parsed?.getTime()) ||
    parsed.toISOString().slice(0, 10) !== value
  )
    throw new Error("Use a valid date in YYYY-MM-DD format.");
  return value;
}
export function atomic(db, fn) {
  db.exec("BEGIN IMMEDIATE");
  try {
    const result = fn();
    db.exec("COMMIT");
    return result;
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}
export function audit(db, user, action, entity, details = {}) {
  db.prepare(
    "INSERT INTO audit_events (id,user_id,action,entity,details) VALUES (?,?,?,?,?)",
  ).run(id(), user, action, entity, JSON.stringify(details));
}
export function openDb(
  filename = process.env.DB_PATH || "./data/workspace.db",
) {
  if (filename !== ":memory:")
    mkdirSync(dirname(resolve(filename)), { recursive: true });
  const db = new DatabaseSync(filename);
  db.exec(
    "PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;",
  );
  db.exec(`
    CREATE TABLE IF NOT EXISTS migrations (version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
  `);
  if (!db.prepare("SELECT 1 FROM migrations WHERE version=1").get()) {
    atomic(db, () =>
      db.exec(`
      CREATE TABLE settings (id INTEGER PRIMARY KEY CHECK(id=1), name TEXT NOT NULL, currency TEXT NOT NULL DEFAULT 'SLE', timezone TEXT NOT NULL DEFAULT 'Africa/Freetown');
      INSERT INTO settings (id,name) VALUES (1,'Your organisation');
      CREATE TABLE users (id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE, password TEXT NOT NULL, role TEXT NOT NULL CHECK(role IN ('admin','manager','finance','cashier','auditor')), active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)));
      CREATE TABLE sessions (token TEXT PRIMARY KEY, user_id TEXT REFERENCES users(id), csrf TEXT NOT NULL, expires INTEGER NOT NULL);
      CREATE TABLE accounts (id TEXT PRIMARY KEY, name TEXT NOT NULL UNIQUE, channel TEXT NOT NULL CHECK(channel IN ('cash','mobile','bank')), provider TEXT NOT NULL DEFAULT '', currency TEXT NOT NULL DEFAULT 'SLE', active INTEGER NOT NULL DEFAULT 1);
      CREATE TABLE contacts (id TEXT PRIMARY KEY, name TEXT NOT NULL, type TEXT NOT NULL CHECK(type IN ('customer','supplier')), phone TEXT NOT NULL DEFAULT '', active INTEGER NOT NULL DEFAULT 1);
      CREATE TABLE transactions (id TEXT PRIMARY KEY, date TEXT NOT NULL, amount INTEGER NOT NULL CHECK(typeof(amount)='integer' AND amount>0 AND amount<=999999999999), direction TEXT NOT NULL CHECK(direction IN ('in','out')), account_id TEXT NOT NULL REFERENCES accounts(id), reference TEXT NOT NULL, description TEXT NOT NULL, category TEXT NOT NULL, contact_id TEXT REFERENCES contacts(id), user_id TEXT NOT NULL REFERENCES users(id), approval TEXT NOT NULL CHECK(approval IN ('not_required','pending','approved','rejected')), reconciliation TEXT NOT NULL DEFAULT 'unmatched' CHECK(reconciliation IN ('unmatched','reconciled')), reversal_of TEXT UNIQUE REFERENCES transactions(id), request_key TEXT NOT NULL UNIQUE, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
      CREATE INDEX tx_date_account ON transactions(date,account_id);
      CREATE INDEX tx_reference ON transactions(account_id,reference);
      CREATE TABLE invoices (id TEXT PRIMARY KEY, number TEXT NOT NULL UNIQUE, contact_id TEXT NOT NULL REFERENCES contacts(id), issued TEXT NOT NULL, due TEXT NOT NULL, amount INTEGER NOT NULL CHECK(typeof(amount)='integer' AND amount>0), description TEXT NOT NULL, user_id TEXT NOT NULL REFERENCES users(id));
      CREATE TABLE payment_allocations (id TEXT PRIMARY KEY, invoice_id TEXT NOT NULL REFERENCES invoices(id), transaction_id TEXT NOT NULL REFERENCES transactions(id), amount INTEGER NOT NULL CHECK(typeof(amount)='integer' AND amount>0), UNIQUE(invoice_id,transaction_id));
      CREATE TABLE imports (id TEXT PRIMARY KEY, fingerprint TEXT NOT NULL, account_id TEXT NOT NULL REFERENCES accounts(id), filename TEXT NOT NULL, source BLOB NOT NULL, mapping TEXT NOT NULL, rows TEXT NOT NULL, errors TEXT NOT NULL, user_id TEXT NOT NULL REFERENCES users(id), status TEXT NOT NULL DEFAULT 'preview' CHECK(status IN ('preview','committed')), created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, UNIQUE(fingerprint,account_id));
      CREATE TABLE statement_lines (id TEXT PRIMARY KEY, import_id TEXT NOT NULL REFERENCES imports(id), row_number INTEGER NOT NULL, account_id TEXT NOT NULL REFERENCES accounts(id), date TEXT NOT NULL, reference TEXT NOT NULL, description TEXT NOT NULL, amount INTEGER NOT NULL CHECK(typeof(amount)='integer' AND amount>0), direction TEXT NOT NULL CHECK(direction IN ('in','out')), UNIQUE(import_id,row_number));
      CREATE INDEX line_ref ON statement_lines(account_id,reference);
      CREATE TABLE reconciliations (id TEXT PRIMARY KEY, transaction_id TEXT NOT NULL REFERENCES transactions(id), line_id TEXT NOT NULL REFERENCES statement_lines(id), rule TEXT NOT NULL, reason TEXT NOT NULL, user_id TEXT NOT NULL REFERENCES users(id), active INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
      CREATE UNIQUE INDEX one_active_tx ON reconciliations(transaction_id) WHERE active=1;
      CREATE UNIQUE INDEX one_active_line ON reconciliations(line_id) WHERE active=1;
      CREATE TABLE approvals (id TEXT PRIMARY KEY, transaction_id TEXT NOT NULL UNIQUE REFERENCES transactions(id), decision TEXT NOT NULL CHECK(decision IN ('approved','rejected')), reason TEXT NOT NULL, user_id TEXT NOT NULL REFERENCES users(id), created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
      CREATE TABLE periods (month TEXT PRIMARY KEY, closed INTEGER NOT NULL DEFAULT 1, reason TEXT NOT NULL, user_id TEXT NOT NULL REFERENCES users(id));
      CREATE TABLE audit_events (id TEXT PRIMARY KEY, user_id TEXT REFERENCES users(id), action TEXT NOT NULL, entity TEXT NOT NULL, details TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
      CREATE TRIGGER no_audit_update BEFORE UPDATE ON audit_events BEGIN SELECT RAISE(ABORT,'Audit events are immutable'); END;
      CREATE TRIGGER no_audit_delete BEFORE DELETE ON audit_events BEGIN SELECT RAISE(ABORT,'Audit events are immutable'); END;
      CREATE TRIGGER no_tx_delete BEFORE DELETE ON transactions BEGIN SELECT RAISE(ABORT,'Use a reversal instead'); END;
      CREATE TRIGGER no_tx_financial_update BEFORE UPDATE OF date,amount,direction,account_id,reference,description,category,contact_id,user_id,reversal_of ON transactions BEGIN SELECT RAISE(ABORT,'Financial fields are immutable'); END;
      INSERT INTO migrations(version) VALUES (1);
    `),
    );
  }
  if (!db.prepare("SELECT 1 FROM migrations WHERE version=2").get()) {
    atomic(db, () =>
      db.exec(`
      ALTER TABLE settings ADD COLUMN mode TEXT NOT NULL DEFAULT 'live' CHECK(mode IN ('live','demo'));
      UPDATE settings SET mode='demo' WHERE EXISTS (SELECT 1 FROM audit_events WHERE action='demo.seed');
      INSERT INTO migrations(version) VALUES (2);
    `),
    );
  }
  if (!db.prepare("SELECT 1 FROM migrations WHERE version=3").get()) {
    atomic(db, () =>
      db.exec(`
      ALTER TABLE accounts ADD COLUMN kind TEXT NOT NULL DEFAULT '';
      ALTER TABLE accounts ADD COLUMN opening_amount INTEGER NOT NULL DEFAULT 0 CHECK(typeof(opening_amount)='integer' AND opening_amount>=0);
      ALTER TABLE accounts ADD COLUMN opening_date TEXT NOT NULL DEFAULT '1970-01-01';
      ALTER TABLE contacts ADD COLUMN email TEXT NOT NULL DEFAULT '';
      ALTER TABLE contacts ADD COLUMN address TEXT NOT NULL DEFAULT '';
      ALTER TABLE contacts ADD COLUMN reference TEXT NOT NULL DEFAULT '';
      ALTER TABLE invoices ADD COLUMN lifecycle TEXT NOT NULL DEFAULT 'issued' CHECK(lifecycle IN ('draft','issued','cancelled'));
      ALTER TABLE invoices ADD COLUMN items TEXT NOT NULL DEFAULT '[]';
      ALTER TABLE invoices ADD COLUMN currency TEXT NOT NULL DEFAULT 'SLE';
      CREATE TABLE categories (id TEXT PRIMARY KEY, name TEXT NOT NULL UNIQUE, direction TEXT NOT NULL CHECK(direction IN ('in','out','both')), active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)));
      INSERT INTO categories VALUES ('sales','Sales','in',1),('supplies','Supplies','out',1),('operations','Operations','out',1),('transport','Transport','out',1),('utilities','Utilities','out',1),('other','Other','both',1);
      CREATE TABLE evidence (id TEXT PRIMARY KEY, transaction_id TEXT NOT NULL REFERENCES transactions(id), filename TEXT NOT NULL, mime TEXT NOT NULL, source BLOB NOT NULL, fingerprint TEXT NOT NULL, user_id TEXT NOT NULL REFERENCES users(id), created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, UNIQUE(transaction_id,fingerprint));
      CREATE TABLE payment_verifications (transaction_id TEXT PRIMARY KEY REFERENCES transactions(id), evidence_reference TEXT NOT NULL, user_id TEXT NOT NULL REFERENCES users(id), created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
      CREATE TABLE allocation_corrections (allocation_id TEXT PRIMARY KEY REFERENCES payment_allocations(id), reason TEXT NOT NULL, user_id TEXT NOT NULL REFERENCES users(id), created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
      CREATE TABLE supplier_bills (id TEXT PRIMARY KEY, number TEXT NOT NULL UNIQUE, contact_id TEXT NOT NULL REFERENCES contacts(id), issued TEXT NOT NULL, due TEXT NOT NULL, amount INTEGER NOT NULL CHECK(typeof(amount)='integer' AND amount>0), currency TEXT NOT NULL DEFAULT 'SLE', description TEXT NOT NULL, lifecycle TEXT NOT NULL DEFAULT 'issued' CHECK(lifecycle IN ('issued','cancelled')), user_id TEXT NOT NULL REFERENCES users(id));
      CREATE TABLE supplier_allocations (id TEXT PRIMARY KEY, bill_id TEXT NOT NULL REFERENCES supplier_bills(id), transaction_id TEXT NOT NULL REFERENCES transactions(id), amount INTEGER NOT NULL CHECK(typeof(amount)='integer' AND amount>0), UNIQUE(bill_id,transaction_id));
      CREATE TABLE reconciliation_policy (id INTEGER PRIMARY KEY CHECK(id=1), date_days INTEGER NOT NULL DEFAULT 0 CHECK(date_days BETWEEN 0 AND 7), amount_minor INTEGER NOT NULL DEFAULT 0 CHECK(amount_minor BETWEEN 0 AND 100000), approver_role TEXT NOT NULL DEFAULT 'manager' CHECK(approver_role='manager'));
      INSERT INTO reconciliation_policy(id) VALUES (1);
      CREATE TABLE reconciliation_proposals (id TEXT PRIMARY KEY, transaction_ids TEXT NOT NULL, line_ids TEXT NOT NULL, reason TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected','undone')), user_id TEXT NOT NULL REFERENCES users(id), decision_user TEXT REFERENCES users(id), decision_reason TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, decided_at TEXT);
      CREATE TABLE grouped_links (proposal_id TEXT NOT NULL REFERENCES reconciliation_proposals(id), participant_type TEXT NOT NULL CHECK(participant_type IN ('transaction','line')), participant_id TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)), PRIMARY KEY(proposal_id,participant_type,participant_id));
      CREATE UNIQUE INDEX one_grouped_participant ON grouped_links(participant_type,participant_id) WHERE active=1;
      CREATE TABLE exception_reviews (source_key TEXT PRIMARY KEY, status TEXT NOT NULL CHECK(status IN ('in_review','dismissed')), reason TEXT NOT NULL, user_id TEXT NOT NULL REFERENCES users(id), created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
      CREATE INDEX bills_contact_due ON supplier_bills(contact_id,due);
      CREATE INDEX evidence_transaction ON evidence(transaction_id);
      CREATE INDEX reconciliation_status ON transactions(reconciliation,approval,date);
      CREATE INDEX tx_contact ON transactions(contact_id,date);
      INSERT INTO migrations(version) VALUES (3);
    `),
    );
  }
  if (!db.prepare("SELECT 1 FROM migrations WHERE version=4").get()) {
    atomic(db, () =>
      db.exec(`
      CREATE TABLE approval_delegates (user_id TEXT PRIMARY KEY REFERENCES users(id), active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)), reason TEXT NOT NULL, assigned_by TEXT NOT NULL REFERENCES users(id), created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
      INSERT INTO migrations(version) VALUES (4);
    `),
    );
  }
  if (!db.prepare("SELECT 1 FROM migrations WHERE version=5").get()) {
    atomic(db, () =>
      db.exec(`
      CREATE TABLE supplier_allocation_corrections (allocation_id TEXT PRIMARY KEY REFERENCES supplier_allocations(id), reason TEXT NOT NULL, user_id TEXT NOT NULL REFERENCES users(id), created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
      CREATE TABLE control_requests (id TEXT PRIMARY KEY, kind TEXT NOT NULL CHECK(kind IN ('period_close','reversal','adjustment','writeoff')), payload TEXT NOT NULL, reason TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected')), user_id TEXT NOT NULL REFERENCES users(id), decision_user TEXT REFERENCES users(id), decision_reason TEXT NOT NULL DEFAULT '', result_id TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, decided_at TEXT);
      CREATE TABLE document_writeoffs (id TEXT PRIMARY KEY, document_kind TEXT NOT NULL CHECK(document_kind IN ('customer','supplier')), document_id TEXT NOT NULL, amount INTEGER NOT NULL CHECK(typeof(amount)='integer' AND amount>0), request_id TEXT NOT NULL UNIQUE REFERENCES control_requests(id), user_id TEXT NOT NULL REFERENCES users(id), reason TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
      CREATE INDEX control_status ON control_requests(status,created_at);
      CREATE INDEX writeoff_document ON document_writeoffs(document_kind,document_id);
      INSERT INTO migrations(version) VALUES (5);
    `),
    );
  }
  if (!db.prepare("SELECT 1 FROM migrations WHERE version=6").get()) {
    atomic(db, () =>
      db.exec(`
      CREATE TABLE partial_matches (id TEXT PRIMARY KEY,transaction_id TEXT NOT NULL REFERENCES transactions(id),line_id TEXT NOT NULL REFERENCES statement_lines(id),amount INTEGER NOT NULL CHECK(typeof(amount)='integer' AND amount>0),reason TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected','undone')),user_id TEXT NOT NULL REFERENCES users(id),decision_user TEXT REFERENCES users(id),decision_reason TEXT NOT NULL DEFAULT '',created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,decided_at TEXT);
      CREATE INDEX partial_tx ON partial_matches(transaction_id,status);
      CREATE INDEX partial_line ON partial_matches(line_id,status);
      INSERT INTO migrations(version) VALUES (6);
    `),
    );
  }
  if (!db.prepare("SELECT 1 FROM migrations WHERE version=7").get()) {
    atomic(db, () =>
      db.exec(`
      ALTER TABLE settings ADD COLUMN auditor_export_allowed INTEGER NOT NULL DEFAULT 0 CHECK(auditor_export_allowed IN (0,1));
      ALTER TABLE settings ADD COLUMN cashier_create_customers INTEGER NOT NULL DEFAULT 0 CHECK(cashier_create_customers IN (0,1));
      ALTER TABLE settings ADD COLUMN cashier_invoice_allocation INTEGER NOT NULL DEFAULT 0 CHECK(cashier_invoice_allocation IN (0,1));
      CREATE INDEX audit_entity_action ON audit_events(entity,action);
      CREATE INDEX audit_actor_action ON audit_events(user_id,action,created_at);
      INSERT INTO migrations(version) VALUES (7);
    `),
    );
  }
  return db;
}
