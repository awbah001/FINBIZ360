import { backup } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { openDb } from "./db.js";
const db = openDb();
mkdirSync("backups", { recursive: true });
const destination = resolve(
  "backups",
  `finbiz-${new Date().toISOString().replaceAll(":", "-")}.db`,
);
try {
  await backup(db, destination);
  console.log(
    `Consistent SQLite backup created: ${destination}\nContains statement source files and sessions. Encrypt and restrict access before off-device storage.`,
  );
} finally {
  db.close();
}
