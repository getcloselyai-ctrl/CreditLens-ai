# 💳 CreditLens — Credit Risk Prediction

<p align="center">
  **An ML-powered application for predicting borrower credit default risk.**
</p>

<p align="center">
  <a href="YOUR-RENDER-URL">
    <img src="https://img.shields.io/badge/🚀_LIVE_DEMO-Try_CreditLens-00C853?style=for-the-badge" />
  </a>
</p>

## 📌 Overview

CreditLens is a machine learning application that estimates the probability of credit default using borrower financial and credit-related information.

It uses a calibrated classification model and an optimized decision threshold to classify borrowers into **High Risk** and **Low Risk** categories.

## ✨ Features

- Credit default probability prediction
- Calibrated machine learning model
- Threshold-based risk classification
- Interactive web interface
- FastAPI-powered prediction API
- Live cloud deployment

## 🧠 Machine Learning

**Model:** `CalibratedClassifierCV`

**Classification Threshold:** `0.6498711007775217`

```python
if probability >= best_threshold:
    prediction = "High Risk"
else:
    prediction = "Low Risk"
```

**Input features include:**
- Age and annual income
- Home ownership and employment length
- Loan amount and interest rate
- Loan purpose and grade
- Credit history and previous defaults

## 🛠️ Tech Stack

| Category | Technologies |
|---|---|
| Language | Python |
| ML | Scikit-learn, XGBoost |
| Data | Pandas, NumPy |
| Backend | FastAPI, Uvicorn |
| Frontend | HTML, CSS, JavaScript |
| Deployment | Render |

## 🏗️ Architecture

```text
User Input
    ↓
Frontend
    ↓
FastAPI Backend
    ↓
Calibrated ML Model
    ↓
Default Probability
    ↓
Threshold Classification
    ↓
Risk Prediction
```

## 📂 Project Structure

```text
CreditLens-ai/
├── main.py
├── credit_risk_model.pkl
├── best_threshold.pkl
├── requirements.txt
├── static/
│   ├── index.html
│   ├── styles.css
│   └── app.js
└── README.md
```

## ⚙️ Run Locally

```bash
git clone https://github.com/getcloselyai-ctrl/CreditLens-ai.git
cd CreditLens-ai
pip install -r requirements.txt
uvicorn main:app --reload
```

Open `http://127.0.0.1:8000` to use the application.

API documentation: `http://127.0.0.1:8000/docs`

## ☁️ Deployment

Deployed on **Render**.

[Launch CreditLens →](YOUR-RENDER-URL)

## ⚠️ Disclaimer

CreditLens is an educational machine learning project. Its predictions should not be used as the sole basis for real-world lending decisions.

## 👨‍💻 Author

**Akshat Doshi**

[GitHub Profile](https://github.com/getcloselyai-ctrl)

---

<p align="center">
  **CreditLens — Turning Data Into Intelligent Risk Predictions.**
</p>
