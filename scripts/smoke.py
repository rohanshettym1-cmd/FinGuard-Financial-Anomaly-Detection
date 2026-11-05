"""Local full-stack smoke checks. Writes are explicit, synthetic, and never auto-retried."""
import argparse
from decimal import Decimal
from html.parser import HTMLParser
import json
import time
from urllib.error import HTTPError, URLError
from urllib.parse import urljoin, urlparse
from urllib.request import Request, urlopen
import uuid


class SmokeFailure(RuntimeError):
    pass


class ScriptAssets(HTMLParser):
    def __init__(self):
        super().__init__()
        self.sources = []

    def handle_starttag(self, tag, attrs):
        if tag == "script":
            source = dict(attrs).get("src")
            if source:
                self.sources.append(source)


class Client:
    def __init__(self, base_url: str):
        parsed = urlparse(base_url)
        if (parsed.scheme != "http" or parsed.hostname not in {"localhost", "127.0.0.1", "::1", "frontend"}
                or parsed.username or parsed.password or parsed.query or parsed.fragment or parsed.path not in {"", "/"}):
            raise ValueError("Smoke tests accept a local HTTP origin or Docker's frontend hostname only")
        self.base = base_url.rstrip("/")

    def call(self, path: str, body=None, expected=(200,)):
        data = json.dumps(body).encode() if body is not None else None
        request = Request(self.base + path, data=data, headers={"Content-Type": "application/json"} if data else {},
                          method="POST" if data else "GET")
        try:
            response = urlopen(request, timeout=25)
        except HTTPError as error:
            response = error
        except (URLError, TimeoutError) as error:
            message = "Request failed. A POST may already have committed; do not blindly retry it." if data else "Cannot reach local stack"
            raise SmokeFailure(message) from error
        with response:
            status = response.status
            content_type = response.headers.get("Content-Type", "")
            raw = response.read().decode("utf-8")
        if status not in expected:
            raise SmokeFailure(f"{request.method} {path} returned HTTP {status}; expected {expected}")
        try:
            result = json.loads(raw, parse_float=Decimal) if "json" in content_type else raw
        except (ValueError, json.JSONDecodeError) as error:
            raise SmokeFailure(f"Invalid response for {path}") from error
        return status, result


