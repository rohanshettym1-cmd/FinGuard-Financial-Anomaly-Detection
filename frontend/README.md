# FinGuard monitoring dashboard

React + Vite with JavaScript, Tailwind CSS, Recharts and Lucide icons. All production
screens read the existing Spring Boot API. No fake transactions or demo totals are
bundled with the application. Screenshots and automated test fixtures use synthetic data.

## Start locally

Use Node 22.12+ (verified with Node 22.18) and npm. First start MySQL, train/start the
Python service, and start Spring Boot using the root README. Python can be unavailable:
the backend still posts transactions and runs rule-only anomaly detection.

```powershell
cd frontend
npm ci
Copy-Item .env.example .env.local
npm run dev
```

Open `http://127.0.0.1:5173`. On macOS/Linux use `cp .env.example .env.local`.
The default `VITE_API_BASE_URL=http://localhost:8080/api` includes the `/api` prefix.
Change `.env.local` for a different backend and restart Vite. `VITE_*` values are
public browser configuration, never a place for passwords, database URLs or keys.
The frontend never connects to MySQL or Python directly.

```powershell
npm test
npm run build
```

`dist/` is generated and ignored. Charts load in a separate chunk. `npm run preview`
serves the built frontend at `http://127.0.0.1:4173`; explicitly add that exact origin
to backend `FRONTEND_ALLOWED_ORIGINS` before using preview. This is local verification,
not deployment. No hosting or publication is configured.

## Screens and architecture

- Overview: exact monetary totals, counts, alert/investigation KPIs, risk distribution,
  recent transactions and priority alerts, with all-history/30-day/7-day scope.
- Customers: search, list, create and view details and associated accounts.
- Accounts: list/filter by customer, create active/inactive accounts, view live balance.
- Transactions: create credit/debit, search/filter account/type/date/minimum amount,
  paginate results, and view ledger details plus pending/completed risk assessments.
- Alerts: filter risk-prioritized alerts by investigation status and ML availability.
- Investigations: view preserved evidence and historical features; append a review,
  change status, and read the persisted audit trail.
- Analytics: daily credit/debit trends, transaction counts and risk distribution.

`src/api` owns HTTP, lossless JSON decoding, endpoint contracts and pagination.
`src/hooks` owns cancellable loading state. `src/lib/finance.js` owns precision-safe
money and aggregation. `src/components` contains reusable navigation, tables,
dialogs, fields, charts and status/risk badges. `src/pages` contains business screens.
Hash-based navigation supports direct local URLs such as `/#/alerts/1` without
requiring server rewrite rules.

The existing backend has no global transaction or dashboard-statistics endpoint.
The dashboard therefore loads customers, each customer's accounts, each account's
transaction pages, and all assessment pages (`includeNormal=true`). It follows
server pagination (100 records/page), bounds account/customer fetch concurrency to
four, and fails visibly rather than silently truncating a feed above 100,000 rows.
Filters and ten-row display pagination apply to the complete loaded snapshot, not
just one server page. Account balances are current values; overview period filters
apply to transaction posting times and their associated assessments. Open
investigations means OPEN or IN_REVIEW. Gross volume is credits plus debits, not net
cash flow. The sidebar badge counts outstanding investigations across all history.

Snapshots span multiple API requests and are not atomic or continuously streamed.
Use Refresh after detection finishes or another analyst changes data. Pending
assessments remain pending rather than being treated as low risk. A failed refresh
keeps the last successful snapshot with a visible stale-data warning. Very large
portfolios should use future server-side aggregate/reporting endpoints rather than
this teaching implementation's client-side aggregation.

`lossless-json` retains monetary JSON tokens and long IDs as strings. `decimal.js`
sums/formats money without binary floating-point rounding; requests send amounts
as decimal strings accepted by the existing BigDecimal DTOs. Recharts coordinates
are approximate visual values; cards, tables and balance details retain exact cents.
Transaction timestamps and date filtering use UTC. Risk scores are investigation
priorities, not calibrated fraud probabilities. Detection sources indicate whether
ML was available, not proof that an ML signal triggered; the stored explanations
show the actual signals.

## CORS and safety

Backend defaults allow only `http://localhost:5173` and `http://127.0.0.1:5173`, GET,
POST and OPTIONS, and the Content-Type header. Cookies/credentials are omitted.
Override `FRONTEND_ALLOWED_ORIGINS` with comma-separated exact origins (no trailing
slash, path or wildcard), then restart Spring Boot. CORS is not authentication;
this workspace retains the previous milestones' local-development security limits.
It does not authenticate analysts or provide idempotent transaction posting.

The API client never automatically retries a POST. A lost response may still mean
the ledger committed; inspect history/balance before submitting again. Server-side
validation and field errors appear in forms; balances remain backend-authoritative.
Native dialogs have explicit labels, keyboard focus containment and Escape/close
behavior. Tables are keyboard-scrollable on narrow screens. Loading, empty,
pending, disconnected and validation-error states are explicit.

## Browser integration tests (isolated data only)

These tests create synthetic customers/accounts, post credits/debits, and append
analyst reviews. Start the full stack against a disposable test database and point
the frontend at that backend. Never use a private/customer/production database.

```powershell
npx playwright install chromium
$env:E2E_BASE_URL = 'http://127.0.0.1:5173'
$env:E2E_API_BASE_URL = 'http://localhost:8080/api'
$env:E2E_ALLOW_SYNTHETIC_WRITES = 'true'
npm run test:e2e
```

The explicit write opt-in prevents accidental execution on a normal data source.
Seed the disposable database with `database/sample-data.sql` after Flyway migration;
for the pagination browser check, post enough synthetic transactions for at least
11 rows. The screenshot dataset used during development contained 300 synthetic
postings plus records created by the browser tests. The application has no special
demo mode, and none of this data is hardcoded into production screens.

Vitest/Testing Library covers API/validation errors, full-page loading, exact money,
long IDs, request concurrency, form submission, list pagination/filtering, review
history and failed review behavior. Playwright checks the real browser-to-Spring
API contract and CORS, credit/debit/overdraft behavior, persisted analyst review,
error/retry recovery, charts, 1440px desktop and 390px mobile layouts, keyboard focus,
and synthetic-only screenshots. Browser traces/results, dependencies and build
outputs remain ignored. See [screenshots](../docs/screenshots) and the root README.
