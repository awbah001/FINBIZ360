import { createRequire } from "node:module";
import { existsSync, mkdirSync, mkdtempSync, rmdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

const runtimeOnly = process.argv.includes("--runtime-only");
const requireBuild = process.argv.includes("--require-build");
let failures = 0;
function check(label, action) {
  try {
    action();
    console.log(`OK: ${label}`);
  } catch (error) {
    failures++;
    console.error(`FAIL: ${label}: ${error.message}`);
  }
}

check("Node.js 22.16.0 or newer", () => {
  const [major, minor] = process.versions.node.split(".").map(Number);
  if (major < 22 || (major === 22 && minor < 16))
    throw Error("Install Node.js 22.16.0 or newer, then reopen your terminal.");
});
try {
  const { DatabaseSync, backup } = await import("node:sqlite");
  check("Built-in SQLite and backup support", () => {
    if (typeof backup !== "function")
      throw Error("SQLite backup is unavailable.");
    const db = new DatabaseSync(":memory:");
    try {
      db.exec("CREATE TABLE environment_check (id INTEGER PRIMARY KEY)");
    } finally {
      db.close();
    }
  });
} catch {
  failures++;
  console.error(
    "FAIL: Built-in SQLite is unavailable. Install Node.js 22.16.0 or newer.",
  );
}

if (!runtimeOnly) {
  const require = createRequire(import.meta.url);
  const pkg = require("../package.json");
  check("Installed application dependencies", () => {
    for (const dependency of Object.keys(pkg.dependencies))
      require.resolve(dependency);
  });
  check("Writable database directory", () => {
    const folder = dirname(
      resolve(process.env.DB_PATH || "./data/workspace.db"),
    );
    mkdirSync(folder, { recursive: true });
    const probe = mkdtempSync(resolve(folder, ".finbiz-check-"));
    rmdirSync(probe);
  });
  if (requireBuild) {
    check("Built frontend", () => {
      if (!existsSync("dist/index.html"))
        throw Error("Run npm run build before npm start.");
    });
  }
  if (process.env.NODE_ENV === "production" && !process.env.SETUP_TOKEN)
    console.log(
      "NOTE: First-time production registration requires SETUP_TOKEN.",
    );
  if (!process.env.FINBIZ_SECURITY_KEY)
    console.log(
      "NOTE: MFA setup and encrypted backups require FINBIZ_SECURITY_KEY (see .env.example).",
    );
  else
    check("Encryption key format", () => {
      if (!/^[a-f0-9]{64}$/i.test(process.env.FINBIZ_SECURITY_KEY))
        throw Error(
          "FINBIZ_SECURITY_KEY must contain exactly 64 hexadecimal characters.",
        );
    });
}
process.exitCode = failures ? 1 : 0;
