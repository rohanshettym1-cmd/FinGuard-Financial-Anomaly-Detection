"""Read-only aggregate audit; does not export customer details or review notes."""
import argparse
from collections import Counter
import json
from urllib.request import urlopen


def summarize(alerts):
    attribution = Counter()
    signals = Counter()
    for alert in alerts:
        rules = alert['ruleScore'] >= 40
        ml = any(reason.startswith('ML_ISOLATION_FOREST:') for reason in alert['triggeredRules'])
        attribution[f"rules={rules},ml={ml}"] += 1
        signals.update(reason.split(':', 1)[0] for reason in alert['triggeredRules'])
    return {'assessments': len(alerts), 'flagged': sum(a['riskScore'] >= 40 for a in alerts),
            'open_or_in_review': sum(a['status'] in ('OPEN', 'IN_REVIEW') for a in alerts),
            'attribution': dict(attribution), 'signals': dict(signals),
            'note': 'Historical assessments, not current-model predictions. No ground-truth fraud labels.'}


def audit(base_url):
    alerts = []
    page = 0
    while True:
        with urlopen(f'{base_url.rstrip("/")}/api/alerts?includeNormal=true&page={page}&size=100', timeout=20) as response:
            batch = json.load(response)
        alerts.extend(batch['content'])
        page += 1
        if page >= batch['totalPages']:
            return summarize(alerts)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--base-url', default='http://127.0.0.1:8080')
    print(json.dumps(audit(parser.parse_args().base_url), indent=2))
