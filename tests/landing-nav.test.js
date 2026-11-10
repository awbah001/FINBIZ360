import { test } from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
import { mkdtempSync, unlinkSync, rmdirSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

test("landing navbar keeps section destinations, labelled icon links and sign-in access", async () => {
  const directory = mkdtempSync(join(process.cwd(), ".finbiz-landing-check-"));
  const entry = join(directory, "home.mjs");
  try {
    await build({
      stdin: {
        contents: "export {default as Home} from './src/Home.tsx';",
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
    const { Home } = await import(pathToFileURL(entry).href);
    const html = renderToStaticMarkup(React.createElement(Home));
    const nav = html.match(/<nav class="landing-nav"[\s\S]*?<\/nav>/)?.[0];
    assert.ok(nav);
    assert.match(nav, /aria-label="Main navigation"/);
    assert.match(nav, /landing-nav-lamp" aria-hidden="true"/);
    for (const [id, name] of [
      ["features", "Features"],
      ["how-it-works", "How it works"],
      ["questions", "Questions"],
    ]) {
      assert.ok(nav.includes(`href="#${id}" aria-label="${name}"`));
      assert.ok(html.includes(`id="${id}"`));
    }
    assert.equal((nav.match(/aria-current="location"/g) || []).length, 1);
    assert.equal((nav.match(/landing-nav-icon/g) || []).length, 3);
    assert.match(html, /href="\/login"/);
    assert.match(html, /Skip to content/);
  } finally {
    unlinkSync(entry);
    rmdirSync(directory);
  }
});
