import argparse
import json
import sys
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND_ROOT))

from app.main import app  # noqa: E402


def stable_openapi_schema() -> dict:
    schema = app.openapi()
    for path_item in schema.get("paths", {}).values():
        if not isinstance(path_item, dict):
            continue
        for operation in path_item.values():
            if not isinstance(operation, dict):
                continue
            response = operation.get("responses", {}).get("422")
            if not isinstance(response, dict):
                continue
            if response.get("description") in {
                "Unprocessable Content",
                "Unprocessable Entity",
            }:
                response["description"] = "Unprocessable Entity"
    return schema


def generate_openapi(output: Path) -> None:
    serialized_schema = (
        json.dumps(
            stable_openapi_schema(),
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
