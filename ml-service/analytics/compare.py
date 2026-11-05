"""Rebuild the frozen Milestone 3 baseline and compare on the candidate's untouched test partition.
Run AFTER training: python -m analytics.compare --candidate artifacts --output ../docs/evaluation-m6.json
Never use these test metrics to select parameters.
"""
import argparse
import json
from pathlib import Path
import numpy as np
import pandas as pd
from sklearn.ensemble import IsolationForest
from analytics.data import generate as legacy_generate
from analytics.features import engineer, matrix, FEATURE_VERSION
from analytics.model import predict
from analytics.train import metrics
import hashlib


def compare(candidate, output):
    report = json.loads((candidate / 'evaluation.json').read_text())
    seed = report['seed']
    legacy = legacy_generate(seed=seed, days=90, customers=30)
    legacy_x = matrix(engineer(legacy))
    train_mask = legacy.time < legacy.iloc[int(len(legacy) * .75)].time
    model = IsolationForest(n_estimators=200, contamination=.05, random_state=seed, n_jobs=1).fit(legacy_x.loc[train_mask])
    data_hash = hashlib.sha256(legacy.to_csv(index=False).encode()).hexdigest()
    bundle = {'model': model, 'reference_scores': np.sort(-model.score_samples(legacy_x.loc[train_mask])),
              'threshold': float(-model.offset_)}
    data = pd.read_csv(candidate / 'synthetic.csv')
    data['time'] = pd.to_datetime(data.time, utc=True)
    features = engineer(data)
    mask = data.time >= pd.Timestamp(report['test_start_inclusive_utc'])
    _, _, flags = predict(bundle, matrix(features).loc[mask])
    labels = data.loc[mask, 'label']
    report['frozen_legacy_model_on_same_test'] = {
        'model_version': f'iforest-{FEATURE_VERSION}-seed{seed}-{data_hash[:12]}',
        'isolation_forest': metrics(labels, flags),
        'hybrid': metrics(labels, (features.loc[mask, 'rule_score'].to_numpy() >= 40) | flags)}
    output.write_text(json.dumps(report, indent=2) + '\n', encoding='utf-8')
    return report


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--candidate', type=Path, default=Path('artifacts'))
    parser.add_argument('--output', type=Path, default=Path('../docs/evaluation-m6.json'))
    args = parser.parse_args()
    compare(args.candidate, args.output)
