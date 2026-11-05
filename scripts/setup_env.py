"""Prepare local Compose config and random password files. Never prints secret values."""
import argparse
import os
from pathlib import Path
import secrets


def prepare(root: Path, demo: bool = False) -> bool:
    env = root / ".env"
    if env.exists():
        return False  # Preserve an existing environment and its volume credentials.
    template = (root / ".env.example").read_text(encoding="utf-8")
    directory = root / ".secrets"
    directory.mkdir(mode=0o700, exist_ok=True)
    for name in ("mysql-password", "mysql-root-password"):
        path = directory / name
        try:
            descriptor = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
        except FileExistsError:
            if not path.read_text(encoding="utf-8").strip():
                raise ValueError(f"Existing secret file {name} is empty; fix it manually")
            continue
        with os.fdopen(descriptor, "w", encoding="utf-8", newline="\n") as stream:
            stream.write(secrets.token_hex(32) + "\n")
    if demo:
        template = template.replace("DEMO_ENABLED=false", "DEMO_ENABLED=true")
    # Exclusive creation avoids overwriting a concurrent/local setup.
    with env.open("x", encoding="utf-8", newline="\n") as stream:
        stream.write(template)
    return True


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--demo", action="store_true", help="Opt in to seeding an empty local database")
    args = parser.parse_args()
    root = Path(__file__).resolve().parents[1]
    if prepare(root, args.demo):
        print("Created ignored .env and .secrets password files. No secret values were printed.")
    else:
        print("Existing .env preserved. Edit it manually if configuration changes are needed; passwords were not rotated.")


if __name__ == "__main__":
    main()
