# Local stack runbook and verification record

## Services and readiness

| Service | Internal port | Check | Storage / exposure |
| --- | --- | --- | --- |
| `mysql` | 3306 | Authenticated `SELECT 1` | Named `mysql_data` volume; no host port |
| `backend` | 8080 | `/api/health` | Ledger/jobs/alerts in MySQL; no host port |
| `analytics` | 8000 | `/health` requires a compatible model | Build-trained model; no host port |
| `frontend` | 8080 | `/healthz` | Static React assets; loopback port 8088 by default |
| `smoke` | none | One-shot command | Optional `tools` profile |

MySQL health gates backend startup. Analytics must be started but need not be healthy:
rules remain a safe fallback. Frontend waits for backend health. Startup dependencies
do not continuously supervise correctness. Backend health retains its existing process
health semantics, not a live database-readiness query; FastAPI checks model readiness.
Full smoke checks verify the chain separately.

## Configure and start

```powershell
python scripts/setup_env.py --demo
docker compose config --quiet
docker compose up --build -d --wait --wait-timeout 240
docker compose ps
```

Visit `http://localhost:8088`. Omit `--demo` to start empty. The helper creates ignored
`.env` and `.secrets/mysql-password` / `.secrets/mysql-root-password`, never prints
passwords, and preserves existing files. POSIX creation uses restrictive permissions;
Windows users should protect the directory with their account's filesystem ACLs.
Local Compose secrets are file mounts, not an encrypted external secret manager.

| Root `.env` setting | Default/example |
| --- | --- |
| `MYSQL_PASSWORD_FILE` | `.secrets/mysql-password` |
| `MYSQL_ROOT_PASSWORD_FILE` | `.secrets/mysql-root-password` |
| `WEB_PORT` | 8088 |
| `DEMO_ENABLED` | false; setup `--demo` sets true |
| `ML_ENABLED` | true |
| `ML_CONNECT_TIMEOUT_MS` / `ML_REQUEST_TIMEOUT_MS` | 500 / 2000 |

The app password is mounted into Spring as `/run/secrets/db.password`; the `docker`
profile imports the directory as a config tree. Plaintext `DB_PASSWORD` is not placed
in Compose environment configuration. `DB_SECRETS_DIR` can override the directory for
native verification; the container default is `/run/secrets/`. MySQL uses `_FILE`
variables; its root password is not mounted into backend or analytics.

MySQL initializes credentials only on a new volume. Replacing files does not rotate
an existing database password. Preserve credentials across stops/rebuilds; restore
originals or perform deliberate rotation instead of deleting files as a shortcut.

The browser uses relative `/api`, proxied to `backend:8080`; Java calls
`analytics:8000`. Nginx preserves the browser Host including the published port so
same-origin POSTs work with no additional CORS origins. Only model readiness is
proxied at `/analytics/health`; inference remains internal. Changing `WEB_PORT`
does not require rebuilding the browser API URL. `VITE_*` variables are public.

## Lifecycle

```powershell
docker compose logs --tail=100 mysql backend analytics frontend
docker compose stop
docker compose start
docker compose build --pull
docker compose up -d --wait --wait-timeout 240
docker compose down
```

`stop` and `down` retain MySQL data. Rebuilds update images, not ledger rows. Flyway
owns schema changes; V1/V2 are unchanged, while V3 adds only seed metadata. Never
execute `database/schema.sql` before migration; it is a reference mirror.

**Destructive reset: every ledger entry, customer and review in this project's volume
is deleted.** Use only for disposable demo data; it is not a normal stop/rebuild:

```powershell
docker compose down --volumes
docker compose up --build -d --wait --wait-timeout 240
```

No existing user database was reset during implementation. Keep `.env` and `.secrets/`
when resetting. A second isolated project can use a different `-p` project name and
`WEB_PORT`, giving it a separate project-scoped volume and network.

## Demo initialization

The optional fixture creates 3 fictitious customers, 3 active/1 inactive accounts,
and 27 postings through normal ledger services. Values are fixed; timestamps are
the initialization time. Dense activity deliberately demonstrates anomaly signals.

`demo_seed_runs.portfolio-v1` is locked in the same transaction as all fixture data
and detection jobs. Failure rolls back the dataset and marker together. Completed
seeds are skipped on restart. A nonempty customer table with an incomplete marker
causes a safe skip; existing data is never repaired or overwritten. Keep demo mode
off for anything other than an isolated local demo.

## Smoke checks

