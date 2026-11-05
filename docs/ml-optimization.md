# Milestone 6: anomaly investigation and validation

## What caused 35 alerts out of 36 postings?

The read-only audit of the local synthetic demo found 36 assessments, 35 flagged,
34 open/in-review, 35 successful ML responses and one rule-only fallback.
23 transactions triggered both rules and ML, 11 triggered ML alone, one rules alone,
and one neither. Signals overlapped: 16 frequency, seven large-amount, four customer
baseline and three duplicate signals. There are no ground-truth fraud labels for
these manually entered transactions, so 35 alerts cannot be called 35 false positives.

The seeder posts nine transactions per customer within seconds: funding, five
debits, a larger debit and two identical credits. Bursts, repeated credits and
funding above 10,000 therefore intentionally trigger the documented rules. Manual
postings extended the observed amount range to 9,000,000. These rules were retained.

The old model trained on 4,275 rows from a narrow generator: normal UTC hours 9–20,
mostly isolated transactions and credits drawn from spending-sized amounts. The
live demo's median UTC hour was 8, median five-minute frequency 4 (training median
1), and credit share 36.11% (training 14.95%). This is a distribution mismatch,
not evidence of an incorrect scaler. Both serving and training use the same six
log/cyclic features; no separate scaler is fitted. Customer history is emitted
before updating it, and Java excludes current/later IDs and future timestamps.

The hybrid combines signals using the maximum, effectively an OR at the alert
cutoff of 40. ML can add alerts but cannot cancel a rule. A normal ML result can
still have a high training percentile; the separate outlier flag controls whether
it contributes. Risk 100 is not 100% probability of fraud.

## Reproducible change

The versioned `mixed-context-v2` generator includes legitimate larger credits,
customers with different UTC offsets, benign short sessions, and labeled injected
large amounts, deviations, duplicates and bursts. It remains synthetic and is not
claimed to represent a bank's population. The original generator and original
[evaluation](evaluation.json) remain available unchanged.

Training uses chronological 60/20/20 partitions. Equal timestamps stay together.
Features use only earlier events; online history may advance during validation and
test, but weights, reference distribution and threshold remain frozen after selection.
No labels enter feature engineering or Isolation Forest fitting.

A predeclared grid checks max_samples 256/512 and training-score quantiles
0.90/0.95/0.975/0.99/0.995. Select highest validation hybrid F1, breaking ties by
lower validation false-positive rate, stricter quantile, then smaller sample size.
This is an explicit precision/recall tradeoff on synthetic validation labels,
not a target production alert percentage. Test labels never select the policy.
The selected model uses 256 samples and quantile 0.995, raw cutoff
0.6736557372444134. The model version includes data, selected policy, feature and
library provenance. Contamination is `auto` because the explicit validated cutoff,
rather than the estimator's default decision_function threshold, determines flags.

From `ml-service`, using the configured Python environment:

```powershell
python -m analytics.train --seed 42 --output artifacts
python -m analytics.compare --candidate artifacts --output ../docs/evaluation-m6.json
python -m pytest -q
```

`compare` rebuilds the frozen old model with its original generator, chronological
75% fit and contamination 0.05, then scores the SAME new held-out partition as the
candidate. Run comparisons after freezing selection; do not iterate on test results.
Generated CSV/model files remain ignored. The report records all ten validation
candidates, partition boundaries, hashes, versions and exact confusion matrices.

## Held-out results and honest limits

The new test has 1,326 rows: 123 labeled injections and 1,203 labeled benign events.

| Detector on the same new test | Precision | Recall | F1 | False-positive rate |
| --- | --- | --- | --- | --- |
| Frozen legacy hybrid | 20.12% | 83.74% | 32.44% | 34.00% |
| Candidate rules | 88.89% | 78.05% | 83.12% | 1.00% |
| Candidate Isolation Forest alone | 100.00% | 4.07% | 7.81% | 0.00% |
| Candidate hybrid | 88.89% | 78.05% | 83.12% | 1.00% |

The candidate hybrid has TP96/FP12/TN1191/FN27, versus legacy hybrid
TP103/FP409/TN794/FN20. False positives decreased, but seven additional injections
were missed. ML alone detected only five injections, all also caught by rules:
there is **no incremental held-out detection benefit** here. The validated policy
is conservative because ML false positives outweighed its added recall on the
validation set. This does not prove hybrid superiority or real fraud accuracy.
Larger representative datasets, multiple time windows, drift monitoring and real
adjudicated labels are needed before operational decisions. Synthetic large
legitimate credits expose false positives from the unchanged large-amount rule.

Scores remain empirical training ranks, not calibrated probabilities. Python now
explains raw cutoff comparison and input context, including insufficient-history
neutral deviation. Java stores that bounded explanation for new ML alerts. It is
context, not a claim about causal feature importance.

## Safe rollout and auditing

No migration or backfill is needed. Existing assessments, statuses and review
history are never rescored. Rules, balance posting, durable jobs, API request/response
contracts and ML timeout/fallback behavior remain compatible. New model artifacts
require a FastAPI restart. Restart Java to load the enriched explanation handling.
Keep a trusted previous artifact for rollback; never load uploaded pickle files.

The dashboard may still display 35/36 after upgrade: it correctly summarizes
historical evidence. New assessments record the new model version. Do not delete
records or bulk mark alerts false-positive merely to lower this percentage.

Read-only aggregate audit from the repository root:

```powershell
python scripts/audit_alerts.py --base-url http://127.0.0.1:8080
```

It exports counts only, not customer details or analyst notes. Use isolated
synthetic databases for write tests; never reset the manual demo to run regressions.

Scikit-learn explains that [contamination sets the training decision threshold](https://scikit-learn.org/stable/modules/generated/sklearn.ensemble.IsolationForest.html).
It does not guarantee the same alert rate on a shifted future population. See also
[novelty and outlier detection](https://scikit-learn.org/stable/modules/outlier_detection.html).

## Verification on Windows

- Java 21 Maven verify: 53 tests passed on H2 and 53 on the disposable MySQL
  configuration (the demo seeder testcase deliberately remains isolated on H2).
- Python: 23 tests passed, including reproducibility, causal features, split/selection
  isolation, request validation, serving parity and unavailable-model behavior.
- React: 25 tests passed; production build passed. The first lazy overview test now
  allows a bounded five-second cold import wait instead of the default one second.
- Local tooling: eight tests passed, including the read-only audit aggregation.
- Native isolated full-stack smoke checks passed: health, dashboard assets,
  posting/balance/overdraft, anomaly persistence and review history.
- Four Playwright browser tests passed through Nginx using a production build with
  `VITE_API_BASE_URL=/api` and `E2E_API_BASE_URL=http://127.0.0.1:8088/api`.
  The initial run used the default development URL and failed; correcting the test
  build configuration resolved it without changing production frontend behavior.
- The manual dashboard was restarted with the tested JAR and model
  `iforest-context-v2-seed42-35ac323026fc`. Private before/after fingerprints verified
  every existing customer, account/balance, transaction, assessment and review
  history unchanged; its 36 assessments and 35 flags remained intact.
- Docker is unavailable, so no Docker execution is claimed. Native MySQL/FastAPI/
  Spring/Nginx verification used separate test storage and ports from the manual demo.

The initial Java packaging attempt encountered the Windows running-JAR file lock;
rebuilding after stopping the identified backend resolved it. One upstream
FastAPI/Starlette test-client deprecation warning remains; all tests pass with the
existing pinned dependencies.
