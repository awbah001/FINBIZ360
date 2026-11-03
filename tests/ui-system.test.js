import { test } from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
import { mkdtempSync, unlinkSync, rmdirSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

test("matching picker preserves exact remaining signed totals and accessible selection limits", async () => {
  const directory = mkdtempSync(join(process.cwd(), ".finbiz-ui-check-"));
  const entry = join(directory, "picker.mjs");
  try {
    await build({
      stdin: {
        contents:
          "export {default as RecordPicker, selectedSummary} from './src/RecordPicker.tsx'; export {allowWorkspaceNavigation} from './src/useUnsavedChanges.ts'; export {default as Login} from './src/Login.tsx';",
        resolveDir: process.cwd(),
        loader: "tsx",
      },
      outfile: entry,
      bundle: true,
      format: "esm",
      platform: "node",
      jsx: "automatic",
      external: ["react", "react/*", "lucide-react"],
      loader: { ".css": "empty" },
      logLevel: "silent",
    });
    const { RecordPicker, selectedSummary, allowWorkspaceNavigation, Login } =
      await import(pathToFileURL(entry).href);
    const rows = [
      {
        id: "1",
        account_id: "a",
        account_name: "Bank account",
        reference: "SALE-1",
        date: "2026-11-02",
        amount: "900719925474099301",
        remaining_minor: "900719925474099300",
        direction: "in",
      },
      {
        id: "2",
        account_id: "a",
        account_name: "Bank account",
        reference: "FEE-1",
        date: "2026-11-02",
        amount: "300",
        direction: "out",
      },
      {
        id: "3",
        account_id: "b",
        account_name: "Cash account",
        reference: "CASH-1",
        date: "2026-11-02",
        amount: "10",
        direction: "in",
      },
    ];
    assert.deepEqual(selectedSummary(rows, ["1", "2"]), {
      count: 2,
      accounts: ["a"],
      total: 900719925474099000n,
    });
    assert.deepEqual(selectedSummary(rows, ["1", "3"]).accounts, ["a", "b"]);
    assert.deepEqual(selectedSummary(rows, []), {
      count: 0,
      accounts: [],
      total: 0n,
    });
    const html = renderToStaticMarkup(
      React.createElement(RecordPicker, {
        name: "transaction_ids",
        title: "Internal entries",
        rows,
        selected: ["1"],
        onSelect: () => {},
        limit: 1,
        money: String,
      }),
    );
    assert.match(html, /<legend>Internal entries<\/legend>/);
    assert.match(html, /type="search"/);
    assert.equal((html.match(/type="checkbox"/g) || []).length, 3);
    assert.equal((html.match(/disabled=""/g) || []).length, 2);
    assert.equal((html.match(/checked=""/g) || []).length, 1);
    assert.doesNotMatch(html, /<select|Ctrl\/Cmd/);
    assert.match(html, /1 of 1 selected/);
    const login = renderToStaticMarkup(
      React.createElement(Login, {
        demo: false,
        onAuthenticate: async () => {},
      }),
    );
    assert.match(login, /for="login-email"/);
    assert.match(login, /autocomplete="username"/i);
    assert.match(login, /autocomplete="current-password"/i);
    assert.match(login, /aria-label="Show password"/);
    const previous = globalThis.window;
    try {
      globalThis.window = new EventTarget();
      assert.equal(allowWorkspaceNavigation(), true);
      window.addEventListener("finbiz-before-navigation", (event) =>
        event.preventDefault(),
      );
      assert.equal(
        allowWorkspaceNavigation(),
        false,
        "a form may cancel navigation before losing edits",
      );
    } finally {
      if (previous === undefined) delete globalThis.window;
      else globalThis.window = previous;
    }
  } finally {
    try {
      unlinkSync(entry);
    } catch {}
    rmdirSync(directory);
  }
});
