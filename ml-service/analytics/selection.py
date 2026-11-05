"""A predeclared validation search. No production alert-rate target or test labels."""
import numpy as np
from sklearn.ensemble import IsolationForest
from sklearn.metrics import confusion_matrix, f1_score

QUANTILES = (0.90, 0.95, 0.975, 0.99, 0.995)
SAMPLE_SIZES = (256, 512)


def select(train_x, validation_x, validation_labels, validation_rule_scores, seed):
    candidates = []
    best = None
    for samples in SAMPLE_SIZES:
        model = IsolationForest(n_estimators=200, max_samples=min(samples, len(train_x)),
                                contamination="auto", random_state=seed, n_jobs=1)
        model.fit(train_x)  # No labels in estimator fitting.
        reference = np.sort(-model.score_samples(train_x))
        scores = -model.score_samples(validation_x)
        for quantile in QUANTILES:
            threshold = float(np.quantile(reference, quantile))
            ml = scores > threshold
            hybrid = (validation_rule_scores >= 40) | ml
            tn, fp, fn, tp = confusion_matrix(validation_labels, hybrid, labels=[0, 1]).ravel()
            fpr = float(fp / (fp + tn)) if fp + tn else 0.0
            f1 = float(f1_score(validation_labels, hybrid, zero_division=0))
            row = {"max_samples": model.max_samples_, "training_quantile": quantile,
                   "threshold": threshold, "validation_hybrid_f1": f1, "validation_hybrid_fpr": fpr,
                   "tp": int(tp), "fp": int(fp), "tn": int(tn), "fn": int(fn)}
            candidates.append(row)
            # Deterministic ties favor lower FPR, then stricter threshold and smaller model sample.
            key = (f1, -fpr, quantile, -model.max_samples_)
            if best is None or key > best[0]:
                best = (key, model, reference, row)
    return best[1], best[2], best[3], candidates
