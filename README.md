# Ingenero360 AI • Methanol & Primary Reformer Configurator

Full-stack industrial digital twin and predictive optimization application for Primary Steam Reformers and Methanol Synthesis plants.

---

## 🏗️ Architecture Overview

The system is organized into two primary microservices:

1. **`frontend/`** (Next.js 14 / React 19 / Tailwind CSS):
   - 5-Step Reformer Configurator & Synthesis Digital Twin.
   - Interactive SVG PFD Flowsheets & Live LBM Cockpit.
   - Asset Life & Prognostic Digital Twins (SMR Catalyst Activity, H2S Adsorber Bed, Convection 1st Exchanger TMT Insulation).
   - Multi-Objective Kinetic, Energy & Longevity Optimization Simulator.
   - Contributor Tags Diagnostic Analysis table.

2. **`backend/`** (Node.js Express + Python Analytics Engine):
   - REST API running on port `5000`.
   - Aspen LBM matching, kinetics, and thermodynamic models (`live_benchmarking_reformer.py`).
   - DCS historian back data analytics and live Excel feature extractors.

---

## 🚀 Quick Start (Local Development)

### Prerequisites
- **Node.js**: v18 or v20+
- **Python**: 3.9+ with `pip`

### 1. Start the Backend API
```bash
cd backend
npm install
pip install -r requirements.txt
node server.js
```
The backend will start on **`http://localhost:5000`**.

### 2. Start the Frontend Application
In a separate terminal:
```bash
cd frontend
npm install
npx prisma generate
npm run dev
```
Open **`http://localhost:3000/reformer-configurator`** (or port 3001).

---

## 🐳 Docker Deployment

To launch both frontend and backend together with Docker Compose:

```bash
docker-compose up --build
```
- Frontend: `http://localhost:3000`
- Backend API: `http://localhost:5000`

---

## 🌐 Production Domain Deployment (e.g. methanol.ingenero360.ai)

1. Push this repository to GitHub:
   ```bash
   git init
   git add .
   git commit -m "feat: initial release of Ingenero360 Methanol Reformer"
   git remote add origin <YOUR_GITHUB_REPO_URL>
   git branch -M main
   git push -u origin main
   ```
2. Connect this repository to your cloud host (e.g. Render, Azure App Service, DigitalOcean).
3. Add a **CNAME** record in your DNS settings:
   - Host: `methanol`
   - Target: `<YOUR_CLOUD_HOST_URL>`
4. Access via `https://methanol.ingenero360.ai`.
