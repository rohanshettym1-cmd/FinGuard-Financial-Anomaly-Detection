"""Validate against a supplied official Compose JSON schema; this does NOT run Docker."""
import argparse
import json
from pathlib import Path
import jsonschema
import yaml


def validate(root: Path, schema_path: Path):
    data = yaml.safe_load((root / "docker-compose.yml").read_text(encoding="utf-8"))
    schema = json.loads(schema_path.read_text(encoding="utf-8"))
    validator = jsonschema.validators.validator_for(schema)
    validator.check_schema(schema)
    validator(schema).validate(data)
    assert set(data["services"]) == {"mysql", "backend", "analytics", "frontend", "smoke"}
    for name, service in data["services"].items():
        if name != "frontend":
            assert "ports" not in service, f"Unexpected published port: {name}"
    assert data["services"]["frontend"]["ports"] == ["127.0.0.1:${WEB_PORT:-8088}:8080"]
    assert data["services"]["backend"]["depends_on"]["mysql"]["condition"] == "service_healthy"
    assert data["services"]["backend"]["environment"]["ML_BASE_URL"] == "http://analytics:8000"
    assert data["services"]["frontend"]["build"]["args"]["VITE_API_BASE_URL"] == "/api"
    assert data["services"]["mysql"]["volumes"] == ["mysql_data:/var/lib/mysql"]
    for name in ("backend", "analytics", "frontend"):
        service = data["services"][name]
        assert service["read_only"] and service["cap_drop"] == ["ALL"]
        assert "no-new-privileges:true" in service["security_opt"]
    assert "DB_PASSWORD" not in data["services"]["backend"]["environment"]
    for secret in data["secrets"].values():
        assert ":?" in secret["file"], "Secret-file config should fail closed when absent"
    print("PASS: official Compose schema, service wiring, secret-file references, persistent storage, loopback exposure and runtime restrictions.")
    print("NOT VERIFIED: image builds, Linux runtime behavior, Docker networking, health execution or Compose end-to-end startup.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--schema-path", type=Path, required=True)
    args = parser.parse_args()
    validate(Path(__file__).resolve().parents[1], args.schema_path)
