# Project explanation and interview talking points

## A concise explanation

FinGuard is a full-stack financial transaction monitoring project. Java owns an exact,
consistent ledger. A durable queue separates posting from anomaly analysis. Explainable
Java rules identify large amounts, rapid activity, possible duplicates and spending
deviations; a Python Isolation Forest adds an unsupervised signal. React presents real
API data, detection evidence and analyst reviews. Compose configuration packages local
services, persistent MySQL, synthetic demo initialization and explicit smoke checks.

The key distinction is consistency versus analytics availability: valid postings commit
independently of model inference. Scores guide investigation, not automatic fraud
decisions or calibrated probabilities. No public/cloud deployment has been performed.

## Five-minute demonstration

1. Explain the local service map and browser's same-origin `/api` reverse proxy.
2. Show the real API-driven dashboard, period filters, ledger and pending assessments.
3. Create a synthetic account, credit 12000.00 and debit 125.50. Attempt an overdraft
   and show that balance/history remain unchanged.
4. Explain the stored assessment: rule points, historical-only baseline, ML availability
   and model version. A score of 99 is not a 99% fraud probability.
5. Add an analyst review, reload and show its audit trail. Explain rule-only behavior
   during a Python outage and why the ledger remains independent.
6. Present model results honestly: slightly better synthetic recall came with additional
   false positives and lower F1 than rules alone.

Use fictitious data only. Do not claim Docker execution was verified in the authoring
environment; the runbook separates actual native checks from unexecuted containers.

## Software development talking points

| Concept | Concrete implementation |
| --- | --- |
| ACID/concurrency | `@Transactional` posting and account-row pessimistic locking prevent competing debits from overspending a balance. |
| Decimal precision | BigDecimal/DECIMAL money, lossless JSON/long IDs and decimal browser totals preserve cents; model floats never become balances. |
| API layering | DTO validation, controllers, services, repositories and centralized safe errors separate concerns. |
| Durable background work | Jobs commit with ledger entries. Separate worker transactions save evidence and completion together; failures retry without editing balances. |
| SQL design | Foreign keys, uniqueness, amount/score constraints and versioned Flyway migrations preserve relationships and schema history. |
| Safe fixtures | A locked seed marker and full dataset commit together, skip existing data, and prevent duplicate initialization. |
| Frontend design | Reusable controls, cancellable loading, precise totals, keyboard dialogs, clear errors and persisted review history. |
| Containers | Multi-stage builds separate toolchains/tests from runtimes; private service names are for containers, not browser URLs. |
| Secrets/testing | File-mounted local credentials, no public DB port, explicit test-write opt-ins, and honest static/native/Docker verification boundaries. |

A useful concurrency example is an account with 100.00 receiving two simultaneous
80.00 debits: only one may succeed. The repository tests that invariant. A model
outage is a different failure mode and must not roll back the successful posting.

## Data analytics talking points

- Compute each row's features before updating historical state. Exclude current/future
  spending and other customers; use prior customer debits across accounts.
- Use amount, cyclic UTC hour, account frequency, debit indicator and historical
  spending deviation. Sine/cosine keeps midnight close to 23:00.
- Fit weights, threshold and rank reference on training dates only. No shuffled split,
  test-label tuning or label-informed feature generation.
- Isolation Forest ranks unusual combinations. An outlier is not necessarily fraud,
  and a training-score percentile is not a probability.
- Explain TP/FP/TN/FN, precision, recall, F1 and false-positive rate. More alerts can
  increase analyst workload without improving overall usefulness.
- Hybrid test counts were TP 100, FP 9, TN 1,271, FN 46 on 1,426 synthetic held-out
  events. Its 91.74% precision and 68.49% recall describe this generator only.
- Injection labels are not adjudicated real fraud. The clean benign generator makes
  rules appear unusually precise; disclose that limitation rather than overselling it.

## Honest boundaries

The project is not a certified banking system. Future work includes authentication,
ownership/analyst-role enforcement, idempotent posting, transfers/reversals, production
TLS/backups and monitoring. Scale requires incremental historical features and
server-side dashboard reporting. Real ML assessment requires representative labeled
data, temporal validation, drift checks and analyst-workload evaluation. Docker is
configured but could not be executed here; no production release is claimed.

Useful artifacts to discuss: transaction service, rule engine, worker, V1–V3 SQL,
Python features/training, frontend API client, tests, [evaluation](evaluation.json),
and [local stack runbook](local-stack.md).
