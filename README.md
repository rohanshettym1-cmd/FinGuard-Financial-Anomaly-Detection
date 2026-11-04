# FinGuard — Financial Transaction Anomaly Detection

FinGuard is a Java API with planned Python anomaly detection and React visualization.
**Milestone 2 implements MySQL persistence and customer, account, and transaction APIs.**
The Milestone 1 `/api/health` endpoint remains available. ML and React are not implemented yet.

## Monorepo

| Directory | Responsibility |
| --- | --- |
| `backend/` | Java 21, Spring Boot, Spring Data JPA, Flyway, MySQL |
| `database/` | Reviewed schema reference and synthetic sample data |
| `docs/` | Design notes and importable Postman collection |
| `frontend/` | Reserved for React, Vite, Recharts |
| `ml-service/` | Reserved for FastAPI, Pandas, Scikit-learn |

## Prerequisites and tests

Install JDK 21, set `JAVA_HOME`, and put Java on `PATH`. Git and internet access are
needed for the first build. The Maven wrapper downloads Maven automatically.
MySQL 8.4 is required to run the normal application. Tests use isolated in-memory
H2 in MySQL compatibility mode by default, requiring no database installation:

```powershell
cd backend
.\mvnw.cmd clean verify
```

On macOS/Linux use `./mvnw clean verify`. The build runs the original real-HTTP
health tests plus full-stack financial API tests using controllers, services, JPA,
and the real Flyway migration. Coverage includes exact decimals, validation,
insufficient funds, inactive accounts, pagination, failed-insert rollback,
rollback of already-flushed writes, concurrent credits, and competing debits.
H2 is a test-only dependency and is not included in the packaged application.

To run the same suite against MySQL, create a **separate empty disposable database**
such as `finguard_test` and a user restricted to that database. Tests insert synthetic
data and leave it there; never point them at an existing or production database.

```powershell
$env:TEST_DB_URL = 'jdbc:mysql://localhost:3306/finguard_test?connectionTimeZone=UTC'
$env:TEST_DB_USERNAME = 'your_test_user'
# Set TEST_DB_PASSWORD securely in your environment, then:
.\mvnw.cmd '-Dtest.database=mysql-test' clean verify
```

On macOS/Linux export the same variables and use `./mvnw -Dtest.database=mysql-test clean verify`.
The MySQL test profile requires `TEST_DB_*`; it never falls back to normal `DB_*`.

## MySQL setup

As a local MySQL administrator, create a database and user. Replace the credential
placeholder privately; do not save a real password in repository files or shell history.

```sql
CREATE DATABASE finguard CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'finguard_app'@'localhost' IDENTIFIED BY '<choose-a-local-password>';
GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, ALTER, INDEX, REFERENCES
    ON finguard.* TO 'finguard_app'@'localhost';
```

Startup runs Flyway's `V1__create_financial_schema.sql` and validates the JPA mappings.
Do not manually execute `database/schema.sql` before starting: it is a readable copy
of V1, and doing so would conflict with Flyway's history. For later schema changes,
add a new migration; do not modify an applied one. DDL privileges are for local
migration development; production can use a separate migration identity.

## Configure and start

`backend/.env.example` lists the supported variables. Spring Boot reads exported
environment variables; it does **not** automatically load `.env` files.

| Variable | Default | Purpose |
| --- | --- | --- |
| `SERVER_PORT` | `8080` | HTTP port |
| `DB_URL` | `jdbc:mysql://localhost:3306/finguard?connectionTimeZone=UTC` | Database connection |
| `DB_USERNAME` | required | Local application database user |
| `DB_PASSWORD` | required | Database password; never commit it |

From `backend/` in PowerShell:

```powershell
$env:DB_URL = 'jdbc:mysql://localhost:3306/finguard?connectionTimeZone=UTC'
$env:DB_USERNAME = 'finguard_app'
$localCredential = Read-Host 'MySQL password' -AsSecureString
$env:DB_PASSWORD = [System.Net.NetworkCredential]::new('', $localCredential).Password
.\mvnw.cmd spring-boot:run
```

