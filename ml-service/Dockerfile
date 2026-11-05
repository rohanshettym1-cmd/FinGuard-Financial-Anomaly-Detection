# syntax=docker/dockerfile:1
FROM python:3.14-slim-bookworm AS base
RUN apt-get update \
    && apt-get install -y --no-install-recommends libgomp1 libstdc++6 \
    && rm -rf /var/lib/apt/lists/*

FROM base AS dependencies
WORKDIR /build
COPY requirements-runtime.txt .
RUN pip install --no-cache-dir --prefix=/install -r requirements-runtime.txt

FROM base AS training
ENV PYTHONDONTWRITEBYTECODE=1 OMP_NUM_THREADS=1 OPENBLAS_NUM_THREADS=1
WORKDIR /build
COPY --from=dependencies /install/ /usr/local/
COPY analytics ./analytics
# Train inside Linux; never copy a developer's serialized model or synthetic CSV.
RUN python -m analytics.train --seed 42 --output /build/artifacts

FROM training AS verified
COPY requirements.txt pytest.ini ./
COPY tests ./tests
RUN pip install --no-cache-dir -r requirements.txt && python -m pytest -q

FROM base AS runtime
ENV PYTHONUNBUFFERED=1 PYTHONDONTWRITEBYTECODE=1 OMP_NUM_THREADS=1 OPENBLAS_NUM_THREADS=1 \
    MODEL_PATH=/app/artifacts/isolation_forest.joblib
RUN groupadd --system --gid 10001 finguard \
    && useradd --system --uid 10001 --gid 10001 --no-create-home finguard
WORKDIR /app
COPY --from=dependencies /install/ /usr/local/
COPY --from=verified --chown=10001:10001 /build/artifacts/isolation_forest.joblib ./artifacts/isolation_forest.joblib
COPY --chown=10001:10001 analytics ./analytics
USER 10001:10001
EXPOSE 8000
HEALTHCHECK --interval=15s --timeout=5s --start-period=30s --retries=5 \
    CMD python -c "import json,urllib.request; r=urllib.request.urlopen('http://127.0.0.1:8000/health',timeout=4); assert json.load(r)['status']=='UP'"
CMD ["python", "-m", "uvicorn", "analytics.app:app", "--host", "0.0.0.0", "--port", "8000"]
