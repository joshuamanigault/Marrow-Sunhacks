"""Tour when the specimen has no loaded (status=ok) bones."""

from __future__ import annotations

from collections.abc import Iterator
from typing import Any

import pytest
from fastapi.testclient import TestClient

from marrow.ai import service
from marrow.ai.llm import get_llm
from marrow.main import app
from marrow.specimens.store import get_specimen_store

client = TestClient(app)
SPECIMEN = "ypm-vp-41198"


class FakeLLM:
    model = "fake-model"

    def generate(self, *, system: str, prompt: str, schema: Any) -> Any:
        raise AssertionError("LLM must not be called when no bones are loaded")


@pytest.fixture
def use_llm() -> Iterator[Any]:
    def install(llm: Any) -> Any:
        app.dependency_overrides[get_llm] = lambda: llm
        return llm

    service._explain_cache.clear()
    yield install
    app.dependency_overrides.pop(get_llm, None)
    service._explain_cache.clear()


def test_tour_with_no_ok_bones_is_502(
    use_llm: Any, monkeypatch: pytest.MonkeyPatch
) -> None:
    use_llm(FakeLLM())
    store = get_specimen_store()
    original = store.get_specimen

    def without_ok_bones(specimen_id: str):
        specimen = original(specimen_id)
        return specimen.model_copy(
            update={
                "structures": [
                    s.model_copy(update={"status": "missing", "meshUrl": None})
                    for s in specimen.structures
                ]
            }
        )

    monkeypatch.setattr(store, "get_specimen", without_ok_bones)
    r = client.post("/ai/tour", json={"specimenId": SPECIMEN, "topic": "jaw"})
    assert r.status_code == 502
    assert "No bones are loaded" in r.json()["detail"]
