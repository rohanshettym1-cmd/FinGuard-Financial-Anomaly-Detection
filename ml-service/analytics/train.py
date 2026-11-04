"""Run from ml-service: python -m analytics.train --output artifacts --seed 42."""
import argparse
import hashlib
import json
from pathlib import Path
import joblib
import numpy as np
import sklearn
from sklearn.ensemble import IsolationForest
from sklearn.metrics import confusion_matrix, precision_score, recall_score, f1_score
from analytics.data import generate
from analytics.features import engineer, matrix, FEATURE_VERSION, FEATURE_NAMES
from analytics.model import predict


def metrics(labels, predicted):
    tn, fp, fn, tp = confusion_matrix(labels, predicted, labels=[0, 1]).ravel()
    return {"precision": float(precision_score(labels, predicted, zero_division=0)),
            "recall": float(recall_score(labels, predicted, zero_division=0)),
            "f1": float(f1_score(labels, predicted, zero_division=0)),
            "false_positive_rate": float(fp / (fp + tn)) if fp + tn else 0.0,
            "tp": int(tp), "fp": int(fp), "tn": int(tn), "fn": int(fn)}


def train(output: Path, seed: int = 42, days: int = 90, customers: int = 30):
    events = generate(seed, days, customers)
    features = engineer(events)
    x = matrix(features)
    boundary = events.iloc[int(len(events) * 0.75)]["time"]
    train_mask = events["time"] < boundary
    # No shuffled split, test-label threshold tuning, global fitting, or current/future spending in baselines.
    estimator = IsolationForest(n_estimators=200, contamination=0.05, random_state=seed, n_jobs=1)
    estimator.fit(x.loc[train_mask])  # Labels never enter fit().
    reference = np.sort(-estimator.score_samples(x.loc[train_mask]))
    threshold = float(-estimator.offset_)  # Chosen from training contamination, never from test labels.
    data_hash = hashlib.sha256(events.to_csv(index=False).encode()).hexdigest()
    version = f"iforest-{FEATURE_VERSION}-seed{seed}-{data_hash[:12]}"
    bundle = {"model": estimator, "reference_scores": reference, "threshold": threshold,
              "feature_version": FEATURE_VERSION, "feature_names": FEATURE_NAMES,
              "model_version": version, "sklearn_version": sklearn.__version__}
    _, ranks, predicted = predict(bundle, x.loc[~train_mask])
    labels = events.loc[~train_mask, "label"]
    rule_scores = features.loc[~train_mask, "rule_score"].to_numpy()
    hybrid_scores = np.maximum(rule_scores, np.where(predicted, np.maximum(40, ranks), 0))
    report = {"seed": seed, "rows": len(events), "train_rows": int(train_mask.sum()),
              "test_rows": int((~train_mask).sum()), "train_end_exclusive_utc": str(boundary),
              "test_positive_labels": int(labels.sum()), "data_sha256": data_hash,
              "model_version": version, "sklearn_version": sklearn.__version__,
              "contamination": 0.05, "threshold_source": "training only; no test-label tuning",
              "isolation_forest": metrics(labels, predicted), "rules": metrics(labels, rule_scores >= 40),
              "hybrid": metrics(labels, hybrid_scores >= 40),
              "limitations": "Synthetic injection labels are not real fraud. Fixed generator patterns and prevalence do not represent production. Baselines update causally from earlier test events as online history; model weights and threshold remain frozen. Scores are priorities, not fraud probabilities."}
    output.mkdir(parents=True, exist_ok=True)
    events.to_csv(output / "synthetic.csv", index=False)
    joblib.dump(bundle, output / "isolation_forest.joblib")
    (output / "evaluation.json").write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    return report


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", type=Path, default=Path("artifacts"))
    parser.add_argument("--seed", type=int, default=42)
    args = parser.parse_args()
    print(json.dumps(train(args.output, args.seed), indent=2))
