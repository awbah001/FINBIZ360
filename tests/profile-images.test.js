import { test } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import { openDb } from "../server/db.js";
import { seed } from "../server/seed.js";
import { createApp } from "../server/app.js";
import { backup } from "node:sqlite";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, sep } from "node:path";
import { restoreToNewFile } from "../server/restore.js";

const photo = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aN6cAAAAASUVORK5CYII=",
  "base64",
);

test("photo replacement, rejected uploads, database restart and backup restoration preserve the saved image", async () => {
  const folder = mkdtempSync(join(tmpdir(), "finbiz-photo-persistence-"));
  const filename = join(folder, "workspace.db");
  let db = openDb(filename);
  const password = "Photo-persistence-test-123";
  async function login() {
    const agent = request.agent(createApp(db));
    const initial = await agent.get("/api/session");
    const response = await agent
      .post("/api/login")
      .set("x-csrf-token", initial.body.csrf)
      .send({ email: "manager@finbiz.demo", password });
    assert.equal(response.status, 200);
    return { agent, csrf: response.body.csrf, user: response.body.user };
  }
  try {
    seed(db, password);
    const client = await login();
    const upload = (buffer) =>
      client.agent
        .put("/api/profile/image")
        .set("x-csrf-token", client.csrf)
        .attach("image", buffer, {
          filename: "photo.png",
          contentType: "image/png",
        });
    const first = await upload(photo);
    const replaced = await upload(photo);
    assert.equal(first.status, 200);
    assert.equal(replaced.status, 200);
    assert.notEqual(first.body.user.image_url, replaced.body.user.image_url);
    assert.equal(
      db.prepare("SELECT COUNT(*) n FROM profile_images").get().n,
      1,
    );
    const overDimension = Buffer.from(photo);
    overDimension.writeUInt32BE(1025, 16);
    for (const invalid of [
      overDimension,
      photo.subarray(0, 40),
      Buffer.concat([photo, Buffer.from("trailing payload")]),
    ])
      assert.equal((await upload(invalid)).status, 400);
    assert.equal(
      (
        await client.agent
          .put("/api/profile/image")
          .set("x-csrf-token", client.csrf)
      ).status,
      400,
    );
    assert.equal(
      (await client.agent.get("/api/session")).body.user.image_url,
      replaced.body.user.image_url,
    );
    assert.equal(
      db
        .prepare(
          "SELECT COUNT(*) n FROM audit_events WHERE action='user.photo.update'",
        )
        .get().n,
      2,
    );
    db.close();
    db = openDb(filename);
    const restarted = await login();
    assert.equal(restarted.user.image_url, replaced.body.user.image_url);
    assert.deepEqual(
      (await restarted.agent.get(restarted.user.image_url)).body,
      photo,
    );
    const snapshot = join(folder, "backup.db"),
      restoredPath = join(folder, "restored.db");
    await backup(db, snapshot);
    await restoreToNewFile(snapshot, restoredPath);
    const restored = openDb(restoredPath);
    try {
      const row = restored
        .prepare("SELECT image,revision FROM profile_images WHERE user_id=?")
        .get(restarted.user.id);
      assert.deepEqual(Buffer.from(row.image), photo);
      assert.ok(restarted.user.image_url.endsWith(row.revision));
      assert.equal(
        restored.prepare("SELECT COUNT(*) n FROM sessions").get().n,
        0,
      );
      assert.equal(
        restored.prepare("PRAGMA integrity_check").get().integrity_check,
        "ok",
      );
    } finally {
      restored.close();
    }
    assert.equal(
      (
        await restarted.agent
          .delete("/api/profile/image")
          .set("x-csrf-token", restarted.csrf)
      ).status,
      200,
    );
    db.close();
    db = openDb(filename);
    const removed = await login();
    assert.equal(removed.user.image_url, null);
    assert.equal((await removed.agent.get("/api/profile/image")).status, 404);
  } finally {
    if (db.isOpen) db.close();
    assert.ok(resolve(folder).startsWith(resolve(tmpdir()) + sep));
    rmSync(folder, { recursive: true, force: true });
  }
});

