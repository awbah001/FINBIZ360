import { test } from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
import { mkdtempSync, unlinkSync, rmdirSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

test("workspace calendar handles leap days, Monday weeks and read-only administrative use", async () => {
  const folder = mkdtempSync(join(process.cwd(), ".finbiz-calendar-check-"));
  const entry = join(folder, "calendar.mjs");
  try {
    await build({
      stdin: {
        contents:
          "export {default as Calendar,calendarDays,calendarToday} from './src/WorkspaceCalendar.tsx';",
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
    const { Calendar, calendarDays, calendarToday } = await import(
      pathToFileURL(entry).href
    );
    const leap = calendarDays("2024-02-15", "month");
    assert.ok(leap.includes("2024-02-29"));
    assert.ok(!calendarDays("2025-02-15", "month").includes("2025-02-29"));
    const november = calendarDays("2026-11-03", "month");
    assert.equal(november[0], "2026-10-26");
    assert.equal(november.length, 42);
    assert.ok(november.includes("2026-11-30"));
    assert.deepEqual(calendarDays("2026-11-03", "week"), [
      "2026-11-02",
      "2026-11-03",
      "2026-11-04",
      "2026-11-05",
      "2026-11-06",
      "2026-11-07",
      "2026-11-08",
    ]);
    assert.match(calendarToday(), /^\d{4}-\d{2}-\d{2}$/);
    const editable = renderToStaticMarkup(
      React.createElement(Calendar, {
        selected: "2024-02-29",
        from: "2024-02-29",
        to: "2024-02-29",
        onSelect() {},
      }),
    );
    assert.match(
      editable,
      /aria-label="Thursday, 29 February 2024" aria-pressed="true"/,
    );
    assert.match(editable, /Previous month/);
    assert.match(editable, /Next month/);
    assert.match(editable, /Select a day to filter saved records/);
    const readOnly = renderToStaticMarkup(
      React.createElement(Calendar, { selected: "2024-02-29" }),
    );
    assert.match(readOnly, /Africa\/Freetown calendar/);
    assert.doesNotMatch(
      readOnly,
      /<button[^>]+aria-label="Thursday, 29 February 2024"/,
    );
    assert.doesNotMatch(readOnly, /Select a day to filter saved records/);
  } finally {
    unlinkSync(entry);
    rmdirSync(folder);
  }
});
