"""Load only locally trained, trusted model artifacts; never accept uploaded pickle files."""
from contextlib import asynccontextmanager
from decimal import Decimal
import os
from pathlib import Path
import logging
import joblib
import pandas as pd
import sklearn
from fastapi import FastAPI, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel, ConfigDict, Field, StrictBool
from analytics.features import matrix, FEATURE_VERSION, FEATURE_NAMES
from analytics.model import predict


class PredictionRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", allow_inf_nan=False)
    amount: Decimal = Field(gt=0, le=Decimal("99999999999999999.99"), max_digits=19, decimal_places=2)
    hour: int = Field(ge=0, le=23, strict=True)
    frequency_5m: int = Field(ge=1, le=1000000, strict=True)
    prior_debit_count: int = Field(ge=0, le=1000000000, strict=True)
    baseline_mean: Decimal = Field(ge=0, le=Decimal("99999999999999999.99"))
    is_debit: StrictBool


class PredictionResponse(BaseModel):
    risk_score: int = Field(ge=0, le=100)
    anomalous: bool
    model_version: str
    explanation: str


def create_app(model_path: Path | None = None) -> FastAPI:
    @asynccontextmanager
    async def lifespan(app):
        app.state.bundle = None
        path = model_path if model_path is not None else Path(os.getenv("MODEL_PATH", "artifacts/isolation_forest.joblib"))
        try:
            bundle = joblib.load(path)
            if (bundle["feature_version"] != FEATURE_VERSION or bundle["feature_names"] != FEATURE_NAMES
                    or bundle["sklearn_version"] != sklearn.__version__):
                raise ValueError("Incompatible artifact; retrain locally")
            app.state.bundle = bundle
        except Exception:
            logging.getLogger(__name__).warning("Model is unavailable or incompatible; train a trusted local artifact")
            # Readiness and predictions explicitly return 503; Java retains rules.
        yield

    app = FastAPI(title="FinGuard analytics", version="1.0.0", lifespan=lifespan)

    @app.get("/health")
    def health():
        bundle = app.state.bundle
        return JSONResponse(status_code=200 if bundle is not None else 503,
                            content={"status": "UP" if bundle is not None else "MODEL_NOT_READY",
                                     "model_version": bundle["model_version"] if bundle is not None else None})

    @app.post("/predict", response_model=PredictionResponse)
    def prediction(request: PredictionRequest):
        if app.state.bundle is None:
            raise HTTPException(503, "Train a compatible model before serving predictions")
        features = matrix(pd.DataFrame([request.model_dump()]))
        raw, ranks, flags = predict(app.state.bundle, features)
        history = (f"historical debit mean {request.baseline_mean} from {request.prior_debit_count} prior debits"
                   if request.prior_debit_count >= 5 and request.baseline_mean > 0
                   else "insufficient debit history; spending-deviation feature is neutral")
        if not request.is_debit:
            history = "credit transaction; spending-deviation feature is neutral"
        detail = (f"Isolation Forest raw score {raw[0]:.6f} "
                  f"{'exceeds' if flags[0] else 'does not exceed'} cutoff {app.state.bundle['threshold']:.6f}. "
                  f"Context: amount {request.amount}, UTC hour {request.hour}, "
                  f"{request.frequency_5m} account transactions in five minutes; {history}. "
                  "Training-score percentile is not a fraud probability; context is not causal feature attribution.")
        return PredictionResponse(risk_score=int(ranks[0]), anomalous=bool(flags[0]),
                                  model_version=app.state.bundle["model_version"],
                                  explanation=detail)
    return app


app = create_app()
