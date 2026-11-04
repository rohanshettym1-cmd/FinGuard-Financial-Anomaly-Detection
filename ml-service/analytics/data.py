"""Generate labeled synthetic events. Labels are injection provenance, not real fraud."""
import numpy as np
import pandas as pd


def generate(seed: int = 42, days: int = 90, customers: int = 30) -> pd.DataFrame:
    rng = np.random.default_rng(seed)
    rows = []
    typical = rng.uniform(100, 700, customers)
    for day in range(days):
        for customer in range(customers):
            for occurrence in range(2):
                time = pd.Timestamp("2026-01-01", tz="UTC") + pd.Timedelta(
                    days=day, hours=int(rng.integers(9, 21)), minutes=int(rng.integers(0, 60)),
                    seconds=int(rng.integers(0, 60)))
                amount = round(float(rng.lognormal(np.log(typical[customer]), 0.35)), 2)
                debit = bool(rng.random() < 0.85)
                kind = str(rng.choice(["large", "burst", "duplicate", "night"])) if rng.random() < 0.045 else "normal"
                count = 6 if kind == "burst" else 2 if kind == "duplicate" else 1
                if kind == "large":
                    amount = round(amount * float(rng.uniform(20, 40)), 2)
                if kind == "night":
                    time = time.normalize() + pd.Timedelta(hours=int(rng.integers(1, 5)))
                for offset in range(count):
                    rows.append({"transaction_id": len(rows) + 1, "customer_id": customer + 1,
                                 "account_id": customer + 1, "time": time + pd.Timedelta(seconds=offset * 8),
                                 "amount": amount, "is_debit": debit, "label": int(kind != "normal"),
                                 "injection": kind})
    frame = pd.DataFrame(rows).sort_values(["time", "transaction_id"]).reset_index(drop=True)
    # IDs now follow posting order, matching the Java history cutoff.
    frame["transaction_id"] = np.arange(1, len(frame) + 1)
    return frame
