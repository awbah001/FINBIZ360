// Isolated, disposable UI QA. Never opens or reseeds a company database.
import express from "express";
import { resolve } from "node:path";
import { openDb } from "../server/db.js";
import { seed } from "../server/seed.js";
import { createApp } from "../server/app.js";
process.env.NODE_ENV = "test";
const db = openDb(":memory:");
seed(db, "Local-visual-check-123!");
const app = createApp(db);
app.use(express.static(resolve("dist")));
app.get("/{*path}", (req, res) => res.sendFile(resolve("dist/index.html")));
const server = app.listen(3187, "127.0.0.1", () => console.log("Isolated role preview: http://127.0.0.1:3187"));
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => server.close(() => { db.close(); process.exit(0); }));
