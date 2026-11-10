# Installation and moving to another computer

## Requirements

- Node.js 22.16.0 or newer and npm. Check with `node --version` and `npm --version` after opening a new terminal.
- A modern browser, a writable local project/data directory, and sufficient free space for dependencies, builds, company records and backups.
- Internet access to obtain the source and install packages. Local assets and fonts are bundled after the build; normal local operation does not require a CDN.
- Git for cloning/updating, or a downloaded and extracted repository ZIP.

SQLite comes with Node.js. Installing a separate database server or global React/Vite tools is unnecessary. The source has no fixed installation drive or user path.

## Fresh installation

```powershell
git clone https://github.com/awbah001/FINBIZ360.git
cd FINBIZ360
npm run setup
npm run doctor
npm start
```

Open http://127.0.0.1:3001. Register the organisation and initial owner/manager and administrator accounts. The database is created automatically. `npm run setup` performs a locked dependency installation and frontend build; it does not create demo records or overwrite the company database. Keep `package-lock.json` in the project and do not use `npm ci --omit=dev` before building.

For development, use `npm run dev` and http://127.0.0.1:5173 instead. Production frontend files in `dist/` and dependencies in `node_modules/` are generated locally rather than stored in Git.

## Environment settings

`.env.example` is a reference, not an automatically loaded configuration file. Set the following in your terminal before launching, or persist them securely in the account/service that runs the app. PowerShell values last for the current terminal session.

| Variable              | Default / purpose                                                                 |
| --------------------- | --------------------------------------------------------------------------------- |
| `HOST`                | `127.0.0.1`, accessible on the server computer only                               |
| `PORT`                | `3001`, the API and built frontend port                                           |
| `DB_PATH`             | `./data/workspace.db`, company SQLite file                                        |
| `NODE_ENV`            | Unset is local/development behavior; `production` enables secure cookies          |
| `SETUP_TOKEN`         | Operator-generated secret required for first-time production registration         |
| `FINBIZ_SECURITY_KEY` | 64 hexadecimal characters; required for authenticator setup and encrypted backups |
| `FINBIZ_BACKUP_DIR`   | `./backups/encrypted`, scheduled encrypted snapshot folder                        |
| `DEMO_PASSWORD`       | Optional seed-only demo password, at least 12 characters                          |

To generate a key, run the following once and save the output in a secure secret store. Assign that saved value to `FINBIZ_SECURITY_KEY` each time the app starts; do not generate a new value on each launch.

```powershell
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
$env:FINBIZ_SECURITY_KEY='paste-your-saved-key-here'
npm start
```

Losing or changing the key can make existing encrypted authenticator secrets and backups unreadable. Keep the same key when moving an existing database. Never paste a real key into source files or commit it. `SETUP_TOKEN` should be a separate random secret supplied to the operator who performs initial registration.

## Transfer existing company records

A Git clone does not include the database. To move records:

1. On the old computer, select the correct company database with `DB_PATH` if needed. Run `npm run backup` from the project folder. Use the resulting consistent snapshot, rather than copying a live SQLite file without its WAL state.
2. Stop the old server before switching business use to the new computer, to avoid two independent copies receiving transactions.
3. Transfer the snapshot securely to the new computer, along with the original `FINBIZ_SECURITY_KEY` through a separate secure channel if MFA or encryption was used. Restrict access to both; snapshots contain company and authentication data.
4. Install the same application revision or a compatible newer one on the new computer and run `npm run setup`.
5. Restore to a new filename:

```powershell
npm run restore -- --source backups/transferred-snapshot.db --destination data/restored-company.db
$env:DB_PATH='./data/restored-company.db'
# Set the original FINBIZ_SECURITY_KEY here if the database used it.
npm start
```

For a `.finbiz` encrypted snapshot, set the original key first and use `npm run restore:encrypted` with the same source/destination arguments. Restoration refuses to overwrite an existing file, checks integrity, and invalidates restored sessions. Sign in again with existing staff credentials and MFA, then verify company details, balances, invoices and audit history before resuming work. Persist the selected `DB_PATH` and key for future launches. Retain the original snapshot until the move is accepted.

## Access from other computers / production

Installing a copy on each computer gives each copy a separate database. To share the same records, run one server and have staff browsers connect to it. `127.0.0.1` always refers to the computer where the browser is running.

For production, place the server behind an HTTPS reverse proxy, configure `NODE_ENV=production`, a secure first-time `SETUP_TOKEN`, persistent data/key storage and controlled network access. Keep the Node service on loopback when the proxy is on the same computer. The proxy must forward the `/api` routes and the frontend to the same origin. Plain HTTP with production secure cookies will prevent normal sign-in. Do not expose the Vite development server as a production service. Hosting, certificates, service startup and firewall configuration depend on the chosen environment and are not provisioned by `npm run setup`.

Use a local disk for SQLite and one API process; do not place the live database on a shared network drive. Scheduled backups and recurring jobs require the server to remain running. Set up and verify off-device backups and service restart behavior for ongoing use.

## Troubleshooting

| Symptom                                     | Action                                                                                                                                  |
| ------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `node` or `npm` is not recognized           | Install Node.js with npm, reopen the terminal and check PATH.                                                                           |
| PowerShell blocks `npm.ps1`                 | Use `npm.cmd` in place of `npm`, or run the commands in Command Prompt.                                                                 |
| SQLite import/backup support fails          | Check Node.js is at least 22.16.0; run `npm run doctor`.                                                                                |
| Dependency installation fails               | Check internet/proxy access and run `npm ci` from the folder containing `package.json` and the lockfile.                                |
| Missing frontend build                      | Run `npm run build`, then `npm start`.                                                                                                  |
| `EADDRINUSE`                                | Stop the other service or select another `PORT`; use that port in the browser URL. Update the Vite proxy too if using development mode. |
| Permission denied / SQLite cannot open file | Use a writable local folder and check `DB_PATH` and disk space. Avoid protected installation directories.                               |
| Browser cannot connect                      | Keep the server terminal open and use the printed host/port. Check firewall/proxy settings for remote access.                           |
| Empty workspace after moving                | Stop and check `DB_PATH`; Git does not transfer records. Restore the intended snapshot.                                                 |
| MFA or encrypted restore fails after moving | Confirm the original `FINBIZ_SECURITY_KEY` is configured, without printing it in logs.                                                  |

## Verification limits

The setup checks verify runtime features and a disposable write probe without modifying company records. A successful build and local startup do not establish that another operating system, network or production hosting environment has been tested. Run `npm test`, start the app, and verify a first-time registration or restored-company sign-in on the destination computer.

On 10 November 2026, a separate Windows source copy with fresh dependencies passed `npm run setup` and `npm start` using Node.js 25.2.1 and npm 11.6.2. Both the built frontend and fresh-workspace session API returned HTTP 200. Preflight also correctly rejected a missing build and an invalid encryption key. This was an isolated installation on the development computer, not a test on a second physical computer.

The installation audit reported three moderate advisories involving `csv-parse`, `exceljs` and its `uuid` dependency. Review these before production deployment. The suggested fixes include major-version changes; do not run `npm audit fix --force` without checking statement-import and report-export compatibility.
