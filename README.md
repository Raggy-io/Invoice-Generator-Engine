# 🧾 Standalone Invoice Generator Engine

<div align="center">
  <p><strong>A premium, GST-compliant, A4 PDF invoice generator.</strong></p>
  <img src="https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB" alt="React" />
  <img src="https://img.shields.io/badge/FastAPI-009688?style=for-the-badge&logo=FastAPI&logoColor=white" alt="FastAPI" />
  <img src="https://img.shields.io/badge/Docker-2CA5E0?style=for-the-badge&logo=docker&logoColor=white" alt="Docker" />
</div>

<br />

This engine provides a robust, standalone solution for dynamically generating premium PDF invoices. It features a **React** frontend for an excellent user experience and a **FastAPI** backend that handles robust PDF generation using `reportlab`.

---

## ✨ Phase 1 - Polish Highlights

- 🎨 **Dark Mode & Premium UI:** Seamlessly switch between light and dark themes honoring the brand colors.
- 👁️ **Invoice Preview:** Preview the generated PDF invoice directly in the browser using a modal overlay before downloading.
- 🖼️ **Company Logo & Signature Uploads:** Personalize invoices by uploading base64 encoded logos and authorized signatures on the fly.
- 🚀 **Performance & UX:** Includes loading spinners, smooth toast notifications, and strict form validation.
- 🐳 **Docker Ready:** Spin up the entire stack with a single `docker-compose` command.
- 🧪 **Comprehensive Testing:** Frontend unit tests using `Vitest` and Backend API testing using `pytest`.
- 📱 **Mobile Responsive:** Fluid layout that looks great on both desktop and mobile devices.

---

## 🚀 Getting Started Locally

You can run the application either using Docker or natively on your machine.

### Option A: Using Docker (Recommended)

1. Make sure Docker and Docker Compose are installed.
2. Run the stack:
   ```bash
   docker-compose up --build
   ```
3. Open your browser to `http://localhost:8080` to access the application.

### Option B: Native Setup

#### 1. Backend (FastAPI)
```bash
cd backend
python -m venv venv
# Windows: venv\Scripts\activate | Mac/Linux: source venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload
```
The backend will run on `http://localhost:8000`.

#### 2. Frontend (React + Vite)
```bash
# In the root directory
npm install
npm run dev
```
The frontend will run on `http://localhost:5173`. Ensure it can talk to the backend by checking the `.env` file (`VITE_API_URL=http://localhost:8000`).

---

## 🧪 Testing

### Frontend Tests (Vitest)
```bash
npm run test
```

### Backend Tests (Pytest)
```bash
cd backend
pytest
```

---

## 📸 Screenshots

*(Add screenshots of the light mode, dark mode, and the preview modal here)*

<div align="center">
  <sub>Built with ❤️</sub>
</div>