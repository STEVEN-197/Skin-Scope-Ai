# SkinScope AI

SkinScope AI is a production-ready Flask web app for non-invasive skin diagnostics and monitoring using a hybrid AI pipeline:

- Session-based authentication with isolated user data
- Image upload + region-aware analysis (`eye`, `skin`, `palm`)
- Hybrid inference (MobileNet feature signal + HSV/RGB color analysis)
- Weighted historical integration: **Current (70%) + History (30%)**
- Structured report history and PDF export
- Modern healthcare-style dashboard UI

## Project Structure

```
app/
  ai/
  auth/
  database/
  models/
  routes/
  static/
  templates/
instance/uploads/
run.py
```

## Quick Start

1. Create and activate a virtual environment
2. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
3. Run app:
   ```bash
   python run.py
   ```
4. Open `http://127.0.0.1:5000`

## Notes

- SQLite database is automatically created as `instance/skinscope.db`.
- Uploaded images and exported PDFs are stored under `instance/uploads/`.
- This tool provides **screening support only** and is not a clinical diagnosis.
