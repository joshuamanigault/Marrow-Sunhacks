"""In-memory per-IP rate limit for AI POST routes (museum demo).

Defaults are generous enough for a kiosk (~30 POSTs / minute / IP) but stop
a public GEMINI_API_KEY from being burned by a bot. Override via constructor
args or AI_RATE_LIMIT / AI_RATE_WINDOW_SECONDS for tests and deploy.
"""

from __future__ import annotations

import os
import time
from collections import defaultdict, deque
from functools import lru_cache
from threading import Lock
from typing import Annotated

from fastapi import Depends, HTTPException, Request

DEFAULT_MAX_REQUESTS = 30
DEFAULT_WINDOW_SECONDS = 60.0


class RateLimiter:
    """Sliding-window counter keyed by client id (usually IP)."""

    def __init__(
        self,
        max_requests: int = DEFAULT_MAX_REQUESTS,
        window_seconds: float = DEFAULT_WINDOW_SECONDS,
    ) -> None:
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        self._hits: dict[str, deque[float]] = defaultdict(deque)
        self._lock = Lock()

    def check(self, client_key: str) -> None:
        now = time.monotonic()
        cutoff = now - self.window_seconds
        with self._lock:
            q = self._hits[client_key]
            while q and q[0] <= cutoff:
                q.popleft()
            if len(q) >= self.max_requests:
                raise HTTPException(
                    status_code=429,
                    detail="Too many AI requests; try again in a minute.",
                )
            q.append(now)

    def reset(self) -> None:
        with self._lock:
            self._hits.clear()


def _env_int(name: str, default: int) -> int:
    raw = os.environ.get(name)
    if raw is None or raw.strip() == "":
        return default
    return int(raw)


def _env_float(name: str, default: float) -> float:
    raw = os.environ.get(name)
    if raw is None or raw.strip() == "":
        return default
    return float(raw)


@lru_cache
def get_ai_rate_limiter() -> RateLimiter:
    return RateLimiter(
        max_requests=_env_int("AI_RATE_LIMIT", DEFAULT_MAX_REQUESTS),
        window_seconds=_env_float("AI_RATE_WINDOW_SECONDS", DEFAULT_WINDOW_SECONDS),
    )


def enforce_ai_rate_limit(
    request: Request,
    limiter: Annotated[RateLimiter, Depends(get_ai_rate_limiter)],
) -> None:
    host = request.client.host if request.client else "unknown"
    limiter.check(host)
