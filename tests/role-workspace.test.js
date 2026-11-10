import { test } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import { build } from "esbuild";
import { mkdtempSync, unlinkSync, rmdirSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { openDb } from "../server/db.js";
import { seed } from "../server/seed.js";
import { createApp } from "../server/app.js";

test("administration summary is restricted to administrators and excludes financial totals", async () => {
  const db = openDb(":memory:");
  try {
    const password = "Role-workspace-test-123";
    seed(db, password);
    const app = createApp(db);
    assert.equal((await request(app).get("/api/admin/overview")).status, 401);
    for (const role of ["admin", "manager", "finance", "cashier", "auditor"]) {
      const agent = request.agent(app);
      const session = await agent.get("/api/session");
      const login = await agent
        .post("/api/login")
        .set("x-csrf-token", session.body.csrf)
        .send({ email: `${role}@finbiz.demo`, password });
      assert.equal(login.status, 200);
      const summary = await agent.get("/api/admin/overview");
      assert.equal(summary.status, role === "admin" ? 200 : 403);
      if (role === "admin") {
        assert.equal(summary.body.active_users, 5);
        assert.equal(summary.body.inactive_users, 0);
        assert.equal(summary.body.administrators, 1);
        assert.equal(summary.body.active_sessions, 1);
        assert.ok(
          summary.body.recent_activity.some((e) => e.action === "auth.login"),
        );
        assert.equal(summary.body.net, undefined);
        assert.equal(summary.body.incoming, undefined);
      }
    }
  } finally {
    db.close();
  }
});

test("each role has a distinct workspace and all dashboard tasks lead to permitted pages", async () => {
  const directory = mkdtempSync(join(process.cwd(), ".finbiz-role-check-"));
  const entry = join(directory, "ui.mjs");
  try {
    await build({
      stdin: {
        contents:
          "export {default as RoleDashboard} from './src/RoleDashboard.tsx'; export {default as Dashboard, WorkspaceTopbar} from './src/Dashboard.tsx'; export * from './src/roleWorkspace.ts'; export * from './src/workspaceCatalogue.ts';",
        resolveDir: process.cwd(),
        loader: "tsx",
      },
      outfile: entry,
      bundle: true,
      format: "esm",
      platform: "node",
      jsx: "automatic",
      external: ["react", "react/*", "@phosphor-icons/react"],
      loader: { ".css": "empty" },
      logLevel: "silent",
    });
    const {
      RoleDashboard,
      WorkspaceTopbar,
      roleWorkspaces,
      canOpenPage,
      workspacePageFromSearch,
      workspacePageUrl,
      workspaceCatalogue,
    } = await import(pathToFileURL(entry).href);
    assert.equal(
      new Set(Object.values(roleWorkspaces).map((w) => w.title)).size,
      5,
    );
    assert.equal(workspaceCatalogue.length, 210);
    for (const workflow of workspaceCatalogue) {
      assert.ok(workflow.workflow && workflow.state, workflow.title);
      if (workflow.page) assert.ok(canOpenPage(workflow.role, workflow.page), `${workflow.role}: ${workflow.title} -> ${workflow.page}`);
    }
    assert.equal(canOpenPage("finance", "Invoices", false, ["Overview"]), false);
    for (const [role, workspace] of Object.entries(roleWorkspaces)) {
      for (const task of workspace.tasks)
        assert.ok(canOpenPage(role, task.page));
      assert.equal(canOpenPage(role, "Users"), role === "admin");
      if (role === "manager") continue;
      const html = renderToStaticMarkup(
        React.createElement(RoleDashboard, {
          user: { role, name: "Test staff" },
          overview: {
            active_users: 5,
            recent_activity: [],
            recent: [],
            incoming: "15000",
            count: 2,
          },
          money: String,
          onNavigate() {},
          onRecord() {},
        }),
      );
      assert.match(html, new RegExp(workspace.tasks[0].title));
      assert.match(html, new RegExp(`<h1>${workspace.title}</h1>`));
      assert.match(html, /reference-metric effect-card tone-/);
      assert.match(html, /module-hero-art/);
      assert.match(html, /No records in this view|No system activity yet/);
      if (role === "admin") {
        assert.match(html, /Active staff/);
        assert.doesNotMatch(
          html,
          /Record transaction|Record receipt|Net Cash Movement|Recent financial/,
        );
      }
      if (role === "auditor")
        assert.doesNotMatch(html, /Record transaction|Record receipt/);
      if (role === "cashier")
        assert.match(html, /My accepted receipts|Record receipt/);
    }
    const adminTopbar = renderToStaticMarkup(
      React.createElement(WorkspaceTopbar, {
        user: { role: "admin", name: "Admin" },
        pending: 0,
        readAll: false,
        onMenu() {},
        onNavigate() {},
        onSearch() {},
        onRefresh() {},
      }),
    );
    assert.doesNotMatch(
      adminTopbar,
      /Search transactions|Payment approvals|Account scope|calendar-range-fields/,
    );
    assert.match(adminTopbar, /Workspace calendar/);
    assert.equal(canOpenPage("admin", "Transactions"), false);
    assert.equal(canOpenPage("admin", "Approvals"), false);
    assert.equal(canOpenPage("admin", "Approvals", true), true);
    assert.equal(canOpenPage("cashier", "Approvals"), false);
    assert.equal(canOpenPage("unknown", "Overview"), false);
    assert.equal(workspacePageFromSearch(""), "Overview");
    assert.equal(workspacePageFromSearch("?page=Audit%20trail"), "Audit trail");
    assert.equal(
      workspacePageUrl("Audit trail"),
      "/workspace?page=Audit%20trail",
    );
    for (const role of ["cashier", "auditor", "finance", "manager"]) {
      assert.equal(
        canOpenPage(role, workspacePageFromSearch("?page=Users")),
        false,
      );
    }
    assert.equal(
      canOpenPage("admin", workspacePageFromSearch("?page=Transactions")),
      false,
    );
    assert.equal(
      canOpenPage("cashier", workspacePageFromSearch("?page=Reconciliation")),
      false,
    );
    assert.equal(
      canOpenPage(
        "auditor",
        workspacePageFromSearch("?page=Unknown%3Cscript%3E"),
      ),
      false,
    );
  } finally {
    unlinkSync(entry);
    rmdirSync(directory);
  }
});
