# syntax=docker/dockerfile:1

FROM python:3.11-slim AS wheel-builder
WORKDIR /build
RUN pip install --no-cache-dir build
COPY pyproject.toml README.md ./
COPY core ./core
COPY api ./api
COPY cli ./cli
RUN python -m build --wheel --outdir /dist

FROM python:3.11-slim AS api-runtime
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

RUN groupadd --system sentry && useradd --system --gid sentry sentry

COPY --from=wheel-builder /dist/*.whl /tmp/
RUN pip install --no-cache-dir "$(ls /tmp/*.whl)[api]" && rm -f /tmp/*.whl

USER sentry
EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=4s --start-period=5s --retries=3 \
    CMD ["python", "-c", "import urllib.request as u; u.urlopen('http://127.0.0.1:8000/healthz', timeout=2)"]

CMD ["uvicorn", "api.main:app", "--host", "0.0.0.0", "--port", "8000", "--proxy-headers"]
