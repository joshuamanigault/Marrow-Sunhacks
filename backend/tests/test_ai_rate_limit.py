"""Per-IP rate limit on AI POST routes (not /ai/status)."""

from __future__ import annotations

import time
from collections.abc import Iterator

import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient

from marrow.ai.rate_limit import RateLimiter, get_ai_rate_limiter
from marrow.main import app

client = TestClient(app)
SPECIMEN = "ypm-vp-41198"
EXPLAIN = {"specimenId": SPECIMEN, "structureId": "nasal_r"}
TOUR = {"specimenId": SPECIMEN, "topic": "snout"}
FOLLOWUP = {
    "specimenId": SPECIMEN,
    "structureId": "nasal_r",
    "note": "surface looks rough",
}


@pytest.fixture
def tight_limit() -> Iterator[RateLimiter]:
    limiter = RateLimiter(max_requests=2, window_seconds=60)
    app.dependency_overrides[get_ai_rate_limiter] = lambda: limiter
    yield limiter
    app.dependency_overrides.pop(get_ai_rate_limiter, None)


def test_rate_limiter_is_per_client() -> None:
    limiter = RateLimiter(max_requests=1, window_seconds=60)
    limiter.check("a")
    limiter.check("b")
    with pytest.raises(HTTPException) as exc:
        limiter.check("a")
    assert exc.value.status_code == 429
    assert "Too many AI requests" in str(exc.value.detail)


def test_post_routes_return_429_when_exceeded(tight_limit: RateLimiter) -> None:
    assert client.post("/ai/explain", json=EXPLAIN).status_code != 429
    assert client.post("/ai/tour", json=TOUR).status_code != 429
    r = client.post("/ai/followup", json=FOLLOWUP)
    assert r.status_code == 429
    assert r.json()["detail"] == "Too many AI requests; try again in a minute."


def test_status_is_not_rate_limited(tight_limit: RateLimiter) -> None:
    for _ in range(5):
        assert client.get("/ai/status").status_code == 200
    # POSTs still have their full budget (status must not consume it).
    assert client.post("/ai/explain", json=EXPLAIN).status_code != 429
    assert client.post("/ai/tour", json=TOUR).status_code != 429


def test_short_window_allows_retry_without_waiting_a_minute() -> None:
    limiter = RateLimiter(max_requests=1, window_seconds=0.05)
    app.dependency_overrides[get_ai_rate_limiter] = lambda: limiter
    try:
        assert client.post("/ai/explain", json=EXPLAIN).status_code != 429
        assert client.post("/ai/explain", json=EXPLAIN).status_code == 429
        time.sleep(0.06)
        assert client.post("/ai/explain", json=EXPLAIN).status_code != 429
    finally:
        app.dependency_overrides.pop(get_ai_rate_limiter, None)