```powershell
# Read-only web/assets/backend/model checks
python scripts/smoke.py

# Explicit synthetic writes on a disposable local data source
python scripts/smoke.py --allow-writes
docker compose --profile tools run --rm smoke
```

Writes create unique synthetic records, credit 12000.00, debit 125.50, reject an
overdraft, verify 11874.50 balance/two postings, poll detection, inspect explained
alerts, and save/read an analyst review. Records remain for inspection. The script
accepts a loopback HTTP origin or Docker's `frontend` hostname, exits nonzero on
failure, and never retries POSTs. A lost response can mean a committed posting.

Intentional ML outage, disposable stack only:

```powershell
docker compose stop analytics
python scripts/smoke.py --allow-writes --allow-rule-only
docker compose start analytics
```

Inside the Compose network, override the full command:

```powershell
docker compose --profile tools run --rm smoke --base-url http://frontend:8080 --allow-writes --allow-rule-only
```

Rules must still flag the large credit and leave valid balances committed. Restoring
ML affects new jobs; completed rule-only assessments are not silently re-scored.

## Build/runtime choices

- Java: Maven/JDK builder runs tests; only a JAR/JRE enter the runtime. Non-root UID,
  bounded heap, graceful shutdown and curl health support local operation.
- React: lockfile install, tests and Vite build precede Nginx-only serving. Relative
  `/api`, dynamic Docker DNS, correct Host forwarding, immutable hashed assets and
  revalidated HTML avoid common container/browser integration mistakes.
- Python: pinned runtime dependencies are separate from test tooling. Linux build
  stages train seed 42 and run pytest; only the trusted model and analytics source
  enter runtime, never a host pickle or training CSV. BLAS/OpenMP threads are bounded.
- Service `.dockerignore` files whitelist inputs. App runtimes are non-root, read-only,
  capability-restricted, with temporary scratch space. MySQL retains official image
  initialization permissions before running the database as its own user.
- Only frontend is published, on loopback. Version-line base tags are not immutable
  digests: pull, scan and review updates before any production release. Local HTTP,
  development DB transport settings and missing identity controls are not a public
  deployment design. No public deployment has been performed.

## Milestone 5 verification record

**Docker CLI/Desktop are absent. No image build, Compose startup, Linux container
health execution, Docker DNS or volume-mount runtime was verified.** Native/static
results below must not be represented as Docker end-to-end success.

| Check | Result |
| --- | --- |
| Java/H2 suite including demo safety | 52 passed |
| MySQL-targeted Java suite | 52 passed; demo rollback case intentionally uses isolated H2 |
| Python service | 20 passed |
| React unit/integration | 25 passed |
| Production frontend build with `/api` | Passed |
| Setup/smoke helper unit tests | 7 passed |
| Official Compose schema + wiring/security assertions | Passed, static only |
| Native MySQL config-tree secret and seed restart | Passed |
| Adapted native Nginx syntax + real full-stack smoke | Passed |
| Browser suite through production frontend/native proxy | 4 passed |
| Docker/Compose execution | Not run: unavailable |

Native Nginx retained routing/header behavior with paths, listen addresses and
upstreams adapted for local Windows processes. Verification confirmed 3 demo
customers and 9 postings per active account, unchanged on restart, with DB_PASSWORD
unset and config-tree authentication working. Smoke confirmed ML AVAILABLE, an
explained alert, correct balance/history after rejection and persisted review.
The 4 browser tests also verify real same-origin POSTs, API-error recovery, persisted
investigations and 390px mobile/keyboard behavior. Captures now default to ignored
test-results; published screenshots remain reviewed synthetic examples.

Optional schema checks without Docker:

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r scripts/requirements-checks.txt
New-Item -ItemType Directory -Force .tools
Invoke-WebRequest https://raw.githubusercontent.com/compose-spec/compose-spec/main/schema/compose-spec.json -OutFile .tools/compose-spec.json
.\.venv\Scripts\python.exe scripts/validate_compose.py --schema-path .tools/compose-spec.json
```

Complete actual Docker verification later using first-start and smoke commands.
References: [Compose readiness](https://docs.docker.com/compose/how-tos/startup-order/),
[Spring config trees](https://docs.spring.io/spring-boot/3.5/reference/features/external-config.html),
[Nginx proxy behavior](https://nginx.org/en/docs/http/ngx_http_proxy_module.html),
[Docker build practices](https://docs.docker.com/build/building/best-practices/).
