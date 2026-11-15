"""Curated facts loading: corrupt/unreadable files must not raise."""

from __future__ import annotations

import json
import logging
from collections.abc import Iterator
from pathlib import Path

import pytest

from marrow.ai import facts


@pytest.fixture(autouse=True)
def _clear_curated_cache() -> Iterator[None]:
    facts._curated.cache_clear()
    yield
    facts._curated.cache_clear()


@pytest.fixture
def facts_dir(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Path:
    monkeypatch.setattr(facts, "_FACTS_DIR", tmp_path)
    return tmp_path


def test_missing_facts_file_returns_empty(facts_dir: Path) -> None:
    assert facts._curated("missing") == {"specimen": [], "structures": {}}


def test_valid_facts_file_loads(facts_dir: Path) -> None:
    data = {"specimen": [{"text": "a", "source": "s"}], "structures": {}}
    (facts_dir / "ok.json").write_text(json.dumps(data), encoding="utf-8")
    assert facts._curated("ok") == data


def test_corrupt_json_returns_empty_and_warns(
    facts_dir: Path, caplog: pytest.LogCaptureFixture
) -> None:
    (facts_dir / "bad.json").write_text("{not json", encoding="utf-8")
    with caplog.at_level(logging.WARNING, logger="marrow.ai.facts"):
        assert facts._curated("bad") == {"specimen": [], "structures": {}}
    assert any("bad" in r.getMessage() for r in caplog.records)


def test_unreadable_facts_file_returns_empty_and_warns(
    facts_dir: Path,
    monkeypatch: pytest.MonkeyPatch,
    caplog: pytest.LogCaptureFixture,
) -> None:
    (facts_dir / "locked.json").write_text("{}", encoding="utf-8")

    def boom(self: Path, *args: object, **kwargs: object) -> str:
        raise OSError("permission denied")

    monkeypatch.setattr(Path, "read_text", boom)
    with caplog.at_level(logging.WARNING, logger="marrow.ai.facts"):
        assert facts._curated("locked") == {"specimen": [], "structures": {}}
    assert any("locked" in r.getMessage() for r in caplog.records)
