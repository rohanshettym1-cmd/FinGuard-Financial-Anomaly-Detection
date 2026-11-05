"""Versioned synthetic benchmark with legitimate credits, timezones and explicit injections.

Labels express generator intent, not real fraud. Large legitimate funding can still
trigger rules: this intentionally exposes their false-positive tradeoff in evaluation.
"""
import numpy as np
import pandas as pd

GENERATOR_VERSION = "mixed-context-v2"


def generate(seed=42, days=90, customers=30):
    rng = np.random.default_rng(seed)
    rows = []
    typical = rng.uniform(100, 700, customers)
    offsets = rng.choice([-8, -5, 0, 3, 5, 8, 10], customers)
    for day in range(days):
        for customer in range(customers):
            for occurrence in range(2):
                hour = int((rng.integers(8, 23) - offsets[customer]) % 24)
                time = pd.Timestamp("2026-01-01", tz="UTC") + pd.Timedelta(
                    days=day, hours=hour, minutes=int(rng.integers(0, 60)), seconds=int(rng.integers(0, 60)))
                debit = bool(rng.random() < 0.75)
                amount = round(float(rng.lognormal(np.log(typical[customer]), 0.35)), 2)
                if not debit:
                    amount = round(float(rng.lognormal(np.log(3500), 0.6)), 2)
                kind = str(rng.choice(["large", "burst", "duplicate", "deviation"])) if rng.random() < 0.045 else "normal"
                count = 1
                if kind in {"large", "deviation"}:
                    debit = True
                    amount = round(amount * float(rng.uniform(12, 35)), 2)
                elif kind == "burst":
                    count = 7
                elif kind == "duplicate":
                    count = 2
                # Benign short sessions are not all isolated points, nor all exact duplicates.
                elif rng.random() < 0.10:
                    count = int(rng.integers(2, 4))
                for offset in range(count):
                    value = amount if kind != "normal" else round(amount + offset * 0.37, 2)
                    rows.append({"transaction_id": len(rows) + 1, "customer_id": customer + 1,
                                 "account_id": customer + 1, "time": time + pd.Timedelta(seconds=offset * 8),
                                 "amount": value, "is_debit": debit, "label": int(kind != "normal"), "injection": kind})
    frame = pd.DataFrame(rows).sort_values(["time", "transaction_id"]).reset_index(drop=True)
    frame["transaction_id"] = np.arange(1, len(frame) + 1)
    return frame
