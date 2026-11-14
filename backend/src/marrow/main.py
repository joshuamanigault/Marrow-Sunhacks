from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from marrow.routes.specimens import router as specimens_router
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

app.include_router(specimens_router)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
