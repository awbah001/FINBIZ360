import { test } from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
import { mkdtempSync, unlinkSync, rmdirSync } from "node:fs";
import { resolve, join } from "node:path";
import { pathToFileURL } from "node:url";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

test("rendered dashboards and invoice controls respect read-only roles and non-cash write-offs", async () => {
  const directory = mkdtempSync(join(process.cwd(), ".finbiz-ui-check-")),
    entry = join(directory, "ui.mjs");
  try {
    await build({
      stdin: {
        contents:
          "export {default as Dashboard} from './src/Dashboard.tsx'; export {InvoiceActions, SupplierBills} from './src/Enhancements.tsx';",
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
    const { Dashboard, InvoiceActions, SupplierBills } = await import(
      pathToFileURL(entry).href
    );
    const noop = () => {},
      money = (v = 0) => (Number(v) / 100).toFixed(2);
    const shared = {
      api: async () => [],
      form: noop,
      money,
      refresh: noop,
      canEdit: false,
      role: "auditor",
      revision: 0,
    };
    const invoice = {
      id: "i1",
      lifecycle: "issued",
      paid: "0",
      written_off: "10000",
      outstanding: "0",
      items: [],
      status: "written_off",
    };
    const html = renderToStaticMarkup(
      React.createElement(InvoiceActions, { ...shared, invoice }),
    );
    assert.match(html, /Payment history/);
    assert.doesNotMatch(
      html,
      /Cancel invoice|Issue invoice|Correct allocation/,
    );
    const writer = renderToStaticMarkup(
      React.createElement(InvoiceActions, {
        ...shared,
        canEdit: true,
        invoice,
      }),
    );
    assert.doesNotMatch(writer, /Cancel invoice/);
    const bills = renderToStaticMarkup(
      React.createElement(SupplierBills, {
        ...shared,
        data: [
          {
            ...invoice,
            number: "BILL-1",
            amount: "10000",
            contact_name: "Supplier",
            due: "2026-11-10",
          },
        ],
        contacts: [],
      }),
    );
    assert.match(bills, /BILL-1/);
    assert.match(bills, /Payment history/);
    assert.doesNotMatch(bills, /Record bill|Allocate payment/);
    const overview = {
      net: "0",
      incoming: "0",
      outgoing: "0",
      count: 0,
      pending: 0,
      reconciled: 0,
      trend: [],
      recent: [],
      accounts: [],
      outstanding_customers: "10000",
      outstanding_suppliers: "2500",
      unmatched: 0,
      document_scope: "Company-wide documents issued in date range",
    };
    const props = {
      overview,
      user: { name: "Hannah Gassama" },
      role: "Auditor",
      accounts: [],
      readAll: true,
      canRecord: false,
      canManageAccounts: false,
      onRecord: noop,
      onNavigate: noop,
      money,
      from: "",
      to: "",
      account: "",
      onFrom: noop,
      onTo: noop,
      onAccount: noop,
      lastUpdated: null,
      demo: false,
    };
    const dashboard = renderToStaticMarkup(
      React.createElement(Dashboard, props),
    );
    assert.match(dashboard, /Outstanding customer invoices/);
    assert.match(dashboard, /SLE 100.00/);
    assert.doesNotMatch(
      dashboard,
      /Record Transaction|Import Statement|NaN|Infinity/,
    );
    assert.match(dashboard, /No transactions recorded yet/);
    const cashier = renderToStaticMarkup(
      React.createElement(Dashboard, {
        ...props,
        role: "Cashier",
        readAll: false,
        canRecord: true,
      }),
    );
    assert.doesNotMatch(
      cashier,
      /Outstanding customer invoices|Run Reconciliation|View Reports/,
    );
    assert.match(cashier, /Record Transaction/);
    const manager = renderToStaticMarkup(
      React.createElement(Dashboard, {
        ...props,
        user: { name: "Manager", role: "manager" },
        role: "Owner / Manager",
        canRecord: true,
      }),
    );
    assert.match(manager, /Manager decisions/);
    assert.match(manager, /Financial controls and delegation/);
    assert.doesNotMatch(dashboard, /Manager decisions/);
  } finally {
    assert.ok(
      resolve(directory).startsWith(
        resolve(process.cwd(), ".finbiz-ui-check-"),
      ),
    );
    try {
      unlinkSync(entry);
    } catch {}
    rmdirSync(directory);
  }
});
