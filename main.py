
from pathlib import Path
from contextlib import asynccontextmanager

import joblib
import pandas as pd

from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel


# --------------------------------------------------
# FILE PATHS
# --------------------------------------------------

BASE_DIR = Path(__file__).resolve().parent
MODEL_PATH = BASE_DIR / "credit_risk_model.pkl"
THRESHOLD_PATH = BASE_DIR / "best_threshold.pkl"
STATIC_DIR = BASE_DIR / "static"


# --------------------------------------------------
# MODEL STORAGE
# --------------------------------------------------

ml_model = {}


# --------------------------------------------------
# LOAD MODEL WHEN APPLICATION STARTS
# --------------------------------------------------

@asynccontextmanager
async def lifespan(app: FastAPI):

    if not MODEL_PATH.exists():
        raise FileNotFoundError(
            f"Model file not found: {MODEL_PATH}"
        )

    if not THRESHOLD_PATH.exists():
        raise FileNotFoundError(
            f"Threshold file not found: {THRESHOLD_PATH}"
        )

    ml_model["model"] = joblib.load(MODEL_PATH)
    ml_model["threshold"] = float(
        joblib.load(THRESHOLD_PATH)
    )

    print("Credit Risk model loaded successfully.")
    print(f"Decision threshold: {ml_model['threshold']}")

    yield

    ml_model.clear()


# --------------------------------------------------
# FASTAPI APPLICATION
# --------------------------------------------------

app = FastAPI(
    title="Credit Risk Prediction API",
    description="Predicts loan default risk using a machine learning model.",
    version="1.0.0",
    lifespan=lifespan
)


# --------------------------------------------------
# INPUT DATA VALIDATION
# --------------------------------------------------

class LoanApplication(BaseModel):

    person_age: int
    person_income: float
    person_home_ownership: str
    person_emp_length: float
    loan_intent: str
    loan_grade: str
    loan_amnt: float
    loan_int_rate: float
    loan_percent_income: float
    cb_person_default_on_file: str
    cb_person_cred_hist_length: int


# --------------------------------------------------
# PREDICTION ENDPOINT
# --------------------------------------------------

@app.post("/predict")
def predict(data: LoanApplication):

    try:

        # Convert user input into a DataFrame
        input_df = pd.DataFrame([data.model_dump()])

        # Generate default probability
        probability = float(
            ml_model["model"].predict_proba(input_df)[0, 1]
        )

        # Get the saved decision threshold
        threshold = float(ml_model["threshold"])

        # Classify the loan
        prediction = int(probability >= threshold)

        # Return JSON-compatible Python values
        return {
            "default_probability": probability,
            "default_prediction": prediction,
            "threshold": threshold,
            "Result": "High Risk" if prediction == 1 else "Low Risk"
        }

    except Exception as e:

        print("Prediction error:", repr(e))

        raise HTTPException(
            status_code=500,
            detail=f"Prediction failed: {str(e)}"
        )


# --------------------------------------------------
# SERVE FRONTEND
# --------------------------------------------------

app.mount(
    "/",
    StaticFiles(directory=str(STATIC_DIR), html=True),
    name="static"
)
