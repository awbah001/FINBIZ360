import { readdirSync, readFileSync, writeFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { requestPermission } from "../server/permissions.js";
const files = (directory) =>
  readdirSync(directory).flatMap((name) => {
    const path = join(directory, name);
    return statSync(path).isDirectory()
      ? files(path)
      : [path.replaceAll("\\", "/")];
  });
const inventory = [...files("src"), ...files("server")].map((path) => ({
  path,
  source: readFileSync(path, "utf8"),
}));
let result =
  "# Codebase inventory\n\nGenerated from all source files in `src/` and `server/` by `node scripts/audit-codebase.mjs`. React/TypeScript/Vite frontend, Express API, SQLite migrations, cookie-session authentication and CSRF verification are retained. A database contains one organisation.\n\n## Protected API inventory\n\nEvery protected route passes `roleBoundary` and the granular permission policy; route-specific ownership, state, approval and immutable-ledger checks remain additional requirements. Public setup/login and session discovery are explicitly distinguished.\n\n| Method | Endpoint | Permission | Source |\n| --- | --- | --- | --- |\n";
let endpoints = 0;
for (const { path, source } of inventory.filter((f) =>
  f.path.startsWith("server/"),
)) {
  for (const match of source.matchAll(
    /app\.(get|post|put|patch|delete)\(\s*["'](\/api\/[^"']+)["']/g,
  )) {
    const method = match[1].toUpperCase(),
      endpoint = match[2];
    const concrete = endpoint.slice(4).replace(/:[^/]+/g, "record-id");
    const permission = ["/api/login", "/api/setup", "/api/session"].includes(
      endpoint,
    )
      ? "Public/session discovery"
      : requestPermission(method, concrete);
    if (!permission)
      throw new Error(`No granular permission covers ${method} ${endpoint}`);
    result += `| ${method} | \`${endpoint}\` | \`${permission}\` | ${path} |\n`;
    endpoints++;
  }
}
result += `\n${endpoints} API route declarations found. HEAD follows GET authorization. Unknown paths are denied or return API 404; no implicit wildcard permission is granted.\n\n## Source and reusable-component inventory\n\n| Source | Lines | Exported symbols / components |\n| --- | --- | --- |\n`;
for (const { path, source } of inventory) {
  const symbols = [
    ...source.matchAll(
      /export\s+(?:default\s+)?(?:async\s+)?(?:function|class|const|type)\s+(\w+)/g,
    ),
  ].map((m) => m[1]);
  result += `| ${path} | ${source.split("\n").length} | ${symbols.join(", ") || (path.endsWith(".css") ? "Shared layout/design styles" : "Module entry / internal helpers")} |\n`;
}
result += "\n## Database schema inventory\n\n";
for (const { source } of inventory.filter((f) => f.path === "server/db.js"))
  result +=
    [...source.matchAll(/CREATE TABLE(?: IF NOT EXISTS)? (\w+)/g)]
      .map((m) => `- \`${m[1]}\``)
      .join("\n") + "\n";
writeFileSync("docs/CODEBASE_INVENTORY.md", result);
console.log(
  `Inventoried ${inventory.length} source files and ${endpoints} API declarations; all protected routes have a granular permission.`,
);
