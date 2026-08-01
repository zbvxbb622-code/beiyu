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


def test_openapi_has_exact_stage_three_paths_and_explicit_success_schemas() -> None:
    schema = create_app().openapi()

    public_paths = {
        "/api/v1",
        "/api/v1/auth/devices",
        "/api/v1/auth/devices/{device_id}",
        "/api/v1/auth/login",
        "/api/v1/auth/logout",
        "/api/v1/auth/refresh",
        "/api/v1/auth/sms-codes",
        "/api/v1/ai/conversations",
        "/api/v1/ai/conversations/{conversationId}",
        "/api/v1/ai/conversations/{conversationId}/messages",
        "/api/v1/ai/memories",
        "/api/v1/ai/memories/{memoryId}",
        "/api/v1/ai/memory-settings",
        "/api/v1/ai/temporary-messages",
        "/api/v1/ai/usage/today",
        "/api/v1/bars",
        "/api/v1/bars/{public_id}",
        "/api/v1/cellar/items",
        "/api/v1/cellar/items/batch",
        "/api/v1/cellar/items/{item_id}",
        "/api/v1/community/posts",
        "/api/v1/community/posts/{post_id}",
        "/api/v1/community/posts/{post_id}/comments",
        "/api/v1/home",
        "/api/v1/ingredients",
        "/api/v1/knowledge",
        "/api/v1/knowledge/{public_id}",
        "/api/v1/me/account",
        "/api/v1/me/age-confirmation",
        "/api/v1/me/bootstrap",
        "/api/v1/me/local-sync",
        "/api/v1/me/privacy",
        "/api/v1/me/profile",
        "/api/v1/recipes",
        "/api/v1/recipes/{public_id}",
        "/api/v1/search",
        "/health/live",
        "/health/ready",
    }
    admin_paths = set()
    for resource in {
        "ingredients",
        "recipes",
        "bars",
        "knowledge",
        "banners",
        "shortcuts",
    }:
        prefix = f"/api/v1/admin/{resource}"
        admin_paths.update(
            {
                prefix,
                f"{prefix}/{{public_id}}",
                f"{prefix}/{{public_id}}/archive",
                f"{prefix}/{{public_id}}/publish",
                f"{prefix}/{{public_id}}/rollback",
                f"{prefix}/{{public_id}}/versions",
            }
        )

    assert set(schema["paths"]) == public_paths | admin_paths

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


def test_stage_three_contract_uses_bearer_auth_and_camel_case() -> None:
    schema = create_app().openapi()
    assert schema["components"]["securitySchemes"]["HTTPBearer"] == {
        "type": "http",
        "scheme": "bearer",
    }

    protected_operations = {
        ("/api/v1/auth/devices", "get"),
        ("/api/v1/auth/logout", "post"),
        ("/api/v1/cellar/items", "get"),
        ("/api/v1/cellar/items", "post"),
        ("/api/v1/community/posts", "get"),
        ("/api/v1/community/posts", "post"),
        ("/api/v1/community/posts/{post_id}", "get"),
        ("/api/v1/community/posts/{post_id}/comments", "post"),
        ("/api/v1/me/bootstrap", "get"),
        ("/api/v1/me/profile", "patch"),
        ("/api/v1/me/local-sync", "post"),
        ("/api/v1/ai/conversations", "get"),
        ("/api/v1/ai/conversations", "post"),
        ("/api/v1/ai/conversations/{conversationId}", "get"),
        ("/api/v1/ai/conversations/{conversationId}", "delete"),
        ("/api/v1/ai/conversations/{conversationId}/messages", "get"),
        ("/api/v1/ai/conversations/{conversationId}/messages", "post"),
        ("/api/v1/ai/temporary-messages", "post"),
        ("/api/v1/ai/memories", "get"),
        ("/api/v1/ai/memories", "delete"),
        ("/api/v1/ai/memories/{memoryId}", "delete"),
        ("/api/v1/ai/memory-settings", "patch"),
        ("/api/v1/ai/usage/today", "get"),
        ("/api/v1/admin/recipes", "get"),
        ("/api/v1/admin/recipes", "post"),
        ("/api/v1/admin/bars", "post"),
        ("/api/v1/admin/banners/{public_id}/publish", "post"),
    }
    for path, method in protected_operations:
        assert schema["paths"][path][method]["security"] == [{"HTTPBearer": []}]

    schemas = schema["components"]["schemas"]
    assert set(schemas["LoginResponse"]["properties"]) == {
        "accessToken",
        "refreshToken",
        "tokenType",
        "expiresIn",
        "refreshExpiresIn",
        "isNewUser",
        "user",
        "device",
    }
    assert set(schemas["BootstrapResponse"]["properties"]) == {
        "user",
        "profile",
        "privacy",
        "accountSecurity",
        "cellar",
        "ai",
        "featureFlags",
    }
    assert "ingredientId" in schemas["CellarItemResponse"]["properties"]
    assert "clientMessageId" in schemas["SendMessageRequest"]["properties"]
    assert "assistantMessage" in schemas["TemporaryMessageResponse"]["properties"]


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
        "phone_hash",
        "code_hash",
        "refresh_token_hash",
        "installation_id_hash",
        "normalized_custom_name",
        "sms_development_code",
        "ai_api_key",
        "ai_base_url",
        "ai_memory_hmac_key",
        "prompt_version",
        "context_text",
        "provider payload",
        "api key",
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
