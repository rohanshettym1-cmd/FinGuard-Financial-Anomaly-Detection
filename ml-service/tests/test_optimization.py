import numpy as np
import pandas as pd
from analytics.representative_data import generate
from analytics.features import engineer, matrix
from analytics.selection import select
from analytics.train import train


def test_representative_generator_is_reproducible_and_covers_normal_contexts():
    data = generate(days=30, customers=20)
    pd.testing.assert_frame_equal(data, generate(days=30, customers=20))
    normal = data[data.label == 0]
    assert set(normal.time.dt.hour) == set(range(24))
    assert normal.loc[~normal.is_debit, 'amount'].median() > 2000
    assert data.time.is_monotonic_increasing
    features = engineer(data)
    assert ((features.frequency_5m >= 2) & (data.label == 0)).any()
    changed = data.copy()
    cut = len(data) // 2
    changed.loc[cut:, 'amount'] *= 100
    pd.testing.assert_frame_equal(features.iloc[:cut], engineer(changed).iloc[:cut])
    assert features.iloc[cut].baseline_mean == engineer(changed).iloc[cut].baseline_mean


def test_selection_uses_validation_only_and_deterministic_ties(monkeypatch):
    import analytics.selection as selection
    monkeypatch.setattr(selection, 'SAMPLE_SIZES', (256,))
    monkeypatch.setattr(selection, 'QUANTILES', (0.95, 0.995))
    data = generate(days=8, customers=5)
    features = engineer(data)
    x = matrix(features)
    boundary = len(data) // 2
    validation_end = int(len(data) * .75)
    def run(frame):
        return select(matrix(engineer(frame)).iloc[:boundary], matrix(engineer(frame)).iloc[boundary:validation_end],
                      frame.label.iloc[boundary:validation_end], features.rule_score.iloc[boundary:validation_end].to_numpy(), 42)
    first = run(data)
    changed = data.copy()
    changed.loc[validation_end:, 'label'] = 1 - changed.loc[validation_end:, 'label']
    changed.loc[validation_end:, 'amount'] *= 100
    second = run(changed)
    assert first[2:] == second[2:]
    np.testing.assert_array_equal(first[1], second[1])


def test_three_way_split_keeps_equal_timestamps_together(tmp_path):
    report = train(tmp_path, days=12, customers=5)
    data = pd.read_csv(tmp_path / 'synthetic.csv')
    times = pd.to_datetime(data.time, utc=True)
    train_end = pd.Timestamp(report['train_end_exclusive_utc'])
    test_start = pd.Timestamp(report['test_start_inclusive_utc'])
    assert (times < train_end).sum() == report['train_rows']
    assert ((times >= train_end) & (times < test_start)).sum() == report['validation_rows']
    assert (times >= test_start).sum() == report['test_rows']
    assert train_end < test_start