Alternatively after building: `java -jar target/finguard-backend-0.0.1-SNAPSHOT.jar`.
For another HTTP port set `$env:SERVER_PORT = '8081'` first. Stop with Ctrl+C.
On macOS/Linux export `DB_URL`, `DB_USERNAME`, and `DB_PASSWORD` securely and run
`./mvnw spring-boot:run`. MySQL must be reachable for application startup. The health
endpoint remains a process health check, not a live database-readiness check:

```json
{"status":"UP","service":"finguard-backend"}
```

For optional synthetic fixtures, start the app once to migrate an empty database,
then run this from the repository root using the MySQL CLI (it prompts for a password):

```text
mysql -u finguard_app -p finguard
source database/sample-data.sql
```

Run the sample once on an otherwise empty local database. It creates two fictitious
customers, three accounts (one inactive), and a credit/debit history matching a
1000.00 balance on account 2001. It is not loaded automatically.

## REST endpoints

Base URL: `http://localhost:8080`. POST endpoints return 201 with a `Location` header.
GET endpoints return 200. Amounts are INR, exact decimals with up to two decimal
places. Accounts start at zero. Timestamps are UTC. CREDIT adds funds; DEBIT removes
funds. Status defaults to ACTIVE, or explicitly specify INACTIVE when creating.

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/health` | Existing process health |
| POST | `/api/customers` | Create customer (unique email, normalized lowercase) |
| GET | `/api/customers/{id}` | Get customer |
| GET | `/api/customers` | List customers by ID ascending |
| POST | `/api/accounts` | Create zero-balance account for a customer |
| GET | `/api/accounts/{id}` | Get account |
| GET | `/api/accounts?customerId=1` | List a customer's accounts |
| GET | `/api/accounts/{id}/balance` | Get current balance |
| POST | `/api/transactions` | Post credit or debit atomically |
| GET | `/api/transactions/{id}` | Get transaction, including balance after posting |
| GET | `/api/transactions?accountId=1&page=0&size=20` | List account history |

Transaction pages contain `content`, `page`, `size`, `totalElements`, and `totalPages`.
Pages are zero-based, size is 1–100, and order is descending transaction ID. Missing
parents return 404; an existing parent with no children returns an empty result.
IDs must be positive integers. Enums must be named strings, not numeric ordinals.
Invalid bodies, amounts, pagination, inactive-account postings, overdrafts, and
balance overflow return 400. Duplicate email/database conflicts and lock conflicts
return 409. Validation errors use `code`, `message`, and `fields`, for example:

```json
{"code":"INSUFFICIENT_FUNDS","message":"Account has insufficient funds","fields":{}}
```

## Postman examples

Import `docs/FinGuard.postman_collection.json` and run its requests in order. It
captures generated IDs as collection variables. The default `baseUrl` is localhost.
Alternatively create these POST requests with **Body → raw → JSON** and
`Content-Type: application/json`, substituting the IDs returned by earlier responses:

Create customer, `POST /api/customers`:

```json
{"name":"Demo Asha","email":"asha-api@example.test"}
```

Create account, `POST /api/accounts`:

```json
{"customerId":1,"status":"ACTIVE"}
```

Credit, `POST /api/transactions`:

```json
{"accountId":1,"type":"CREDIT","amount":1000.00,"description":"Synthetic deposit"}
```

Debit, `POST /api/transactions`:

```json
{"accountId":1,"type":"DEBIT","amount":125.50,"description":"Synthetic purchase"}
```

Then GET `/api/accounts/1/balance` (874.50) and GET
`/api/transactions?accountId=1&page=0&size=10`. A debit of 9999.00 should return
400 without changing the balance or adding a transaction.

## Key concepts and workflow

Controllers validate requests; DTOs define input/output contracts; services enforce
business rules; repositories load and save JPA entities. An account-row write lock
and `@Transactional` keep balance updates and ledger inserts atomic even with
concurrent requests. See `docs/README.md` for relationships, rollback, and migration
details. The current API is for local development: authentication and idempotent
posting are not implemented. Inspect history before retrying a POST with a lost response.

For each approved milestone: build → test → review diff/secrets → commit → push to
`main`. Never force-push, rewrite history, overwrite unrelated work, or commit real
credentials, `.env` files, dumps, or build outputs. Only reviewed migrations and
the named synthetic SQL fixtures are exceptions to the SQL ignore rule. Start the
next milestone only after approval.
