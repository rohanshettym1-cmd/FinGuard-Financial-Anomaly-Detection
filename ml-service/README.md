# FinGuard analytics service

Use Python 3.14 (the verified runtime) and the pinned `requirements.txt`. From this directory:

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe -m pytest -q
.\.venv\Scripts\python.exe -m analytics.train --seed 42 --output artifacts
.\.venv\Scripts\python.exe -m uvicorn analytics.app:app --host 127.0.0.1 --port 8000
```

On macOS/Linux substitute `.venv/bin/python`. Train before starting the service.
`GET /health` returns 200 when a compatible model is loaded, otherwise 503.
`POST /predict` accepts the shared numeric feature contract and returns a 0–100
training-score percentile, an outlier flag, model version and explanation. This is
not a fraud probability. FastAPI's interactive API documentation is at `/docs`.

`MODEL_PATH` defaults to `artifacts/isolation_forest.joblib`. Export environment
variables yourself; `.env` files are not loaded automatically. Load only artifacts
you trained or trust: joblib uses Python serialization and is not an untrusted upload format.
Generated CSVs, models, virtual environments and local artifacts stay out of Git.
The small committed [evaluation summary](../docs/evaluation.json) contains only
aggregate synthetic metrics and provenance. See [architecture](../docs/anomaly-detection.md)
and the root README for Java integration, examples, limits and actual evaluation results.

The Docker build uses `requirements-runtime.txt` for serving/training dependencies,
runs the full tests in a separate verification stage, and trains a Linux-native model.
It copies neither local serialized artifacts nor generated CSVs into the runtime.
See the root README for Compose setup and its current verification limitation.