test("all roles can save their own photo, retain it across sessions and remove it without affecting other users", async () => {
  const db = openDb(":memory:");
  try {
    const password = "Profile-photo-test-123";
    seed(db, password);
    const app = createApp(db);
    assert.equal((await request(app).get("/api/profile/image")).status, 401);
    const agents = [];
    for (const role of ["admin", "manager", "finance", "cashier", "auditor"]) {
      const agent = request.agent(app);
      const initial = await agent.get("/api/session");
      const login = await agent
        .post("/api/login")
        .set("x-csrf-token", initial.body.csrf)
        .send({ email: `${role}@finbiz.demo`, password });
      assert.equal(login.status, 200);
      const csrf = login.body.csrf;
      assert.equal((await agent.get("/api/profile/image")).status, 404);
      assert.equal(
        (
          await agent.put("/api/profile/image").attach("image", photo, {
            filename: "photo.png",
            contentType: "image/png",
          })
        ).status,
        403,
      );
      const saved = await agent
        .put("/api/profile/image")
        .set("x-csrf-token", csrf)
        .attach("image", photo, {
          filename: "photo.png",
          contentType: "image/png",
        });
      assert.equal(saved.status, 200);
      assert.match(
        saved.body.user.image_url,
        /^\/api\/profile\/image\?v=[a-f0-9]{32}$/,
      );
      const fetched = await agent.get(saved.body.user.image_url);
      assert.equal(fetched.status, 200);
      assert.equal(fetched.headers["content-type"], "image/png");
      assert.equal(fetched.headers["cache-control"], "private, no-store");
      assert.deepEqual(fetched.body, photo);
      assert.equal(
        (await agent.get("/api/session")).body.user.image_url,
        saved.body.user.image_url,
      );
      const otherLogin = request.agent(app);
      const otherSession = await otherLogin.get("/api/session");
      const relogin = await otherLogin
        .post("/api/login")
        .set("x-csrf-token", otherSession.body.csrf)
        .send({ email: `${role}@finbiz.demo`, password });
      assert.equal(relogin.body.user.image_url, saved.body.user.image_url);
      const bad = await agent
        .put("/api/profile/image")
        .set("x-csrf-token", csrf)
        .attach("image", Buffer.from('<svg onload="alert(1)"/>'), {
          filename: "fake.png",
          contentType: "image/png",
        });
      assert.equal(bad.status, 400);
      assert.equal(
        (await agent.get("/api/session")).body.user.image_url,
        saved.body.user.image_url,
      );
      agents.push({
        agent,
        csrf,
        url: saved.body.user.image_url,
        id: saved.body.user.id,
      });
    }
    assert.equal(
      db.prepare("SELECT COUNT(*) n FROM profile_images").get().n,
      5,
    );
    const { agent, csrf } = agents[0];
    const directory = await agent.get("/api/users");
    assert.equal(directory.status, 200);
    for (const user of directory.body) {
      assert.match(
        user.image_url,
        /^\/api\/users\/[^/]+\/image\?v=[a-f0-9]{32}$/,
      );
      assert.equal((await request(app).get(user.image_url)).status, 401);
      for (const staff of agents) {
        const image = await staff.agent.get(user.image_url);
        assert.equal(image.status, 200);
        assert.deepEqual(image.body, photo);
      }
    }
    const targetUrl = directory.body.find(
      (u) => u.id === agents[1].id,
    ).image_url;
    assert.equal(
      (
        await agent
          .put(`/api/users/${agents[1].id}/image`)
          .set("x-csrf-token", csrf)
      ).status,
      403,
    );
    const auditRows = (await agent.get("/api/audit")).body;
    assert.ok(auditRows.some((row) => row.user_image_url));
    const activity = (await agent.get("/api/admin/overview")).body
      .recent_activity;
    assert.ok(activity.some((row) => row.user_image_url));
    const transactions = (await agents[1].agent.get("/api/transactions")).body
      .rows;
    assert.ok(transactions.length);
    assert.ok(transactions.every((row) => row.user_image_url));
    assert.equal(
      (
        await agent
          .put("/api/profile/image")
          .set("x-csrf-token", csrf)
          .attach("image", Buffer.alloc(1024 * 1024 + 1), {
            filename: "large.png",
            contentType: "image/png",
          })
      ).status,
      400,
    );
    assert.equal(
      (
        await agent
          .put("/api/profile/image")
          .set("x-csrf-token", csrf)
          .attach("image", photo, {
            filename: "photo.svg",
            contentType: "image/svg+xml",
          })
      ).status,
      400,
    );
    assert.equal((await agent.delete("/api/profile/image")).status, 403);
    const removed = await agent
      .delete("/api/profile/image")
      .set("x-csrf-token", csrf);
    assert.equal(removed.status, 200);
    assert.equal(removed.body.user.image_url, null);
    assert.equal((await agent.get("/api/profile/image")).status, 404);
    // A different user's revision URL still resolves only to the requesting user's own image.
    assert.equal((await agent.get(agents[1].url)).status, 404);
    assert.equal((await agents[1].agent.get(agents[1].url)).status, 200);
    assert.equal((await agent.get(targetUrl)).status, 200);
    const removedUrl = directory.body.find(
      (u) => u.id === agents[0].id,
    ).image_url;
    assert.equal((await agents[1].agent.get(removedUrl)).status, 404);
    assert.equal(
      db.prepare("SELECT COUNT(*) n FROM profile_images").get().n,
      4,
    );
    const audit = db
      .prepare(
        "SELECT details FROM audit_events WHERE action='user.photo.update' LIMIT 1",
      )
      .get();
    assert.ok(audit);
    assert.ok(!audit.details.includes("base64"));
  } finally {
    db.close();
  }
});
