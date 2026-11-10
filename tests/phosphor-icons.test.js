import { test } from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
import { mkdtempSync, unlinkSync, rmdirSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { House } from "@phosphor-icons/react";

test("navigation selection changes Phosphor geometry and dashboard icons retain accessible decoration", async () => {
  const directory = mkdtempSync(join(process.cwd(), ".finbiz-icons-"));
  try {
    const entry = join(directory, "icons.mjs");
    await build({
      stdin: {
        contents: "export {default as SystemIcon} from './src/SystemIcon.tsx';",
        resolveDir: process.cwd(),
        loader: "tsx",
      },
      outfile: entry,
      bundle: true,
      format: "esm",
      platform: "node",
      jsx: "automatic",
      external: ["react", "react/*", "@phosphor-icons/react"],
      logLevel: "silent",
    });
    const { SystemIcon } = await import(pathToFileURL(entry).href);
    const paths = (html) =>
      [...html.matchAll(/<path[^>]*\sd="([^"]+)"/g)].map((m) => m[1]);
    for (const [variant, active, weight, size] of [
      ["navigation", false, "regular", 21],
      ["navigation", true, "fill", 21],
      ["metric", false, "duotone", 25],
      ["hero", false, "duotone", 36],
      ["shortcut", false, "bold", 24],
    ]) {
      const html = renderToStaticMarkup(
        React.createElement(SystemIcon, { icon: House, variant, active, size }),
      );
      const glyph = html.match(
        /<svg[^>]*class="system-icon-glyph"[\s\S]*?<\/svg>/,
      )?.[0];
      assert.ok(glyph, `${variant}: visible SVG glyph`);
      assert.deepEqual(
        paths(glyph),
        paths(renderToStaticMarkup(React.createElement(House, { weight }))),
      );
      assert.match(glyph, /aria-hidden="true"/);
      assert.match(glyph, /focusable="false"/);
      assert.ok(glyph.includes(`width="${size}"`));
      assert.ok(glyph.includes(`height="${size}"`));
    }
  } finally {
    unlinkSync(join(directory, "icons.mjs"));
    rmdirSync(directory);
  }
});
