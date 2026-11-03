import { test } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openDb, id } from "../server/db.js";
import { createApp } from "../server/app.js";
import { seed } from "../server/seed.js";

const company = {
  organisation: "Company Setup Test",
  owner_name: "Company Owner",
  owner_email: "owner@example.test",
  owner_password: "Owner-password-for-test-123",
  admin_name: "Company Administrator",
  admin_email: "admin@example.test",
  admin_password: "Admin-password-for-test-123",
};
async function session(app) {
  const agent = request.agent(app),
    r = await agent.get("/api/session");
  return { agent, csrf: r.body.csrf, body: r.body };
}
const post = (client, path, body) =>
  client.agent
    .post("/api" + path)
    .set("x-csrf-token", client.csrf)
    .send(body);
async function login(app) {
  const client = await session(app),
    r = await post(client, "/login", {
      email: company.owner_email,
      password: company.owner_password,
    });
  assert.equal(r.status, 200);
  return { ...client, csrf: r.body.csrf };
}

test("first-time company setup starts with zero financial records and cannot be repeated", async () => {
  const db = openDb(":memory:");
  try {
    const app = createApp(db),
      client = await session(app);
    assert.equal(client.body.setupRequired, true);
    assert.equal(client.body.workspaceMode, "live");
    assert.equal(
      (await client.agent.post("/api/setup").send(company)).status,
      403,
    );
    const result = await post(client, "/setup", company);
    assert.equal(result.status, 201, JSON.stringify(result.body));
    for (const table of [
      "transactions",
      "accounts",
      "contacts",
      "invoices",
      "imports",
    ])
      assert.equal(db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get().n, 0);
    assert.equal(db.prepare("SELECT COUNT(*) AS n FROM users").get().n, 2);
    const signedIn = await login(app),
      overview = await signedIn.agent.get("/api/overview");
    assert.equal(overview.body.incoming, "0");
    assert.equal(overview.body.outgoing, "0");
    assert.equal(overview.body.count, 0);
    assert.equal(
      (await signedIn.agent.get("/api/session")).body.setupRequired,
      false,
    );
    assert.equal((await post(signedIn, "/setup", company)).status, 409);
    assert.equal(
      db
        .prepare(
          "SELECT COUNT(*) AS n FROM audit_events WHERE action='workspace.setup'",
        )
        .get().n,
      1,
    );
  } finally {
    db.close();
  }
});
test("invalid setup leaves no partial accounts or company changes", async () => {
  const db = openDb(":memory:");
  try {
    const client = await session(createApp(db));
    for (const changes of [
      { owner_password: "short" },
      { admin_email: company.owner_email },
      { owner_email: "invalid" },
    ]) {
      assert.equal(
        (await post(client, "/setup", { ...company, ...changes })).status,
        400,
      );
      assert.equal(db.prepare("SELECT COUNT(*) AS n FROM users").get().n, 0);
      assert.equal(
        db.prepare("SELECT name FROM settings").get().name,
        "Your organisation",
      );
    }
  } finally {
    db.close();
  }
});
test("demo data stays labelled and cannot be replaced through company setup", async () => {
  const db = openDb(":memory:");
  try {
    seed(db, "Demo-password-for-test-123");
    const client = await session(createApp(db));
    assert.equal(client.body.workspaceMode, "demo");
    assert.equal(client.body.setupRequired, false);
    const before = db.prepare("SELECT COUNT(*) AS n FROM transactions").get().n;
    assert.equal((await post(client, "/setup", company)).status, 409);
    assert.equal(
      db.prepare("SELECT COUNT(*) AS n FROM transactions").get().n,
      before,
    );
  } finally {
    db.close();
  }
});
test("new company transactions appear to another session and survive restart", async () => {
  const directory = mkdtempSync(join(tmpdir(), "finbiz-company-")),
    filename = join(directory, "workspace.db");
  let db = openDb(filename);
  try {
    const app = createApp(db),
      setup = await session(app);
    await post(setup, "/setup", company);
    const first = await login(app),
      second = await login(app);
    const account = await post(first, "/accounts", {
      name: "Company cash account",
      channel: "cash",
    });
    assert.equal(account.status, 201);
    assert.equal((await second.agent.get("/api/overview")).body.count, 0);
    assert.equal(
      (
        await post(first, "/transactions", {
          date: "2026-11-01",
          amount: "250.25",
          direction: "in",
          account_id: account.body.id,
          reference: "REAL-RECEIPT-001",
          description: "Entered receipt",
          category: "Sales",
          request_key: id(),
        })
      ).status,
      201,
    );
    const updated = (await second.agent.get("/api/overview")).body;
    assert.equal(updated.count, 1);
    assert.equal(updated.incoming, "25025");
    db.close();
    db = openDb(filename);
    assert.equal(
      db.prepare("SELECT COUNT(*) AS n FROM transactions").get().n,
      1,
    );
    assert.equal(db.prepare("SELECT mode FROM settings").get().mode, "live");
  } finally {
    db.close();
    rmSync(directory, { recursive: true, force: true });
  }
});
test("production setup requires the server setup token", async () => {
  const db = openDb(":memory:"),
    previousMode = process.env.NODE_ENV,
    previousToken = process.env.SETUP_TOKEN;
  try {
    process.env.NODE_ENV = "production";
    process.env.SETUP_TOKEN = "test-only-operator-token";
    const app = createApp(db),
      r = await request(app).get("/api/session"),
      cookie = r.headers["set-cookie"][0].split(";")[0];
    const send = (body) =>
      request(app)
        .post("/api/setup")
        .set("Cookie", cookie)
        .set("x-csrf-token", r.body.csrf)
        .send(body);
    assert.equal((await send(company)).status, 403);
    assert.equal(
      (await send({ ...company, setup_token: "wrong" })).status,
      403,
    );
    assert.equal(
      (await send({ ...company, setup_token: process.env.SETUP_TOKEN })).status,
      201,
    );
  } finally {
    db.close();
    if (previousMode === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previousMode;
    if (previousToken === undefined) delete process.env.SETUP_TOKEN;
    else process.env.SETUP_TOKEN = previousToken;
  }
});
