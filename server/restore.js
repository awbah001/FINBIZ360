import { DatabaseSync, backup } from "node:sqlite";
import { existsSync, openSync, closeSync, mkdirSync } from "node:fs";
import { dirname, resolve, basename } from "node:path";
import { pathToFileURL } from "node:url";
import { audit, atomic } from "./db.js";

export async function restoreToNewFile(source, destination) {
  const input = resolve(source),
    output = resolve(destination);
  if (input === output || existsSync(output))
    throw new Error(
      "Destination must be a new, unused filename. Existing databases are never overwritten.",
    );
  if (!existsSync(input)) throw new Error("Backup source was not found.");
  const original = new DatabaseSync(input, { readOnly: true });
  try {
    if (
      original.prepare("PRAGMA integrity_check").get().integrity_check !==
        "ok" ||
      original.prepare("PRAGMA foreign_key_check").all().length
    )
      throw new Error("Source integrity checks failed.");
    const version = original
      .prepare("SELECT MAX(version) AS n FROM migrations")
      .get().n;
    if (version > 7)
      throw new Error("Backup schema is newer than this application.");
    const expected = original
      .prepare("SELECT COUNT(*) AS n FROM transactions")
      .get().n;
    mkdirSync(dirname(output), { recursive: true });
    const reserved = openSync(output, "wx", 0o600);
    closeSync(reserved);
    await backup(original, output);
    const restored = new DatabaseSync(output);
    try {
      if (
        restored.prepare("PRAGMA integrity_check").get().integrity_check !==
          "ok" ||
        restored.prepare("PRAGMA foreign_key_check").all().length
      )
        throw new Error(
          "Restored integrity checks failed. Retain this new file for investigation.",
        );
      if (
        restored.prepare("SELECT COUNT(*) AS n FROM transactions").get().n !==
        expected
      )
        throw new Error("Restored transaction count differs.");
      atomic(restored, () => {
        restored.prepare("DELETE FROM sessions").run();
        audit(restored, null, "backup.restore", "database", {
          source: basename(input),
          transactions: expected,
          sessions_invalidated: true,
        });
      });
      return {
        destination: output,
        transactions: expected,
        integrity: "ok",
        sessions_invalidated: true,
      };
    } finally {
      restored.close();
    }
  } finally {
    original.close();
  }
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  const argument = (name) => process.argv[process.argv.indexOf(name) + 1];
  if (
    !process.argv.includes("--source") ||
    !process.argv.includes("--destination")
  ) {
    console.error(
      "Usage: npm run restore -- --source backups/snapshot.db --destination data/restored-new.db",
    );
    process.exitCode = 1;
  } else
    try {
      console.log(
        JSON.stringify(
          await restoreToNewFile(
            argument("--source"),
            argument("--destination"),
          ),
          null,
          2,
        ),
      );
      console.log(
        "Start the application with DB_PATH set to the new destination after reviewing the restored records.",
      );
    } catch (error) {
      console.error(error.message);
      process.exitCode = 1;
    }
}
