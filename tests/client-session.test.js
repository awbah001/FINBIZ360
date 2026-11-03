import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";

test("expired client session renews CSRF before reauthentication; wrong password does not dispatch logout", async () => {
  const source = ts.createSourceFile(
    "main.tsx",
    readFileSync(new URL("../src/main.tsx", import.meta.url), "utf8"),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  const fn = source.statements.find(
    (n) => ts.isFunctionDeclaration(n) && n.name?.text === "api",
  );
  assert.ok(fn);
  const compiled = ts.transpileModule(
    `let csrf='old-token';${fn.getText(source)};export {api};export const token=()=>csrf;`,
    {
      compilerOptions: {
        module: ts.ModuleKind.ESNext,
        target: ts.ScriptTarget.ES2022,
      },
    },
  ).outputText;
  const client = await import(
    "data:text/javascript;base64," + Buffer.from(compiled).toString("base64")
  );
  const previousFetch = globalThis.fetch,
    previousWindow = globalThis.window;
  let events = 0,
    renewals = 0,
    loginHeader;
  try {
    globalThis.window = new EventTarget();
    window.addEventListener("finbiz-session-expired", () => events++);
    globalThis.fetch = async (url, options) => {
      if (url === "/api/session") {
        renewals++;
        return new Response(
          JSON.stringify({ csrf: "fresh-token", user: null }),
          { status: 200 },
        );
      }
      if (url === "/api/login") {
        loginHeader = options.headers["x-csrf-token"];
        return new Response(JSON.stringify({ ok: true }), { status: 200 });
      }
      return new Response(JSON.stringify({ error: "Please sign in." }), {
        status: 401,
      });
    };
    await assert.rejects(client.api("/transactions"), (e) => e.status === 401);
    assert.equal(events, 1);
    assert.equal(renewals, 1);
    assert.equal(client.token(), "fresh-token");
    await client.api("/login", "POST", {
      email: "synthetic@example.test",
      password: "synthetic-only",
    });
    assert.equal(loginHeader, "fresh-token");
    globalThis.fetch = async () =>
      new Response(
        JSON.stringify({ error: "Email or password is incorrect." }),
        { status: 401 },
      );
    await assert.rejects(client.api("/login", "POST", {}), /Email or password/);
    assert.equal(events, 1);
    assert.equal(client.token(), "fresh-token");
  } finally {
    globalThis.fetch = previousFetch;
    if (previousWindow === undefined) delete globalThis.window;
    else globalThis.window = previousWindow;
  }
});
