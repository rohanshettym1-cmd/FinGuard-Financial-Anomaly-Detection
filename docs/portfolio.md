# FinGuard: project explanation and interview talking points

FinGuard is a local, AI-assisted educational portfolio project combining financial
ledger consistency, anomaly analysis and an analyst dashboard. Use the current
Milestone 6 results below; the [original Milestone 3 report](evaluation.json) is a
historical experiment on a different dataset. No public/cloud deployment is claimed.

## Two-minute project explanation

FinGuard is a financial transaction monitoring project that combines a consistent
transaction ledger with explainable anomaly detection. It manages customers,
accounts, credits and debits, while a React dashboard presents balances, transaction
history, risk assessments and analyst investigations.

The backend uses Java 21, Spring Boot and MySQL. BigDecimal and SQL decimal columns
preserve monetary precision. Posting locks the account row and commits the balance
change, ledger entry and pending detection job together. This prevents competing
updates from overspending the account and keeps the ledger consistent.

Detection runs separately so that an unavailable Python service cannot undo a valid
posting. Java checks large amounts, rapid activity, possible duplicates and deviations
from earlier customer spending. FastAPI adds an Isolation Forest signal using amount,
UTC time, frequency and historical spending features. Java stores the combined
assessment, reasons and model version, and analysts can append investigation reviews.

An important investigation started when 35 of 36 demo transactions were flagged.
The causes included deliberately dense synthetic activity and a narrow original
training distribution. Milestone 6 introduced broader synthetic normal contexts
and chronological training, validation and test partitions.

On the same new synthetic test set, the current hybrid achieved 88.89% precision
and 78.05% recall. Precision improved versus the frozen legacy hybrid, but recall
decreased, and ML added no detections beyond rules on that test. The project therefore
illustrates transaction safety, service integration and honest evaluation of tradeoffs;
it is not evidence of real-world fraud prevention or a production banking deployment.

## Architecture and implementation evidence

React/Vite calls the Spring REST API. In native development this uses a configurable
API URL; the configured Compose frontend uses Nginx and same-origin `/api`. Java
accesses MySQL through JPA. A scheduled Java worker polls durable database jobs,
evaluates rules and calls FastAPI. FastAPI returns predictions to Java; only Java
persists assessments and completes jobs. Review APIs append audit rows in MySQL.
There is no Kafka/RabbitMQ broker, browser-to-database connection or Python database writer.

| Area | Actual implementation and code to explain |
| --- | --- |
| API layering | Controllers, validated DTOs, services, repositories and centralized errors in `backend/src/main/java/com/finguard/` |
| ACID and concurrency | [TransactionService](../backend/src/main/java/com/finguard/transaction/TransactionService.java) and [account locking](../backend/src/main/java/com/finguard/account/AccountRepository.java) |
| Exact money | Java BigDecimal, SQL DECIMAL(19,2), lossless frontend JSON parsing and decimal browser totals; ML floats never become balances |
| Durable detection | [DetectionWorker](../backend/src/main/java/com/finguard/anomaly/DetectionWorker.java) polls jobs; [DetectionService](../backend/src/main/java/com/finguard/anomaly/DetectionService.java) saves evidence and completion in a separate transaction |
| Rules and baselines | [RuleEngine](../backend/src/main/java/com/finguard/anomaly/RuleEngine.java) excludes current/later IDs, future timestamps and other customers |
| ML boundary | [MlClient](../backend/src/main/java/com/finguard/anomaly/MlClient.java) bounds requests and validates responses; outages retain rules |
| Database evolution | [Flyway V1–V3](../backend/src/main/resources/db/migration) adds financial schema, detection/reviews and a locked demo-seed marker |
| Analytics | [Causal features](../ml-service/analytics/features.py), [training](../ml-service/analytics/train.py), [validation selection](../ml-service/analytics/selection.py) and [FastAPI](../ml-service/analytics/app.py) |
| Dashboard | React, Vite, JavaScript, Tailwind CSS, Recharts and Lucide; [API client](../frontend/src/api/client.js) preserves money and IDs |
| Local packaging | Multi-stage Dockerfiles, Nginx and Compose are configured; native verification does not establish Docker execution |
| Verification | JUnit/Spring tests, pytest, Vitest/Testing Library, Playwright and local smoke tools |

A useful concurrency example is an account with 100.00 receiving two simultaneous
80.00 debits: only one may succeed. The suite tests this invariant. A model outage
is a separate failure mode and must not roll back the successful posting.

## Current anomaly pipeline

1. Compute each transaction's features before updating historical state. The spending
   mean uses earlier customer debits across accounts; frequency is account-specific.
