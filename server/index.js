import express from "express";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { openDb } from "./db.js";
import { createApp } from "./app.js";
import { startBackupScheduler } from "./secure-backups.js";
import { startRecurringScheduler } from "./business-operations.js";
const db = openDb(
    process.env.DB_PATH ||
      (process.argv.includes("--demo") ? "./data/finbiz-demo.db" : undefined),
  ),
  app = createApp(db);
if (existsSync("dist/index.html")) {
  app.use(express.static(resolve("dist")));
  app.get("/{*path}", (req, res) => res.sendFile(resolve("dist/index.html")));
}
const host = process.env.HOST || "127.0.0.1",
  port = Number(process.env.PORT || 3001);
const server = app.listen(port, host, () =>
  console.log(`FinBiz 360 API: http://${host}:${port}`),
);
const stopBackups = startBackupScheduler(db);
const stopRecurring = startRecurringScheduler(db);
function stop() {
  const backupsStopped = stopBackups();
  stopRecurring();
  server.close(async () => {
    await backupsStopped;
    db.close();
    process.exit(0);
  });
}
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
