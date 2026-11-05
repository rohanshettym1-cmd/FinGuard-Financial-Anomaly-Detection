import contextlib
from decimal import Decimal
import importlib.util
import io
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[2]


def load(name):
    spec = importlib.util.spec_from_file_location(name, ROOT / "scripts" / f"{name}.py")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


setup = load("setup_env")
smoke = load("smoke")


class SetupTests(unittest.TestCase):
    def test_setup_is_private_opt_in_and_does_not_rotate_existing_secrets(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / ".env.example").write_text((ROOT / ".env.example").read_text(), encoding="utf-8")
            output = io.StringIO()
            with contextlib.redirect_stdout(output):
                self.assertTrue(setup.prepare(root, demo=True))
            self.assertIn("DEMO_ENABLED=true", (root / ".env").read_text())
            first = (root / ".secrets/mysql-password").read_bytes()
            self.assertEqual(len(first.strip()), 64)
            self.assertFalse(setup.prepare(root))
            self.assertTrue(first == (root / ".secrets/mysql-password").read_bytes())
            self.assertFalse(first.decode().strip() in output.getvalue())

    def test_existing_empty_secret_fails_without_creating_env(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / ".env.example").write_text("DEMO_ENABLED=false\n")
            (root / ".secrets").mkdir()
            (root / ".secrets/mysql-password").touch()
            with self.assertRaises(ValueError):
                setup.prepare(root)
            self.assertFalse((root / ".env").exists())


class SmokeTests(unittest.TestCase):
    def test_refuses_nonlocal_or_credential_bearing_origins(self):
        for url in ["https://example.com", "http://user@localhost", "http://localhost/api", "file:///tmp/data"]:
            with self.subTest(url=url), self.assertRaises(ValueError):
                smoke.Client(url)

    def fake_api(self, ml="AVAILABLE", reject_balance=False):
        calls = []

        def call(client, path, body=None, expected=(200,)):
            calls.append((path, body))
            if path == "/healthz":
                return 200, "ok\n"
            if path == "/":
                return 200, '<html><title>FinGuard</title><div id="root"></div><script src="/assets/app.js"></script></html>'
            if path == "/assets/app.js":
                return 200, "console.log('synthetic test')"
            if path == "/api/health":
                return 200, {"status": "UP"}
            if path == "/analytics/health":
                return (200, {"status": "UP"}) if ml == "AVAILABLE" else (503, {"status": "MODEL_NOT_READY"})
            if path == "/api/customers":
                return 201, {"id": 1}
            if path == "/api/accounts":
                return 201, {"id": 2}
            if path == "/api/transactions":
                if body["amount"] == "99999.00":
                    return 400, {"code": "INSUFFICIENT_FUNDS"}
                return 201, {"id": 3}
            if path.endswith("/balance"):
                return 200, {"balance": Decimal("0" if reject_balance else "11874.50")}
            if path.startswith("/api/transactions?"):
                return 200, {"totalElements": 2}
            if path.endswith("/risk"):
                return 200, {"id": 4, "riskScore": 45, "mlStatus": ml, "triggeredRules": ["LARGE_AMOUNT: synthetic"]}
            if path == "/api/alerts/4":
                return 200, {"transactionId": 3}
            if path.startswith("/api/alerts?"):
                return 200, {"totalElements": 1}
            if path.endswith("/reviews"):
                return (201, {"id": 5}) if body else (200, [{"status": "FALSE_POSITIVE"}])
            raise AssertionError("Unexpected request: " + path)

        return call, calls

    def test_read_only_smoke_never_posts(self):
        handler, calls = self.fake_api()
        with patch.object(smoke.Client, "call", handler):
            report = smoke.run()
        self.assertEqual(report["mode"], "read-only")
        self.assertTrue(all(body is None for _, body in calls))

    def test_write_smoke_checks_balance_alert_explanation_and_review(self):
        handler, calls = self.fake_api()
        with patch.object(smoke.Client, "call", handler):
            report = smoke.run(allow_writes=True)
        self.assertEqual(report["ml_status"], "AVAILABLE")
        self.assertEqual(report["risk_score"], 45)
        self.assertEqual(sum(path == "/api/transactions" for path, _ in calls), 3)

    def test_wrong_balance_is_a_smoke_failure(self):
        handler, _ = self.fake_api(reject_balance=True)
        with patch.object(smoke.Client, "call", handler), self.assertRaises(smoke.SmokeFailure):
            smoke.run(allow_writes=True)

    def test_rule_only_requires_explicit_opt_in(self):
        handler, _ = self.fake_api(ml="UNAVAILABLE")
        with patch.object(smoke.Client, "call", handler):
            with self.assertRaises(smoke.SmokeFailure):
                smoke.run(allow_writes=True)
            self.assertEqual(smoke.run(allow_writes=True, allow_rule_only=True)["ml_status"], "UNAVAILABLE")


if __name__ == "__main__":
    unittest.main()
