# FinBiz 360

A financial management workspace built with React, TypeScript, Node.js, Express and SQLite. It includes five server-enforced roles, invoices and payment allocation, supplier bills, statement imports and reconciliation, reporting, audit history, profile photos, and backup controls.

## Run on another computer

Install **Node.js 22.16.0 or newer with npm**, and use a modern browser such as Edge, Chrome, Firefox or Safari. Git is needed only if you use the clone command; downloading and extracting the GitHub ZIP also works. No separate SQLite server, Python, Java, Docker or database account is required. The computer needs internet access for the first dependency installation and write access to the project/data directory. Record storage and backups need additional disk space as usage grows.

Clone the repository, or extract its ZIP and open a terminal inside the extracted folder:

```powershell
git clone https://github.com/awbah001/FINBIZ360.git
cd FINBIZ360
node --version
npm --version
npm run setup
npm start
```

`npm run setup` checks Node/SQLite, installs the exact dependencies in `package-lock.json` using `npm ci`, and builds the frontend. Keep development dependencies available during setup because TypeScript and Vite compile the app. `npm start` checks the environment and serves both the frontend and API.

Open **http://127.0.0.1:3001** on that computer. Keep the terminal running; press Ctrl+C to stop. Do not open `index.html` directly. Subsequent launches only need `npm start` from the project folder. These npm commands also work in macOS/Linux terminals; environment-variable examples below use PowerShell.

On first launch, register your organisation and create distinct owner/manager and administrator accounts. Then create staff accounts and add your company accounts and records. GitHub contains source code, not your company database, staff passwords or encryption key. A fresh clone starts an empty workspace; see [installation, migration and troubleshooting](docs/INSTALLATION.md) to transfer existing records.

## Configuration

Defaults work for local use. The app does **not** automatically read `.env`; `.env.example` documents the available settings. Set variables in the terminal before starting, or configure them in the operating system/service environment:

```powershell
$env:HOST='127.0.0.1'
$env:PORT='3001'
$env:DB_PATH='./data/workspace.db'
npm start
```

Paths are relative to the project folder unless absolute. Company data defaults to `data/workspace.db`; keep it on a local disk and run one API instance against it. Preserve the database when updating the source. Never commit databases, backups, real `.env` files or keys.

Authenticator setup and encrypted backups require a persistent `FINBIZ_SECURITY_KEY`. Production first-time setup also requires `SETUP_TOKEN`; production cookies require HTTPS. See [the installation guide](docs/INSTALLATION.md) before configuring these or serving other computers.

## Development and demo

```powershell
npm run dev
```

Open **http://127.0.0.1:5173**. Vite proxies API requests to port 3001. If you change the backend port, update the target in `vite.config.ts` too.

For an optional separate demo, leave `DB_PATH` unset, run `npm run seed`, then `npm run dev:demo`. The seed command prints a generated password for `manager@finbiz.demo`, `finance@finbiz.demo`, `cashier@finbiz.demo`, `auditor@finbiz.demo` and `admin@finbiz.demo`. This uses `data/finbiz-demo.db`. Seeding refuses an existing database; never seed a company database.

## Maintenance commands

| Command                                                                                            | Purpose                                                                     |
| -------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| `npm run doctor`                                                                                   | Check runtime, SQLite, dependencies and database directory                  |
| `npm test`                                                                                         | Run API, access-control and financial-integrity tests in isolated databases |
| `npm run build`                                                                                    | Type-check and compile the frontend                                         |
| `npm run backup`                                                                                   | Make a consistent snapshot of the selected database under `backups/`        |
| `npm run restore -- --source backups/snapshot.db --destination data/restored-new.db`               | Restore to a new file and invalidate restored sessions                      |
| `npm run restore:encrypted -- --source backups/snapshot.finbiz --destination data/restored-new.db` | Restore an encrypted snapshot using the original encryption key             |

System maintenance also supports encrypted scheduled backups once the encryption key is configured. Store off-device backups and their key separately. Scheduled tasks run only while the server is running. After updating source, stop the app, back up records, run `npm run setup`, then restart. Startup applies database migrations; retain a pre-update backup for rollback.

## Financial boundaries

The workspace uses SLE with two decimal places, integer minor units, and Africa/Freetown business dates. Invoices do not create cash receipts; allocation links existing payments. Posted financial fields and audit records are protected against ordinary application edits, and corrections use explicit workflows. The default SQLite file is not encrypted. This is a single-company application with a single API process, not a hosted multi-tenant payment service or a complete double-entry ledger. Real provider data currently enters through statement imports.

See the [explanation and demonstration guide](docs/FINBIZ_360_EXPLANATION_AND_DEMONSTRATION_GUIDE.md) for a walkthrough. Automated checks do not replace company acceptance testing or review of hosting, HTTPS, access, retention and backups before live use.
