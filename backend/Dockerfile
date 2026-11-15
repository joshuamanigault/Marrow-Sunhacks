# Marrow API image. Build from the repo root so the prepared specimen data
# (data/prepared, gitignored) can be copied in:
#   docker build --platform linux/amd64 --provenance=false -f backend/Dockerfile -t marrow-api .
# (--provenance=false: Lambda rejects images with build attestations.)
FROM python:3.13-slim

# Lets the same uvicorn container run on AWS Lambda; ignored everywhere else.
COPY --from=public.ecr.aws/awsguru/aws-lambda-adapter:0.9.1 /lambda-adapter /opt/extensions/lambda-adapter
ENV AWS_LWA_PORT=8000 AWS_LWA_READINESS_CHECK_PATH=/health

COPY --from=ghcr.io/astral-sh/uv:0.13.8 /uv /bin/uv
ENV UV_COMPILE_BYTECODE=1 UV_LINK_MODE=copy UV_PYTHON_DOWNLOADS=never

WORKDIR /app

# Dependencies first, so code changes don't reinstall them.
COPY backend/pyproject.toml backend/uv.lock ./
RUN uv sync --locked --no-dev --no-install-project

COPY backend/src ./src
RUN uv sync --locked --no-dev

# ponytail: specimen meshes baked into the image (about 24 MB). Move them to
# S3 behind CloudFront when there are more specimens than an image should hold.
COPY data/prepared /data/prepared

ENV ASSETS_DIR=/data/prepared PATH="/app/.venv/bin:$PATH"
EXPOSE 8000
CMD ["uvicorn", "marrow.main:app", "--host", "0.0.0.0", "--port", "8000"]
