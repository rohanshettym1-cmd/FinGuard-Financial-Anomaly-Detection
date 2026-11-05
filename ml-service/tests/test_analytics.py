from pathlib import Path
import joblib
import numpy as np
import pandas as pd
import pytest
from fastapi.testclient import TestClient
from analytics.app import create_app
from analytics.data import generate
from analytics.features import engineer, matrix
from analytics.train import train, metrics


@pytest.fixture(scope="module")
def trained(tmp_path_factory):
    path = tmp_path_factory.mktemp("trained")
    report = train(path, seed=42, days=20, customers=10)
    return path, report


def payload(**changes):
    return {"amount": "150.00", "hour": 14, "frequency_5m": 1, "prior_debit_count": 10,
            "baseline_mean": "120.00", "is_debit": True, **changes}


def test_generator_is_reproducible_and_chronological():
    first = generate(days=10, customers=5)
    pd.testing.assert_frame_equal(first, generate(days=10, customers=5))
    assert first.time.is_monotonic_increasing
    assert set(first.label) == {0, 1}


def test_features_do_not_see_current_or_future_spending():
    data = generate(days=10, customers=5)
    original = engineer(data)
    cut = len(data) // 2
    changed = data.copy()
    changed.loc[cut:, "amount"] *= 100
    recomputed = engineer(changed)
    pd.testing.assert_frame_equal(original.iloc[:cut], recomputed.iloc[:cut])
    assert original.iloc[cut].baseline_mean == recomputed.iloc[cut].baseline_mean
    assert original.iloc[cut].prior_debit_count == recomputed.iloc[cut].prior_debit_count
    # Injected labels are evaluation metadata and cannot change any feature or rule.
    data["label"] = 1 - data["label"]
    pd.testing.assert_frame_equal(original, engineer(data))


def test_customer_history_is_separate_and_updated_after_current_event():
    data = pd.DataFrame([
        {"transaction_id": 1, "customer_id": 1, "account_id": 1, "time": pd.Timestamp("2026-01-01T10:00Z"), "amount": 100, "is_debit": True},
        {"transaction_id": 2, "customer_id": 2, "account_id": 2, "time": pd.Timestamp("2026-01-01T10:01Z"), "amount": 9000, "is_debit": True},
        {"transaction_id": 3, "customer_id": 1, "account_id": 3, "time": pd.Timestamp("2026-01-01T10:02Z"), "amount": 200, "is_debit": True},
    ])
    features = engineer(data)
    assert features.iloc[0].baseline_mean == 0
    assert features.iloc[1].prior_debit_count == 0
    assert features.iloc[2].baseline_mean == 100
    assert features.iloc[2].prior_debit_count == 1
    assert features.iloc[2].frequency_5m == 1  # Different account, same customer baseline.


def test_chronological_split_and_reproducible_model(trained, tmp_path):
    path, report = trained
    repeated = train(tmp_path, seed=42, days=20, customers=10)
    assert repeated == report
    data = pd.read_csv(path / "synthetic.csv")
    boundary = pd.Timestamp(report["train_end_exclusive_utc"])
    timestamps = pd.to_datetime(data.time, utc=True)
    assert timestamps.iloc[report["train_rows"] - 1] < boundary
    assert timestamps.iloc[report["train_rows"]] >= boundary
    bundle = joblib.load(path / "isolation_forest.joblib")
    assert len(bundle["reference_scores"]) == report["train_rows"]
    assert bundle["model"].n_features_in_ == 6
    for section in ("rules", "isolation_forest", "hybrid"):
        assert all(0 <= report[section][key] <= 1 for key in ("precision", "recall", "f1", "false_positive_rate"))


def test_metrics_and_empty_positive_predictions():
    result = metrics([0, 0, 1, 1], [0, 1, 0, 1])
    assert result["precision"] == result["recall"] == result["f1"] == result["false_positive_rate"] == 0.5
    assert metrics([0, 1], [0, 0])["precision"] == 0


def test_predict_and_health(trained):
    path, _ = trained
    with TestClient(create_app(path / "isolation_forest.joblib")) as client:
        assert client.get("/health").status_code == 200
        normal = client.post("/predict", json=payload())
        unusual = client.post("/predict", json=payload(amount="90000.00", hour=2, frequency_5m=8))
        assert normal.status_code == unusual.status_code == 200
        assert 0 <= normal.json()["risk_score"] <= 100
        assert unusual.json()["anomalous"] is True
        assert unusual.json()["risk_score"] >= normal.json()["risk_score"]
        assert "not a fraud probability" in unusual.json()["explanation"]
        assert "cutoff" in unusual.json()["explanation"]
        cold_start = client.post("/predict", json=payload(prior_debit_count=0, baseline_mean="0"))
        assert "spending-deviation feature is neutral" in cold_start.json()["explanation"]


@pytest.mark.parametrize("changes", [
    {"amount": "-1"}, {"amount": "0"}, {"amount": "1.001"}, {"amount": "NaN"},
    {"hour": 24}, {"hour": 1.5}, {"frequency_5m": 0}, {"baseline_mean": "-1"},
    {"prior_debit_count": -1}, {"is_debit": "yes"}, {"unknown": 123},
])
def test_validation(trained, changes):
    path, _ = trained
    with TestClient(create_app(path / "isolation_forest.joblib")) as client:
        assert client.post("/predict", json=payload(**changes)).status_code == 422


def test_missing_model_returns_503(tmp_path):
    with TestClient(create_app(tmp_path / "missing.joblib")) as client:
        assert client.get("/health").status_code == 503
        assert client.post("/predict", json=payload()).status_code == 503


def test_corrupt_model_returns_503(tmp_path):
    artifact = tmp_path / "corrupt.joblib"
    artifact.write_bytes(b"not-a-model")
    with TestClient(create_app(artifact)) as client:
        assert client.get("/health").status_code == 503


def test_offline_and_serving_features_match():
    data = generate(days=2, customers=2)
    features = engineer(data)
    row = features.iloc[2].to_dict()
    serving = matrix(pd.DataFrame([{key: value for key, value in row.items() if key != "rule_score"}]))
    np.testing.assert_allclose(serving.iloc[0], matrix(features).iloc[2])
