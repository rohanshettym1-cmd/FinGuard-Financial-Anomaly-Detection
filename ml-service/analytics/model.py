"""Isolation Forest ranks unusual combinations; its ranks are NOT fraud probabilities."""
import numpy as np


def predict(bundle, features):
    raw = -bundle["model"].score_samples(features)
    reference = bundle["reference_scores"]
    # Empirical rank among training scores, not a calibrated likelihood of fraud.
    ranks = np.rint(100 * np.searchsorted(reference, raw, side="right") / len(reference)).clip(0, 100).astype(int)
    anomalous = raw > bundle["threshold"]
    return raw, ranks, anomalous
