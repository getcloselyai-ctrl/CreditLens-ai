# 💳 CreditLens — Credit Risk Prediction

<p align="center">
  <a href="https://creditlens-ai-36iw.onrender.com">
    <img src="https://img.shields.io/badge/🚀_LIVE_DEMO-TRY_CREDITLENS-FFFFFF?style=for-the-badge&labelColor=15803D" alt="Live Demo"/>
  </a>
</p>

<p align="center">
  An ML-powered application that predicts borrower credit default risk using financial and credit-related information.
</p>

---

### ✨ Features

- Credit default probability prediction
- Calibrated machine learning model
- Optimized classification threshold
- Interactive web interface
- FastAPI-powered prediction API
- Cloud deployment on Render

### 🧠 Machine Learning

| Component | Details |
|---|---|
| Model | CalibratedClassifierCV |
| ML Libraries | Scikit-learn, XGBoost |
| Decision Threshold | 0.6499 |
| Prediction | High Risk / Low Risk |

**Input features:** Age, income, home ownership, employment length, loan amount, interest rate, loan grade, loan intent and credit history.

### 🛠️ Tech Stack

**Python** · Pandas · NumPy · Scikit-learn · XGBoost · FastAPI · Uvicorn · HTML · CSS · JavaScript · Render

### 🏗️ Architecture

```text
Borrower Information
        ↓
Frontend Interface
        ↓
FastAPI Backend
        ↓
Calibrated ML Model
        ↓
Default Probability
        ↓
Threshold Classification
        ↓
Credit Risk Result
```

### 📂 Project Structure

```text
CreditLens-ai/
│
├── main.py
├── credit_risk_model.pkl
├── best_threshold.pkl
├── requirements.txt
│
├── static/
│   ├── index.html
│   ├── styles.css
│   └── app.js
│
└── README.md
```

### ⚙️ Run Locally

```bash
git clone https://github.com/getcloselyai-ctrl/CreditLens-ai.git
cd CreditLens-ai
pip install -r requirements.txt
uvicorn main:app --reload
```

Open `http://127.0.0.1:8000` in your browser.

### 👨‍💻 Author

**Akshat Doshi**

<a href="https://github.com/getcloselyai-ctrl">
  <img src="https://img.shields.io/badge/👨‍💻_GITHUB-VISIT_PROFILE-FFFFFF?style=for-the-badge&labelColor=15803D" alt="GitHub Profile"/>
</a>

---

<p align="center">
  <strong>CreditLens — Turning Data Into Intelligent Risk Predictions.</strong>
</p>