2. Transform amount and frequency with log1p, represent UTC hour with sine/cosine,
   include debit/credit, and transform spending deviation. Credits and insufficient
   debit history use neutral deviation rather than an invented customer baseline.
3. Fit a 200-tree Isolation Forest without labels. Unusual combinations tend to be
   isolated using fewer random splits across the forest.
4. Use chronological 60/20/20 partitions: 3,975 training, 1,325 validation and 1,326
   test events from 6,626 synthetic events, seed 42. Equal timestamps stay together.
5. Compare max_samples 256/512 and training-score quantiles
   0.90/0.95/0.975/0.99/0.995 using validation hybrid F1. Ties favor lower false-positive
   rate, stricter quantile, then smaller samples. The selected sample size is 256,
   quantile 0.995, raw cutoff 0.6736557372444134.
6. Keep fitted weights, training-rank reference and selected cutoff frozen for test.
   Earlier validation/test events may update later history as in online inference;
   their labels never enter features. Test labels never select model parameters.
7. Combine signals: `risk = max(ruleScore, max(40, mlScore) if anomalous else 0)`.
   Rules sum and cap at 100; risk >=40 opens an alert. ML cannot cancel a rule.

Isolation Forest fitting is unsupervised, but the complete threshold-selection
procedure uses labeled synthetic validation data. `contamination="auto"` does not
supply the final decision cutoff: the explicit validated cutoff does. Percentiles
are training-score ranks, not calibrated fraud probabilities. Raw cutoff comparisons
and input context are explanations, not causal feature attribution.

| Rule | Trigger | Points |
| --- | --- | --- |
| Large amount | Credit/debit >=10,000 INR | 45 |
| Rapid frequency | >=5 same-account postings in the inclusive five-minute window, including current | 40 |
| Possible duplicate | Earlier same-account, type and amount within the inclusive 60-second window | 45 |
| Customer baseline | Debit >=1,000 INR and >=3x the mean of at least five prior customer debits | 40 |

## Milestone 6 results and limitations

The held-out test has 123 labeled injections and 1,203 labeled benign events.
All comparison rows below use the same new test partition.

| Detector | Precision | Recall | F1 | False-positive rate |
| --- | --- | --- | --- | --- |
| Frozen legacy hybrid | 20.12% | 83.74% | 32.44% | 34.00% |
| Current rules | 88.89% | 78.05% | 83.12% | 1.00% |
| Current Isolation Forest alone | 100.00% | 4.07% | 7.81% | 0.00% |
| Current hybrid | 88.89% | 78.05% | 83.12% | 1.00% |

Current hybrid counts are TP 96 / FP 12 / TN 1,191 / FN 27, versus legacy hybrid
TP 103 / FP 409 / TN 794 / FN 20. False positives decreased, but seven additional
injections were missed. ML alone found five positives, all also caught by rules:
**there was no incremental held-out detection benefit from ML**.

Precision is TP/(TP+FP), recall is TP/(TP+FN), F1 balances precision and recall, and
false-positive rate is FP/(FP+TN). A dashboard's fraction of transactions flagged
is a different quantity; without ground-truth labels it cannot establish these metrics.

The 35/36 historical demo alert count included expected burst/duplicate/large-amount
signals and ML sensitivity to a narrow original normal distribution. It was not
proof of 35 false positives. Changing the model affects new jobs and preserves old
assessments, review status and evidence; it does not reset dashboard history.

Synthetic injection labels are not independently confirmed fraud. Fixed generator
patterns, one seed/time holdout and unknown real-world drift limit generalization.
Do not claim real fraud accuracy, calibrated probabilities or hybrid superiority.
See [exact provenance and candidate search](evaluation-m6.json),
[reproducible investigation](ml-optimization.md) and
[the frozen legacy comparison implementation](../ml-service/analytics/compare.py).

## Five-minute demonstration

Use fictitious data and a fresh ACTIVE account. Do not reset a saved database or
change existing historical investigations. IDs vary between environments.

1. Show the local service map, customer/account forms and API-backed dashboard.
2. Post credit 5,000.00, then debit 125.50. Open each transaction's completed detection
   assessment; refresh if pending. Explain why normal activity need not create alerts.
3. Post two credit transactions of 50,000.00 within 60 seconds. Explain large-amount
   points on both and duplicate points on the second. History/time can alter ML results.
4. Verify `5,000 - 125.50 + 50,000 + 50,000 = 104,874.50`. Attempt a 200,000.00 debit
   and show insufficient-funds rejection with balance and ledger unchanged.
