"""AI routes with a fake model: grounding, validation and the no-key path."""

from __future__ import annotations

from collections.abc import Iterator
from typing import Any

import pytest
from fastapi.testclient import TestClient

from marrow.ai import service
from marrow.ai.llm import get_llm
from marrow.main import app
from marrow.models.ai import ExplainDraft, FollowupDraft, TourDraft, TourStepDraft

client = TestClient(app)
SPECIMEN = "ypm-vp-41198"


class FakeLLM:
    """Records prompts and returns whatever the test sets up."""

    model = "fake-model"

    def __init__(self, reply: Any = None, error: Exception | None = None) -> None:
        self.reply = reply
        self.error = error
        self.calls: list[dict[str, Any]] = []

    def generate(self, *, system: str, prompt: str, schema: Any) -> Any:
        self.calls.append({"system": system, "prompt": prompt, "schema": schema})
        if self.error:
            raise self.error
        return self.reply


@pytest.fixture
def use_llm() -> Iterator[Any]:
    def install(llm: Any) -> Any:
        app.dependency_overrides[get_llm] = lambda: llm
        return llm

    service._explain_cache.clear()
    yield install
    app.dependency_overrides.pop(get_llm, None)
    service._explain_cache.clear()


def test_status_and_routes_are_off_without_a_key(use_llm: Any) -> None:
    use_llm(None)
    assert client.get("/ai/status").json() == {"enabled": False, "model": None}
    r = client.post(
        "/ai/explain", json={"specimenId": SPECIMEN, "structureId": "nasal_r"}
    )
    assert r.status_code == 503
    assert (
        client.post(
            "/ai/tour", json={"specimenId": SPECIMEN, "topic": "jaw"}
        ).status_code
        == 503
    )


def test_explain_is_grounded_and_keeps_only_supplied_fact_ids(use_llm: Any) -> None:
    llm = use_llm(
        FakeLLM(
            ExplainDraft(
                answer=" A nasal bone. ",
                usedFactIds=["nasal_r:1", "made-up", "S1"],
                covered=True,
            )
        )
    )
    r = client.post(
        "/ai/explain", json={"specimenId": SPECIMEN, "structureId": "nasal_r"}
    )
    assert r.status_code == 200
    body = r.json()
    assert body["answer"] == "A nasal bone."
    assert body["aiGenerated"] is True
    assert [f["id"] for f in body["facts"]] == [
        "nasal_r:1",
        "S1",
    ]  # invented id dropped
    prompt = llm.calls[0]["prompt"]
    assert "Nasal (right)" in prompt and "[S1]" in prompt and "nasalR.stl" in prompt
    assert "ONLY the numbered facts" in llm.calls[0]["system"]


def test_default_explain_is_cached_but_questions_are_not(use_llm: Any) -> None:
    llm = use_llm(FakeLLM(ExplainDraft(answer="x", usedFactIds=[], covered=True)))
    for _ in range(2):
        client.post(
            "/ai/explain", json={"specimenId": SPECIMEN, "structureId": "nasal_r"}
        )
    assert len(llm.calls) == 1
    for _ in range(2):
        client.post(
            "/ai/explain",
            json={
                "specimenId": SPECIMEN,
                "structureId": "nasal_r",
                "question": "how old?",
            },
        )
    assert len(llm.calls) == 3


def test_explain_unknown_structure_is_404(use_llm: Any) -> None:
    use_llm(FakeLLM(ExplainDraft(answer="x", usedFactIds=[], covered=True)))
    r = client.post(
        "/ai/explain", json={"specimenId": SPECIMEN, "structureId": "femur_l"}
    )
    assert r.status_code == 404


def test_tour_drops_bones_that_are_not_loaded_or_repeated(use_llm: Any) -> None:
    llm = use_llm(
        FakeLLM(
            TourDraft(
                title="Snout",
                steps=[
                    TourStepDraft(
                        structureId="maxilla_l", caption="missing bone", usedFactIds=[]
                    ),
                    TourStepDraft(
                        structureId="nasal_r",
                        caption="Here is the nasal.",
                        usedFactIds=["S3"],
                    ),
                    TourStepDraft(
                        structureId="nasal_r", caption="again", usedFactIds=[]
                    ),
                    TourStepDraft(
                        structureId="t_rex", caption="invented", usedFactIds=[]
                    ),
                ],
            )
        )
    )
    r = client.post("/ai/tour", json={"specimenId": SPECIMEN, "topic": "the snout"})
    assert r.status_code == 200
    steps = r.json()["steps"]
    assert [s["structureId"] for s in steps] == ["nasal_r"]
    assert steps[0]["facts"][0]["id"] == "S3"
    assert "- nasal_r: Nasal (right)" in llm.calls[0]["prompt"]
    assert "maxilla_l" not in llm.calls[0]["prompt"]  # missing bones are not offered


def test_tour_with_no_valid_stops_is_502(use_llm: Any) -> None:
    use_llm(
        FakeLLM(
            TourDraft(
                title="x",
                steps=[TourStepDraft(structureId="nope", caption="", usedFactIds=[])],
            )
        )
    )
    assert (
        client.post("/ai/tour", json={"specimenId": SPECIMEN, "topic": "x"}).status_code
        == 502
    )


def test_followup_returns_one_question(use_llm: Any) -> None:
    llm = use_llm(
        FakeLLM(
            FollowupDraft(question="Where does it meet the snout?", usedFactIds=["S3"])
        )
    )
    r = client.post(
        "/ai/followup",
        json={
            "specimenId": SPECIMEN,
            "structureId": "nasal_r",
            "note": "it looks rough",
        },
    )
    assert r.status_code == 200
    assert r.json()["question"] == "Where does it meet the snout?"
    assert "it looks rough" in llm.calls[0]["prompt"]


def test_model_failure_becomes_plain_502(use_llm: Any) -> None:
    use_llm(FakeLLM(error=RuntimeError("quota")))
    r = client.post(
        "/ai/explain",
        json={"specimenId": SPECIMEN, "structureId": "nasal_r", "question": "hi"},
    )
    assert r.status_code == 502
    assert "Try again" in r.json()["detail"]


def test_inputs_are_length_limited(use_llm: Any) -> None:
    use_llm(FakeLLM(None))
    r = client.post("/ai/tour", json={"specimenId": SPECIMEN, "topic": "x" * 201})
    assert r.status_code == 422
