import sys
from pathlib import Path
import unittest
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from audit_alerts import summarize


class AlertAuditTest(unittest.TestCase):
    def test_counts_rule_ml_overlap_and_normal_without_exporting_notes(self):
        data = [dict(ruleScore=45, riskScore=99, status='IN_REVIEW', triggeredRules=['LARGE_AMOUNT: x', 'ML_ISOLATION_FOREST: y']),
                dict(ruleScore=0, riskScore=0, status='NOT_REQUIRED', triggeredRules=['NO_SIGNALS: x'])]
        result = summarize(data)
        self.assertEqual(result['flagged'], 1)
        self.assertEqual(result['open_or_in_review'], 1)
        self.assertEqual(result['attribution']['rules=True,ml=True'], 1)
        self.assertNotIn('triggeredRules', result)
        self.assertEqual(summarize([])['assessments'], 0)
