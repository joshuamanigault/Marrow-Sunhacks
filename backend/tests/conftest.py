from __future__ import annotations

from collections.abc import Iterator
from pathlib import Path

import pytest

from marrow.settings import get_settings
from marrow.specimens.store import get_specimen_store

FIXTURE_ASSETS = Path(__file__).resolve().parent / "fixtures" / "assets"


@pytest.fixture(autouse=True)
def _use_fixture_assets(monkeypatch: pytest.MonkeyPatch) -> Iterator[None]:
    monkeypatch.setenv("ASSETS_DIR", str(FIXTURE_ASSETS))
    get_settings.cache_clear()
    get_specimen_store.cache_clear()
    yield
    get_settings.cache_clear()
    get_specimen_store.cache_clear()
