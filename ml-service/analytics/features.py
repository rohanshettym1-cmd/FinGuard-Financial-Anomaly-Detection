"""Causal feature construction: compute first, then update per-customer history."""
from collections import defaultdict, deque
import numpy as np
import pandas as pd

FEATURE_VERSION = "finguard-causal-v1"
FEATURE_NAMES = ["log_amount", "hour_sin", "hour_cos", "log_frequency", "log_deviation", "is_debit"]


def engineer(events: pd.DataFrame) -> pd.DataFrame:
    sums = defaultdict(float)
    counts = defaultdict(int)
    windows = defaultdict(deque)
    result = []
    for row in events.sort_values(["time", "transaction_id"]).itertuples(index=False):
        window = windows[row.account_id]
        while window and window[0][0] < row.time - pd.Timedelta(minutes=5):
            window.popleft()
        mean = sums[row.customer_id] / counts[row.customer_id] if counts[row.customer_id] else 0.0
        frequency = len(window) + 1
        duplicate = any(t >= row.time - pd.Timedelta(seconds=60) and a == row.amount and d == row.is_debit
                        for t, a, d in window)
        score = (45 if row.amount >= 10000 else 0) + (40 if frequency >= 5 else 0) + (45 if duplicate else 0)
        if row.is_debit and counts[row.customer_id] >= 5 and row.amount >= 1000 and row.amount >= 3 * mean:
            score += 40
        result.append({"amount": row.amount, "hour": row.time.hour, "frequency_5m": frequency,
                       "prior_debit_count": counts[row.customer_id], "baseline_mean": mean,
                       "is_debit": row.is_debit, "rule_score": min(100, score)})
        window.append((row.time, row.amount, row.is_debit))
        if row.is_debit:
            sums[row.customer_id] += row.amount
            counts[row.customer_id] += 1
    return pd.DataFrame(result)


def matrix(features: pd.DataFrame) -> pd.DataFrame:
    amount = features["amount"].astype(float)
    mean = features["baseline_mean"].astype(float)
    debit = features["is_debit"].astype(bool)
    eligible = debit & (features["prior_debit_count"] >= 5) & (mean > 0)
    ratio = pd.Series(1.0, index=features.index)
    ratio.loc[eligible] = amount.loc[eligible] / mean.loc[eligible]
    angle = features["hour"].astype(float) * (2 * np.pi / 24)
    return pd.DataFrame({"log_amount": np.log1p(amount), "hour_sin": np.sin(angle), "hour_cos": np.cos(angle),
                         "log_frequency": np.log1p(features["frequency_5m"].astype(float)),
                         "log_deviation": np.log1p(ratio), "is_debit": debit.astype(int)})[FEATURE_NAMES]
