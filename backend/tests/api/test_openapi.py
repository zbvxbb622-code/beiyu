import json
import os
import subprocess
import sys
from pathlib import Path
from typing import Any

from app.main import create_app

BACKEND_ROOT = Path(__file__).resolve().parents[2]
OPENAPI_PATH = BACKEND_ROOT / "openapi.json"


def assert_object_schema(
    schemas: dict[str, Any],
    name: str,
    properties: set[str],
) -> None:
    schema = schemas[name]
    assert schema["type"] == "object"
    assert set(schema["properties"]) == properties
    assert set(schema["required"]) == properties


def test_openapi_has_exact_stage_zero_paths_and_explicit_success_schemas() -> None:
    schema = create_app().openapi()

    assert set(schema["paths"]) == {
        "/api/v1",
        "/health/live",
        "/health/ready",
    }

    response_schema_refs = {
        "/api/v1": "#/components/schemas/ApiRootResponse",
        "/health/live": "#/components/schemas/LivenessResponse",
        "/health/ready": "#/components/schemas/ReadinessResponse",
    }
    for path, expected_ref in response_schema_refs.items():
        response_schema = schema["paths"][path]["get"]["responses"]["200"]["content"][
            "application/json"
        ]["schema"]
        assert response_schema == {"$ref": expected_ref}

    schemas = schema["components"]["schemas"]
    assert_object_schema(schemas, "ApiRootResponse", {"name", "version"})
    assert_object_schema(schemas, "LivenessResponse", {"service", "status"})
    assert_object_schema(schemas, "ReadinessChecks", {"database"})
    assert_object_schema(schemas, "ReadinessResponse", {"checks", "status"})
    assert schemas["ReadinessResponse"]["properties"]["checks"] == {
        "$ref": "#/components/schemas/ReadinessChecks"
    }


def test_readiness_declares_unified_503_error_schema() -> None:
    schema = create_app().openapi()
    responses = schema["paths"]["/health/ready"]["get"]["responses"]

    assert responses["503"]["content"]["application/json"]["schema"] == {
        "$ref": "#/components/schemas/ErrorEnvelope"
    }

    schemas = schema["components"]["schemas"]
    assert_object_schema(schemas, "ErrorEnvelope", {"error"})
    assert schemas["ErrorEnvelope"]["properties"]["error"] == {
        "$ref": "#/components/schemas/ErrorPayload"
    }
    assert_object_schema(
        schemas,
        "ErrorPayload",
        {"code", "details", "message"},
    )
    assert schemas["ErrorPayload"]["properties"]["details"]["type"] == "object"


def test_openapi_does_not_expose_secrets_configuration_or_stack_traces() -> None:
    serialized_schema = json.dumps(create_app().openapi(), sort_keys=True).lower()

    forbidden_fragments = {
        "beiyu_database_url",
        "beiyu_redis_url",
        "beiyu_secret_key",
        "change-me",
        "database_url",
        "postgresql+psycopg",
        "redis_url",
        "secret_key",
        "stack trace",
        "stack_trace",
        "traceback",
    }
    exposed_fragments = {
        fragment for fragment in forbidden_fragments if fragment in serialized_schema
    }
    assert exposed_fragments == set()


def test_openapi_snapshot_is_byte_identical_to_regeneration(tmp_path: Path) -> None:
    generated_path = tmp_path / "openapi.json"
    environment = os.environ.copy()
    environment.update(
        {
            "BEIYU_ENVIRONMENT": "dev",
            "BEIYU_DATABASE_URL": (
                "postgresql+psycopg://beiyu@localhost:5433/beiyu_test"
            ),
            "BEIYU_SECRET_KEY": "change-me",
        }
    )

    result = subprocess.run(
        [
            sys.executable,
            "scripts/generate_openapi.py",
            "--output",
            str(generated_path),
        ],
        cwd=BACKEND_ROOT,
        env=environment,
        capture_output=True,
        text=True,
        check=False,
    )

    assert result.returncode == 0, result.stderr
    assert generated_path.read_bytes() == OPENAPI_PATH.read_bytes()
