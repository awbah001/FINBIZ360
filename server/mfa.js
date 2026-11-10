import { randomBytes } from "node:crypto";
import { rateLimit } from "express-rate-limit";
import { atomic, audit, verifyPassword } from "./db.js";
import { fail } from "./enhancements.js";
import {
  base32,
  encrypt,
  decrypt,
  matchTotp,
  recoveryHash,
  keyConfigured,
} from "./security-crypto.js";

export function verifySecondFactor(
  db,
  userId,
  code,
  { allowRecovery = true, failureStatus = 401 } = {},
) {
  const credential = db
    .prepare("SELECT * FROM mfa_credentials WHERE user_id=? AND enabled=1")
    .get(userId);
  if (!credential) return;
  const secret = decrypt(
    Buffer.from(credential.secret, "base64"),
    `mfa:${userId}`,
  ).toString();
  const step = matchTotp(
    secret,
    String(code || "").trim(),
    credential.last_counter,
  );
  if (step !== null) {
    const result = db
      .prepare(
        "UPDATE mfa_credentials SET last_counter=? WHERE user_id=? AND last_counter<?",
      )
      .run(step, userId, step);
    if (result.changes !== 1)
      fail("Authenticator code was already used.", failureStatus);
    return;
  }
  const codes = JSON.parse(credential.recovery),
    hash = recoveryHash(code || "");
  if (allowRecovery && codes.includes(hash)) {
    const updated = JSON.stringify(codes.filter((c) => c !== hash));
    const result = db
      .prepare(
        "UPDATE mfa_credentials SET recovery=? WHERE user_id=? AND recovery=?",
      )
      .run(updated, userId, credential.recovery);
    if (result.changes !== 1)
      fail("Recovery code was already used.", failureStatus);
    audit(db, userId, "auth.mfa_recovery", userId, {
      remaining: codes.length - 1,
    });
    return;
  }
  fail("Enter a valid unused authenticator or recovery code.", failureStatus);
}
export function registerMfa(app, db) {
  const sensitive = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    keyGenerator: (req) => req.user.id,
    standardHeaders: "draft-8",
    legacyHeaders: false,
  });
  const password = (req) => {
    const row = db
      .prepare("SELECT password FROM users WHERE id=?")
      .get(req.user.id);
    if (!verifyPassword(req.body.current_password || "", row.password))
      fail("Current password is incorrect.", 403);
  };
  app.get("/api/mfa", (req, res) => {
    const row = db
      .prepare("SELECT enabled,recovery FROM mfa_credentials WHERE user_id=?")
      .get(req.user.id);
    res.json({
      enabled: !!row?.enabled,
      configured: keyConfigured(),
      remaining_recovery: row?.enabled ? JSON.parse(row.recovery).length : 0,
    });
  });
  app.post("/api/mfa/setup", sensitive, (req, res) => {
    password(req);
    if (
      db
        .prepare("SELECT 1 FROM mfa_credentials WHERE user_id=? AND enabled=1")
        .get(req.user.id)
    )
      fail("MFA is already enabled.", 409);
    const secret = base32(randomBytes(20));
    atomic(db, () => {
      db.prepare(
        "INSERT INTO mfa_credentials(user_id,secret) VALUES(?,?) ON CONFLICT(user_id) DO UPDATE SET secret=excluded.secret,enabled=0,recovery='[]',last_counter=-1,created_at=CURRENT_TIMESTAMP",
      ).run(
        req.user.id,
        encrypt(Buffer.from(secret), `mfa:${req.user.id}`).toString("base64"),
      );
      audit(db, req.user.id, "auth.mfa_setup", req.user.id);
    });
    res.json({
      secret,
      uri: `otpauth://totp/${encodeURIComponent("FinBiz 360:" + req.user.email)}?secret=${secret}&issuer=FinBiz%20360&algorithm=SHA1&digits=6&period=30`,
    });
  });
  app.post("/api/mfa/enable", sensitive, (req, res) =>
    atomic(db, () => {
      const row = db
        .prepare("SELECT * FROM mfa_credentials WHERE user_id=? AND enabled=0")
        .get(req.user.id);
      if (!row) fail("Start authenticator setup first.", 409);
      if (Date.now() - Date.parse(row.created_at + "Z") > 15 * 60 * 1000)
        fail("Authenticator setup expired. Start setup again.", 409);
      const secret = decrypt(
        Buffer.from(row.secret, "base64"),
        `mfa:${req.user.id}`,
      ).toString();
      const step = matchTotp(secret, req.body.code);
      if (step === null)
        fail("Enter the current six-digit authenticator code.");
      const codes = Array.from({ length: 10 }, () =>
        randomBytes(10).toString("hex"),
      );
      db.prepare(
        "UPDATE mfa_credentials SET enabled=1,last_counter=?,recovery=? WHERE user_id=?",
      ).run(step, JSON.stringify(codes.map(recoveryHash)), req.user.id);
      db.prepare("DELETE FROM sessions WHERE user_id=? AND token<>?").run(
        req.user.id,
        req.session.token,
      );
      audit(db, req.user.id, "auth.mfa_enabled", req.user.id, {
        other_sessions_revoked: true,
      });
      res.json({ recovery_codes: codes });
    }),
  );
  app.post("/api/mfa/disable", sensitive, (req, res) =>
    atomic(db, () => {
      password(req);
      if (
        !db
          .prepare(
            "SELECT 1 FROM mfa_credentials WHERE user_id=? AND enabled=1",
          )
          .get(req.user.id)
      )
        fail("MFA is not enabled.", 409);
      verifySecondFactor(db, req.user.id, req.body.code, {
        failureStatus: 403,
      });
      db.prepare("DELETE FROM mfa_credentials WHERE user_id=?").run(
        req.user.id,
      );
      db.prepare("DELETE FROM sessions WHERE user_id=? AND token<>?").run(
        req.user.id,
        req.session.token,
      );
      audit(db, req.user.id, "auth.mfa_disabled", req.user.id);
      res.json({ ok: true });
    }),
  );
}
