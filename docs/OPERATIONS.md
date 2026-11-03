# Local operations and pilot preparation

## Files and configuration

`DB_PATH` defaults to `./data/workspace.db`, resolved from the working directory. The parent directory is created on first startup. Migrations run automatically and are tracked in `migrations`. Migration v2 labels existing seeded databases as demo without removing their records. The separate seed/demo commands default to `./data/finbiz-demo.db`. The original `./data/finbiz.db` remains untouched unless explicitly selected. Do not put the database on a network share or run multiple API instances against it.

First-run setup is available only when no user exists and creates the organisation plus distinct owner/manager and administrator accounts. It does not insert financial or reference data. In production, configure a unique server `SETUP_TOKEN` and provide it in the setup form; without that token, setup is refused. Do not expose an unconfigured development instance beyond loopback. Setup cannot replace or reset an existing workspace.

The database includes statement source bytes, import previews, sessions and all financial records. Restrict filesystem permissions to the application operator. `data/`, `backups/` and `.env` are ignored by Git. The application uses local filesystem protection; it does not supply encryption at rest.

`npm run dev` starts the Node.js API and Vite. `npm run build` builds the React frontend. `npm start` serves the built frontend and API from port 3001. Use `NODE_ENV=production` only behind HTTPS, because production cookies are secure. Configure a trusted reverse proxy and review IP-based login throttling for that topology; do not blindly trust arbitrary forwarded headers.

## Backup

```powershell
npm run backup
```

This uses SQLite's online backup API to create a consistent database under `backups/`; it does not incorrectly copy a live `.db` without its WAL. Statement evidence is included in the database. Encrypt the resulting snapshot with organisation-approved tooling before off-device storage. Automated encryption, scheduling and retention are not implemented.

Provisional pilot objectives to validate with the organisation: daily backups (maximum 24-hour data-loss window) and restoration within four hours. These are planning assumptions, not tested service guarantees. Schedule the backup command using the organisation's operations process once agreed.

## Controlled restoration

1. Stop the application with Ctrl+C and verify no other instance is using the target database.
2. Retain the current database and any corresponding WAL/SHM files together as incident evidence; do not overwrite or delete them during initial investigation.
3. Copy the selected backup to a **new filename** in `data/`, for example `data/restored-pilot.db`.
4. In the terminal used to start the app, set `$env:DB_PATH='./data/restored-pilot.db'`. Run the integrity check below before startup.
5. Start the application against that filename. Compare transaction counts, key account movements, imported statements and audit history against recorded backup verification evidence.
6. Treat restored sessions as sensitive. For an actual incident, invalidate restored sessions through a controlled operator procedure before granting access.

```powershell
node --input-type=module -e "import { DatabaseSync } from 'node:sqlite'; const db = new DatabaseSync('./data/restored-pilot.db'); console.log(db.prepare('PRAGMA integrity_check').get()); console.log(db.prepare('PRAGMA foreign_key_check').all()); db.close();"
```

The automated suite independently creates and restores a snapshot and verifies integrity, foreign keys and record counts. Complete a real operator restoration drill before pilot use.

## Incidents and release limits

Record incident time, symptoms, affected records, operator, containment and recovery outcome. Preserve evidence without logging passwords or provider secrets. Investigate login failures, failed imports and inconsistent account movements. Do not silently alter financial rows to repair discrepancies; preserve original entries and use audited workflows.

No real funds move through this application. Live payment APIs, privileged MFA, comprehensive monitoring, data-retention automation and company-approved deployment controls remain outside this initial release.

## Enhancement release and restoration command

Migrations v3-v6 add metadata/reference/evidence/payable/control/group/partial allocation tables and indexes. They do not delete original financial or audit rows. Test the release against a copy and take a verified backup before restarting an active company instance. Automatic startup applies pending migrations. Do not edit migration rows or use destructive down-migrations on a populated database.

Administrators can download an online consistent snapshot from Settings. It includes financial evidence, hashes and sessions, so restrict/encrypt storage using approved operator tooling. This is not an automatically encrypted/scheduled backup service.

```powershell
npm run restore -- --source backups/selected-snapshot.db --destination data/restored-new.db
```

The command opens the source read-only, refuses an existing destination, checks integrity/foreign keys/transaction counts, invalidates sessions in the restored copy and records a restore audit event. It never overwrites the live database. Review the new copy and set `DB_PATH` to its filename when ready. Retain the old live file and WAL/SHM together as incident evidence. A failed restore may leave a new file for investigation; do not bypass overwrite safeguards.

Production HTTPS/reverse-proxy trust, restricted filesystem ACLs, encryption/key management, retention/schedules, monitoring and incident ownership require organisation/host configuration. Backups contain all source statement bytes. Do not use a real-company database for benchmarks or test seeding. `npm run benchmark` uses in-memory synthetic records only and records its conditions/results in docs/BENCHMARK.json.
