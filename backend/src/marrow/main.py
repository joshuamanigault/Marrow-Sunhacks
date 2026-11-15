from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from marrow.routes.ai import router as ai_router
from marrow.routes.specimens import router as specimens_router
from marrow.routes.upload_events import router as events_router
from marrow.routes.uploads import router as uploads_router
from marrow.settings import get_settings

settings = get_settings()

app = FastAPI(title="Marrow", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

if settings.upload_worker:
    app.include_router(events_router)
else:
    app.include_router(specimens_router)
    app.include_router(uploads_router)
    app.include_router(ai_router)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
