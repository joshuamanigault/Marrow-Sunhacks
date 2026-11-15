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


def test_new_specimen_with_shared_structure_id_uses_only_its_own_sources() -> None:
    from marrow.models.specimen import StructureSummary
    from marrow.specimens.preparation import load_config

    config = load_config("uamz-r636")
    source = next(s for s in config.structures if s.id == "nasal")
    structure = StructureSummary(**source.model_dump(), status="ok")
    result = facts.specimen_facts(config.metadata) + facts.structure_facts(
        config.metadata, structure
    )
    assert all(str(f.url) == str(config.metadata.citation.datasetUrl) for f in result)
    rendered = facts.render(result)
    assert "UAMZ R636" in rendered and source.sourceFilename in rendered
    for unsupported in ("Appendix 2", "midline", "YPM", "Eosphorosuchus"):
        assert unsupported not in rendered


def _assert_curated_shapes(specimen_id: str, *, min_structure_ids: int) -> None:
    curated = facts._curated(specimen_id)
    specimen = curated.get("specimen") or []
    structures = curated.get("structures") or {}
    assert isinstance(specimen, list) and len(specimen) >= 3
    assert isinstance(structures, dict) and len(structures) >= min_structure_ids
    for fact in specimen:
        assert fact.get("text") and fact.get("source")
    for structure_id, entries in structures.items():
        assert structure_id
        assert isinstance(entries, list) and entries
        for fact in entries:
            assert fact.get("text") and fact.get("source")


def test_shipped_ypm_structures_facts_are_non_empty() -> None:
    _assert_curated_shapes("ypm-vp-41198", min_structure_ids=10)


def test_shipped_dino_and_fmnh_facts_load() -> None:
    _assert_curated_shapes("dino-15914", min_structure_ids=5)
    _assert_curated_shapes("fmnh-pm9476", min_structure_ids=5)
