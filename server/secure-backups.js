import { backup, DatabaseSync } from "node:sqlite";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  writeFileSync,
  rmSync,
  unlinkSync,
  existsSync,
} from "node:fs";
import { resolve, join, basename, sep } from "node:path";
import { tmpdir } from "node:os";
import { createHash } from "node:crypto";
import { id, audit } from "./db.js";
import { encrypt, decrypt, keyConfigured } from "./security-crypto.js";
const running = new WeakSet();
export const backupDirectory = () =>
  resolve(process.env.FINBIZ_BACKUP_DIR || "./backups/encrypted");
export function backupPath(filename) {
  if (
    !/^finbiz-[a-f0-9-]+\.finbiz$/.test(filename || "") ||
    basename(filename) !== filename
  )
    throw Error("Invalid backup filename.");
  const root = backupDirectory(),
    target = resolve(root, filename);
  if (!target.startsWith(root + sep)) throw Error("Invalid backup path.");
  return target;
}
export async function runEncryptedBackup(db, userId = null) {
  if (running.has(db)) throw Error("An encrypted backup is already running.");
  if (!keyConfigured())
    throw Error(
      "Configure the server encryption key before creating encrypted backups.",
    );
  running.add(db);
  const runId = id(),
    filename = `finbiz-${runId}.finbiz`;
  let folder;
  db.prepare("INSERT INTO backup_runs(id,status) VALUES(?,'running')").run(
    runId,
  );
  try {
    mkdirSync(backupDirectory(), { recursive: true, mode: 0o700 });
    folder = mkdtempSync(join(tmpdir(), "finbiz-secure-backup-"));
    const snapshot = join(folder, "snapshot.db");
    await backup(db, snapshot);
    const payload = encrypt(readFileSync(snapshot), "finbiz-backup-v1");
    const target = backupPath(filename);
    writeFileSync(target, payload, { flag: "wx", mode: 0o600 });
    const verified = join(folder, "verified.db");
    writeFileSync(verified, decrypt(readFileSync(target), "finbiz-backup-v1"), {
      flag: "wx",
      mode: 0o600,
    });
    const check = new DatabaseSync(verified, { readOnly: true });
    try {
      if (
        check.prepare("PRAGMA integrity_check").get().integrity_check !==
          "ok" ||
        check.prepare("PRAGMA foreign_key_check").all().length
      )
        throw Error("Backup integrity verification failed.");
    } finally {
      check.close();
    }
    const sha = createHash("sha256").update(payload).digest("hex");
    db.prepare(
      "UPDATE backup_runs SET status='verified',filename=?,sha256=?,completed_at=CURRENT_TIMESTAMP WHERE id=?",
    ).run(filename, sha, runId);
    audit(db, userId, "backup.encrypted_verified", runId, { sha256: sha });
    const retain = db
      .prepare("SELECT retention_count FROM backup_policy WHERE id=1")
      .get().retention_count;
    const expired = db
      .prepare(
        "SELECT id,filename FROM backup_runs WHERE status='verified' AND filename IS NOT NULL ORDER BY rowid DESC LIMIT -1 OFFSET ?",
      )
      .all(retain);
    for (const old of expired) {
      try {
        const path = backupPath(old.filename);
        if (existsSync(path)) unlinkSync(path);
        db.prepare("UPDATE backup_runs SET filename=NULL WHERE id=?").run(
          old.id,
        );
      } catch {
        db.prepare(
          "UPDATE backup_runs SET error='Backup verified, but an expired file could not be removed. Review storage permissions.' WHERE id=?",
        ).run(runId);
        audit(db, userId, "backup.retention_failed", old.id);
      }
    }
    return { id: runId, filename, sha256: sha, status: "verified" };
  } catch (error) {
    const path = backupPath(filename);
    if (existsSync(path)) unlinkSync(path);
    db.prepare(
      "UPDATE backup_runs SET status='failed',error='Encrypted backup failed; check storage permissions, disk space and the configured encryption key.',completed_at=CURRENT_TIMESTAMP WHERE id=?",
    ).run(runId);
    audit(db, userId, "backup.encrypted_failed", runId);
    throw new Error(
      "Encrypted backup failed. Review the backup history and server storage configuration.",
    );
  } finally {
    if (folder && resolve(folder).startsWith(resolve(tmpdir()) + sep))
      rmSync(folder, { recursive: true, force: true });
    running.delete(db);
  }
}
export function startBackupScheduler(db) {
  let pending = Promise.resolve();
  // A failed or interrupted run is visible and is retried after one interval.
  db.prepare(
    "UPDATE backup_runs SET status='failed',error='Server stopped before backup verification completed.',completed_at=CURRENT_TIMESTAMP WHERE status='running'",
  ).run();
  const tick = async () => {
    const policy = db.prepare("SELECT * FROM backup_policy WHERE id=1").get();
    if (!policy.enabled || running.has(db)) return;
    const latest = db
      .prepare("SELECT started_at FROM backup_runs ORDER BY rowid DESC LIMIT 1")
      .get();
    if (
      latest &&
      Date.now() - Date.parse(latest.started_at + "Z") <
        policy.interval_hours * 3600000
    )
      return;
    if (!keyConfigured()) {
      db.prepare(
        "INSERT INTO backup_runs(id,status,error,completed_at) VALUES(?,'failed','Server encryption key is not configured.',CURRENT_TIMESTAMP)",
      ).run(id());
      return;
    }
    pending = runEncryptedBackup(db).then(
      () => {},
      () => {},
    );
    await pending;
  };
  const timer = setInterval(tick, 60000);
  timer.unref();
  void tick();
  return () => {
    clearInterval(timer);
    return pending;
  };
}
