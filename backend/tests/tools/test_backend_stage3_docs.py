from pathlib import Path

REPOSITORY_ROOT = Path(__file__).resolve().parents[3]
BACKEND_README = REPOSITORY_ROOT / "backend" / "README.md"
STAGE3_DEMO = REPOSITORY_ROOT / "docs" / "backend-stage3-ai-local-demo.md"
WORKFLOW = REPOSITORY_ROOT / ".github" / "workflows" / "backend-ci.yml"


def test_backend_readme_describes_stage_three_ai_backend() -> None:
    readme = BACKEND_README.read_text(encoding="utf-8")

    assert "Stage 3" in readme
    assert "/api/v1/ai/conversations" in readme
    assert "/api/v1/ai/temporary-messages" in readme
    assert "docs/backend-stage3-ai-local-demo.md" in readme
    assert "AI chat persistence, community" not in readme


def test_stage_three_demo_documents_backend_ai_flow() -> None:
    demo = STAGE3_DEMO.read_text(encoding="utf-8")

    for fragment in (
        "POST /api/v1/ai/conversations",
        "POST /api/v1/ai/conversations/{conversationId}/messages",
        "POST /api/v1/ai/temporary-messages",
        "GET /api/v1/ai/memories",
        "PATCH /api/v1/ai/memory-settings",
        "GET /api/v1/ai/usage/today",
        "TEMPORARY_RESPONSE_NOT_RETAINED",
    ):
        assert fragment in demo


def test_backend_ci_runs_for_stage_three_backend_docs() -> None:
    workflow = WORKFLOW.read_text(encoding="utf-8")

    assert "docs/backend-stage3-ai-local-demo.md" in workflow