5. Inspect the new alert's reasons, rule/ML scores, model version and review history.
   If demonstrating a review write, use only a newly created synthetic alert; reload
   to show persistence. Existing historical reviews should remain untouched.
6. Show the evaluation report and explain both reduced false positives and lower
   recall versus the legacy hybrid. Explain rule-only fallback without stopping a
   shared running service; use the isolated outage procedure if a live test is needed.

Observed native manual verification on **2026-11-06** produced risks **0, 0, 45, 90**
for that sequence. An overdraft returned HTTP 400 / INSUFFICIENT_FUNDS. Before/after
fingerprints verified all 36 prior assessments and both existing review entries
unchanged. These are recorded synthetic observations, not guaranteed future scores.

## Resume wording and contribution boundaries

Development used AI-assisted implementation and testing. Repository contents prove
capabilities, not that a particular person independently authored every component.
Describe your actual role, disclose assistance when asked, and claim only work you
can explain and demonstrate. Do not invent individual authorship, team size, users,
throughput, latency, deployment or real financial outcomes.

Possible project bullets, subject to that ownership check:

- Developed a financial monitoring application using Java 21, Spring Boot, Spring
  Data JPA and MySQL, with validated REST APIs, exact monetary calculations,
  transactional balance updates and pessimistic locking.
- Integrated FastAPI, Pandas and Scikit-learn Isolation Forest with explainable
  anomaly rules; evaluated the hybrid using chronological validation, obtaining
  88.89% precision and 78.05% recall on 1,326 labeled synthetic test transactions.
- Built a responsive React/Vite/Recharts dashboard for transaction monitoring and
  analyst investigations, with persisted review history and verification using
  JUnit, pytest, Vitest and Playwright.

Before using these bullets, independently trace a posting from DTO to SQL, explain
its rollback/locking behavior, reproduce the evaluation, distinguish rank from final
risk, trace an API response into a chart, and demonstrate a small change in an isolated
workspace. Project ownership should include understanding, not just a repository link.

## Common interview questions

| Question | Beginner-friendly answer |
| --- | --- |
| Why BigDecimal? | Decimal money must retain cents exactly; model floating-point values never update balances. |
| What does @Transactional do? | Balance, ledger and job writes commit together or roll back together. |
| How are concurrent debits protected? | A pessimistic write lock serializes updates to the same account before checking funds. |
| Why DTOs and service layers? | DTOs validate the API boundary; services hold business behavior; repositories handle persistence. |
| Why Flyway? | Ordered migrations evolve the schema without editing already applied migration history. |
| Why a background worker? | Posting is independent of model availability, while database jobs retain unfinished detection work. |
| Is this Kafka? | No. A scheduled worker polls a durable MySQL job table. |
| What if Python fails? | Bounded requests fall back to rules and record ML unavailability without undoing valid postings. |
| Is the model supervised? | Estimator fitting is unsupervised; labeled synthetic validation selects the final threshold policy. |
| How is leakage prevented? | Earlier events supply history; the current event is added afterward; test labels never tune thresholds. |
| Does risk 99 mean 99% fraud probability? | No. ML rank and combined risk prioritize investigation and are not calibrated probabilities. |
| Why not random train/test splits? | Chronological splits better represent scoring future events and keep later history out of earlier features. |
| Did hybrid outperform rules? | Not on the current held-out test: their predictions matched, so ML added no detections. |
| What caused excessive alerts? | Both deliberately suspicious demo patterns and a narrow original ML normal distribution. |
| Is it production-ready or deployed? | No. Native behavior is verified; Docker execution, public deployment and production security are not established. |

## Recorded verification and honest boundaries

Milestone 6 checks recorded on **2026-11-05**: 53 Java tests passed in each H2/MySQL
configuration, 23 Python tests, 25 frontend tests, eight tooling tests and four browser
tests; native builds and full-stack smoke checks passed. These are local recorded
results, not a new run for this documentation update. The Java runs use the same
suite; the seed testcase remains isolated on H2. See [verification details](ml-optimization.md#verification-on-windows).

The project has no implemented authentication, ownership/analyst-role enforcement,
posting idempotency keys, transfers or reversal workflow. Production TLS, backups,
monitoring and deployment are future work. CORS is not authentication. Scale would
require bounded/incremental history features and server-side dashboard reporting.

Dockerfiles and Compose are configured, with static checks and native substitutes;
Docker was unavailable, so image builds and Compose execution are not verified.
No public deployment, cloud costs, CI-success badge, certified banking behavior or
real financial fraud performance is claimed. See the [local stack runbook](local-stack.md).
