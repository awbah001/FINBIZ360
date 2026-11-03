/**
 * Local password reset for forgotten credentials.
 * Usage:
 *   node scripts/reset-password.mjs
 *   node scripts/reset-password.mjs --email=user@example.com
 *   $env:DB_PATH='./data/workspace.db'; $env:RESET_PASSWORD='YourTempPass12'; node scripts/reset-password.mjs
 */
import { randomBytes } from "node:crypto";
import { openDb, hashPassword, atomic, audit } from "../server/db.js";

const args = Object.fromEntries(
  process.argv.slice(2).map((arg) => {
    const [key, ...rest] = arg.replace(/^--/, "").split("=");
    return [key, rest.join("=") || "true"];
  }),
);

const dbPath = process.env.DB_PATH || "./data/workspace.db";
const emailFilter = args.email || process.env.RESET_EMAIL || "";
const password =
  process.env.RESET_PASSWORD ||
  args.password ||
  `Temp-${randomBytes(9).toString("base64url")}`;

if (password.length < 12) {
  console.error("Password must be at least 12 characters.");
  process.exit(1);
}

const db = openDb(dbPath);
try {
  const users = emailFilter
    ? db
        .prepare("SELECT id, email, role, name FROM users WHERE lower(email)=lower(?)")
        .all(emailFilter)
    : db.prepare("SELECT id, email, role, name FROM users ORDER BY email").all();

  if (!users.length) {
    console.error(
      emailFilter
        ? `No user found for ${emailFilter} in ${dbPath}.`
        : `No users found in ${dbPath}.`,
    );
    process.exit(1);
  }

  const hash = hashPassword(password);
  atomic(db, () => {
    for (const user of users) {
      db.prepare("UPDATE users SET password=? WHERE id=?").run(hash, user.id);
      db.prepare("DELETE FROM sessions WHERE user_id=?").run(user.id);
      audit(db, user.id, "auth.password_reset", "user", {
        local: true,
        email: user.email,
      });
    }
  });

  console.log(`Password reset in ${dbPath}`);
  console.log("Accounts updated:");
  for (const user of users) {
    console.log(`  ${user.email}  (${user.role})  ${user.name}`);
  }
  console.log(`Temporary password: ${password}`);
  console.log("Sign in, then change this password from Settings.");
} finally {
  db.close();
}
