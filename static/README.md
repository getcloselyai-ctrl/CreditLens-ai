# CreditLens — Credit Risk Assessment Application

Professional Redesign of the CreditLens Credit Risk Application UI/UX.

## Structure
- `index.html`: Complete single-page application markup with integrated layout, tabs, Tailwind CSS configuration, and inline scripts for instant execution/previewing.
- `styles.css`: Standalone custom CSS stylesheet containing dark charcoal variables, font declarations, scrollbar tweaks, and keyframe transitions.
- `app.js`: Standalone frontend JS script managing form validation, auto-calculating loan-to-income decimal ratios, geometric math for dynamic SVG speedometer needles & threshold line markers, and API calls to `POST /predict`.

## Backend API Specification
The application expects an API endpoint at `POST /predict` returning JSON structured as:
```json
{
  "default_probability": 0.266,
  "default_prediction": 0,
  "threshold": 0.649871,
  "Result": "Low Risk"
}
```
