# FinGuard — Financial Transaction Anomaly Detection

FinGuard will identify unusual financial transactions using a Java API, a Python ML
service, and a React dashboard. **Milestone 1 is implemented:** backend foundation,
health API, integration tests, environment configuration, and Git hygiene.

## Monorepo structure

| Directory | Responsibility |
| --- | --- |
| `backend/` | Java 21 and Spring Boot HTTP API |
| `frontend/` | Planned React, Vite, Recharts dashboard |
| `ml-service/` | Planned FastAPI, Pandas, Scikit-learn service |
| `docs/` | Project documentation |

MySQL integration is planned; this milestone intentionally starts without a database.

## Prerequisites

- JDK 21, with `JAVA_HOME` pointing to its installation and Java on `PATH`.
- Internet access on the first build to download Maven and dependencies.
- Git. Maven is downloaded automatically by the checked-in Maven wrapper.

## Build and test

From the repository root in PowerShell:

```powershell
cd backend
.\mvnw.cmd clean verify
.\mvnw.cmd spring-boot:run
```

On macOS/Linux, use `./mvnw clean verify` and `./mvnw spring-boot:run`.
`verify` compiles Java, starts the application on a random port for HTTP integration
tests, and packages an executable JAR in `backend/target/`.

Alternatively, after building:

```powershell
java -jar target/finguard-backend-0.0.1-SNAPSHOT.jar
```

## Health API

```http
GET http://localhost:8080/api/health
```

Expected HTTP 200 JSON:

```json
{"status":"UP","service":"finguard-backend"}
```

This checks that the backend can serve HTTP requests. It does not yet check database
or ML readiness. Unknown routes return HTTP 404.

## Environment configuration

`backend/.env.example` documents supported settings. Spring Boot reads exported
environment variables; it does **not** automatically load `.env` files.

| Variable | Default | Purpose |
| --- | --- | --- |
| `SERVER_PORT` | `8080` | HTTP listening port |

For example, in PowerShell before starting the app:

```powershell
$env:SERVER_PORT = '8081'
.\mvnw.cmd spring-boot:run
```

On macOS/Linux: `SERVER_PORT=8081 ./mvnw spring-boot:run`.
The health URL then uses port 8081. Stop the server with Ctrl+C.

## Development concepts and workflow

`FinGuardApplication` starts Spring Boot and scans `com.finguard` for components.
`HealthController` maps an HTTP request to an immutable Java record, which Spring
serializes as JSON. `application.yml` supplies defaults that environment variables
can override. `HealthApiTest` verifies responses through a real embedded HTTP server.

For every milestone: build → test → review the diff and secret exclusions → commit
with a descriptive message → push to `main`. Begin the next milestone only after
approval. Never force-push or overwrite unrelated work.

Never commit credentials, real `.env` files, database dumps, private keys, or build
outputs. `.gitignore` excludes these common files; it does not replace manual review.
Keep sample configuration free of secrets. Git identity and authentication belong in
your local Git configuration, never in repository files.
