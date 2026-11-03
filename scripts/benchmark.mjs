import { performance } from "node:perf_hooks";
import { cpus, platform, release } from "node:os";
import { writeFileSync } from "node:fs";
import request from "supertest";
import { openDb, id, atomic } from "../server/db.js";
import { seed } from "../server/seed.js";
import { createApp } from "../server/app.js";

// Synthetic in-memory benchmark only. Never opens DB_PATH or company files.
const db = openDb(":memory:");
try {
  const password = "Benchmark-synthetic-only-123";
  seed(db, password);
  const user = db.prepare("SELECT id FROM users WHERE role='finance'").get().id,
    account = db
      .prepare("SELECT id FROM accounts WHERE channel='bank'")
      .get().id;
  atomic(db, () => {
    const stmt = db.prepare(
      "INSERT INTO transactions(id,date,amount,direction,account_id,reference,description,category,user_id,approval,request_key) VALUES(?,?,?,?,?,?,?,?,?,?,?)",
    );
    for (let i = 0; i < 10000; i++)
      stmt.run(
        id(),
        new Date(Date.UTC(2025, 0, 1 + (i % 365))).toISOString().slice(0, 10),
        1000 + (i % 100000),
        i % 2 ? "out" : "in",
        account,
        `BENCH-${i}`,
        "Synthetic benchmark only",
        "Other",
        user,
        i % 2 ? "approved" : "not_required",
        id(),
      );
  });
  atomic(db, () => {
    const iid = id();
    db.prepare(
      "INSERT INTO imports(id,fingerprint,account_id,filename,source,mapping,rows,errors,user_id,status) VALUES(?,?,?,?,?,?,?,?,?,'committed')",
    ).run(
      iid,
      id(),
      account,
      "synthetic.csv",
      Buffer.from("Synthetic benchmark only"),
      "{}",
      "[]",
      "[]",
      user,
    );
    const line = db.prepare(
      "INSERT INTO statement_lines VALUES(?,?,?,?,?,?,?,?,?)",
    );
    for (let i = 0; i < 2000; i++)
      line.run(
        id(),
        iid,
        i + 2,
        account,
        new Date(Date.UTC(2025, 0, 1 + (i % 365))).toISOString().slice(0, 10),
        `BENCH-${i}`,
        "Synthetic benchmark evidence",
        1000 + (i % 100000),
        i % 2 ? "out" : "in",
      );
  });
  const app = createApp(db),
    agent = request.agent(app),
    session = await agent.get("/api/session");
  const login = await agent
    .post("/api/login")
    .set("x-csrf-token", session.body.csrf)
    .send({ email: "finance@finbiz.demo", password });
  if (login.status !== 200) throw new Error("Benchmark sign-in failed.");
  const results = [];
  for (const path of [
    "/transactions?page=1",
    "/overview",
    "/analytics",
    "/reconciliation",
    "/exceptions",
  ]) {
    console.log("Benchmarking " + path);
    await agent
      .get("/api" + path)
      .timeout({ response: 30000, deadline: 35000 });
    const timings = [];
    for (let n = 0; n < 20; n++) {
      const start = performance.now(),
        r = await agent
          .get("/api" + path)
          .timeout({ response: 30000, deadline: 35000 });
      if (r.status !== 200)
        throw new Error(path + ": " + JSON.stringify(r.body));
      timings.push(performance.now() - start);
    }
    console.log(path + " completed: " + timings.length + " samples");
    timings.sort((a, b) => a - b);
    results.push({
      endpoint: path,
      samples: timings.length,
      p50_ms: Number(timings[9].toFixed(2)),
      p95_ms: Number(timings[18].toFixed(2)),
      max_ms: Number(timings.at(-1).toFixed(2)),
    });
  }
  const output = {
    generated_at: new Date().toISOString(),
    conditions: {
      node: process.version,
      platform: platform(),
      release: release(),
      cpu: cpus()[0]?.model,
      storage:
        "SQLite in-memory, single process; loopback Supertest; warmed requests",
      statement_lines: 2000,
      transactions: db.prepare("SELECT COUNT(*) n FROM transactions").get().n,
      concurrency: 1,
      samples_per_endpoint: 20,
      limitations:
        "Not a production, disk, network, browser-rendering, high-concurrency or long-duration benchmark. Includes 2,000 statement lines; measure organisation-specific data and concurrency before deployment.",
    },
    target_p95_ms: 3000,
    results,
  };
  writeFileSync("docs/BENCHMARK.json", JSON.stringify(output, null, 2) + "\n");
  console.log(JSON.stringify(output, null, 2));
  if (results.some((r) => r.p95_ms > 3000)) process.exitCode = 1;
} finally {
  db.close();
}
