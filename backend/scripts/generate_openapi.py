import argparse
import json
import sys
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND_ROOT))

from app.main import app  # noqa: E402


def generate_openapi(output: Path) -> None:
    serialized_schema = (
        json.dumps(
            app.openapi(),
            ensure_ascii=True,
            indent=2,
            sort_keys=True,
        )
        + "\n"
    )
    output.write_text(serialized_schema, encoding="utf-8")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", type=Path, default=Path("openapi.json"))
    args = parser.parse_args()
    generate_openapi(args.output)


if __name__ == "__main__":
    main()
