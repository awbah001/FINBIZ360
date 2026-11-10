import { readFileSync, writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, sep } from "node:path";
import { decrypt } from "../server/security-crypto.js";
import { restoreToNewFile } from "../server/restore.js";
const arg = (name) => process.argv[process.argv.indexOf(name) + 1];
if (
  !process.argv.includes("--source") ||
  !process.argv.includes("--destination")
)
  throw Error(
    "Usage: npm run restore:encrypted -- --source backup.finbiz --destination data/new-restored.db",
  );
const folder = mkdtempSync(join(tmpdir(), "finbiz-decrypt-"));
try {
  const source = join(folder, "decrypted.db");
  writeFileSync(
    source,
    decrypt(readFileSync(resolve(arg("--source"))), "finbiz-backup-v1"),
    { mode: 0o600, flag: "wx" },
  );
  console.log(await restoreToNewFile(source, resolve(arg("--destination"))));
} finally {
  if (resolve(folder).startsWith(resolve(tmpdir()) + sep))
    rmSync(folder, { recursive: true, force: true });
}