def run(base_url="http://127.0.0.1:8088", allow_writes=False, allow_rule_only=False, wait_seconds=60):
    client = Client(base_url)
    checks = []
    _, web_health = client.call("/healthz")
    if not isinstance(web_health, str) or web_health.strip() != "ok":
        raise SmokeFailure("Frontend web-server health check failed")
    checks.append("frontend web-server health UP")
    _, dashboard = client.call("/")
    if not isinstance(dashboard, str) or 'id="root"' not in dashboard or "FinGuard" not in dashboard:
        raise SmokeFailure("Dashboard HTML did not contain the FinGuard root")
    assets = ScriptAssets()
    assets.feed(dashboard)
    if not assets.sources:
        raise SmokeFailure("Dashboard has no JavaScript asset")
    for source in assets.sources:
        target = urlparse(urljoin(client.base + "/", source))
        if target.netloc != urlparse(client.base).netloc:
            raise SmokeFailure("Unexpected remote script asset")
        _, script = client.call(target.path + ("?" + target.query if target.query else ""))
        if not isinstance(script, str) or not script.strip() or script.lstrip().lower().startswith("<!doctype"):
            raise SmokeFailure("Dashboard script asset is missing or served as HTML")
    checks.append("dashboard HTML and JavaScript available")
    _, health = client.call("/api/health")
    if not isinstance(health, dict) or health.get("status") != "UP":
        raise SmokeFailure("Backend health is not UP")
    checks.append("Spring Boot health UP through reverse proxy")
    status, health = client.call("/analytics/health", expected=(200, 502, 503, 504) if allow_rule_only else (200,))
    model_ready = status == 200 and isinstance(health, dict) and health.get("status") == "UP"
    if not model_ready and not allow_rule_only:
        raise SmokeFailure("Analytics model is not ready")
    checks.append("FastAPI model health UP" if model_ready else "analytics unavailable; explicit rule-only mode")
    if not allow_writes:
        return {"mode": "read-only", "checks": checks}

    token = uuid.uuid4().hex
    _, customer = client.call("/api/customers", {"name": "Smoke Demo", "email": f"smoke-{token}@example.test"}, (201,))
    _, account = client.call("/api/accounts", {"customerId": customer["id"], "status": "ACTIVE"}, (201,))
    _, credit = client.call("/api/transactions", {"accountId": account["id"], "type": "CREDIT", "amount": "12000.00",
                                                "description": "Synthetic smoke credit"}, (201,))
    client.call("/api/transactions", {"accountId": account["id"], "type": "DEBIT", "amount": "125.50",
                                       "description": "Synthetic smoke debit"}, (201,))
    _, rejection = client.call("/api/transactions", {"accountId": account["id"], "type": "DEBIT", "amount": "99999.00"}, (400,))
    if rejection.get("code") != "INSUFFICIENT_FUNDS":
        raise SmokeFailure("Expected insufficient-funds rejection")
    _, balance = client.call(f"/api/accounts/{account['id']}/balance")
    if Decimal(str(balance["balance"])) != Decimal("11874.50"):
        raise SmokeFailure("Unexpected account balance after credit/debit/rejected posting")
    _, history = client.call(f"/api/transactions?accountId={account['id']}&page=0&size=20")
    if history.get("totalElements") != 2:
        raise SmokeFailure("Rejected posting changed ledger history")
    checks.append("synthetic credit/debit posted; overdraft rejected; exact balance/history verified")

    deadline = time.monotonic() + wait_seconds
    assessment = None
    while time.monotonic() < deadline:
        status, result = client.call(f"/api/transactions/{credit['id']}/risk", expected=(200, 202))
        if status == 200:
            assessment = result
            break
        time.sleep(0.5)  # Poll GET only, never resubmit a financial posting.
    if assessment is None:
        raise SmokeFailure("Detection did not finish before the polling deadline")
    if not 45 <= assessment["riskScore"] <= 100 or not any(reason.startswith("LARGE_AMOUNT:") for reason in assessment["triggeredRules"]):
        raise SmokeFailure("Missing large-amount explanation or bounded risk score")
    if not allow_rule_only and assessment.get("mlStatus") != "AVAILABLE":
        raise SmokeFailure("Expected live ML integration; use --allow-rule-only only for intentional outage checks")
    _, detail = client.call(f"/api/alerts/{assessment['id']}")
    if detail["transactionId"] != credit["id"]:
        raise SmokeFailure("Alert does not match posted transaction")
    _, feed = client.call("/api/alerts?page=0&size=100")
    if feed.get("totalElements", 0) < 1:
        raise SmokeFailure("Alert feed is empty")
    checks.append("anomaly assessed; LARGE_AMOUNT explained; persisted alert and feed available")
    client.call(f"/api/alerts/{assessment['id']}/reviews", {"status": "FALSE_POSITIVE", "analyst": "Smoke Analyst",
                "notes": "Synthetic smoke test; not a real financial incident."}, (201,))
    _, reviews = client.call(f"/api/alerts/{assessment['id']}/reviews")
    if not any(review["status"] == "FALSE_POSITIVE" for review in reviews):
        raise SmokeFailure("Analyst review was not persisted")
    checks.append("analyst status and audit history persisted")
    return {"mode": "synthetic-writes", "transaction_id": credit["id"], "alert_id": assessment["id"],
            "ml_status": assessment["mlStatus"], "risk_score": assessment["riskScore"], "checks": checks}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--base-url", default="http://127.0.0.1:8088")
    parser.add_argument("--allow-writes", action="store_true", help="Create synthetic records only on a disposable local database")
    parser.add_argument("--allow-rule-only", action="store_true", help="Permit unavailable ML for an intentional fallback test")
    args = parser.parse_args()
    try:
        print(json.dumps(run(args.base_url, args.allow_writes, args.allow_rule_only), indent=2))
    except (SmokeFailure, ValueError) as error:
        print(f"SMOKE FAILED: {error}")
        raise SystemExit(1)


if __name__ == "__main__":
    main()
