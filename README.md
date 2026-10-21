# 🏋️ College Gym Management System

A full-stack, production-ready gym access control and membership management platform built for a college environment. The system integrates physical ZKBio face-recognition turnstiles with a modern web application to manage student access, slot bookings, memberships, and administrative controls.

---

## 📐 Architecture Overview

```
┌───────────────────────────────────────────────────────┐
│                   Browser (Students / Admins)          │
│              React + Vite Frontend  :5173              │
└───────────────────┬───────────────────────────────────┘
                    │ HTTPS / SSE / REST
┌───────────────────▼───────────────────────────────────┐
│          Node.js + Express API Backend  :4000          │
│   Auth │ Booking │ People │ Payment │ SSE │ Access     │
└───────────────────┬───────────────────────────────────┘
         ┌──────────┼──────────────────┐
         │          │                  │
   ┌─────▼────┐ ┌───▼──┐  ┌──────────▼──────────┐
   │PostgreSQL│ │Redis │  │  MinIO Object Store  │
   │ :5432    │ │:6379 │  │  :9000               │
   └──────────┘ └───┬──┘  └─────────────────────┘
                    │
┌───────────────────▼───────────────────────────────────┐
│        Python FastAPI Bridge (api_app)  :8000          │
│   ZKBio Student Sync │ Face Status │ Access Logs       │
└───────────────────┬───────────────────────────────────┘
                    │ HTTP REST
┌───────────────────▼───────────────────────────────────┐
│        ZKBio CVSecurity Face Recognition Device        │
│              (Physical Gym Turnstile)                  │
└───────────────────────────────────────────────────────┘
```

---

## 🗂️ Monorepo Structure

```
college-gym/
├── backend/          # Node.js + Express + Drizzle ORM API
├── frontend/         # React + Vite + TypeScript SPA
├── api_app/          # Python FastAPI ZKBio integration bridge
│   (face_ML/ lives next to this repo, not inside it: see Getting Started step 5)
├── worker/           # Background job workers (cron-based)
├── nginx/            # Reverse proxy configuration
├── postgres/         # DB init scripts
├── docs/             # Architecture, SRS, API docs, Sprint plans
├── docker-compose.yml
└── .env.example
```

---

## ✨ Key Features

### For Students
- **Google OAuth Login** using college email (`@rajalakshmi.edu.in`)
- **Slot Booking System** — browse and reserve gym sessions within a personalized, per-user booking window (anchored to active booking dates)
- **Membership Management** — view active plans, purchase Day Scholar passes via PayU payment gateway
- **Face Registration Flow** — guided biometric enrollment at the physical ZKBio turnstile
- **Live Slot Availability** — real-time slot capacity updates
- **Booking History** — view past and upcoming sessions with status indicators
- **Cancellation** — cancel bookings with configurable late-cancellation rules and violation tracking

### For Admins & Super Admin
- **Student Directory** — searchable, paginated list of all provisioned students with filter by residency type
  - One-click Trainer role assignment/revocation
  - One-click Residency toggle (Hosteller ↔ Day Scholar) with full cascade enforcement
  - Per-student booking management modal (view / delete individual / delete all)
- **Excel Bulk Import** — upload an `.xlsx` file to provision hundreds of students at once
- **Slot Management** — generate daily slots, override capacities, open/close specific sessions
- **Membership Plan Control** — create and manage membership plans with pricing and duration
- **Live Access Dashboard** — real-time entry/exit log feed powered by SSE; current occupancy counter
- **Audit Logs** — complete history of all admin actions
- **No-Show Enforcement** — automated cron job issues violation strikes to students who booked but didn't show up

---

## 🔑 Residency System

| Type | Fee | Gym Access | Biometric Requirement |
|------|-----|------------|----------------------|
| **Hosteller** | Free (included in hostel fees) | Unlimited (90-day rolling window) | One-time face registration |
| **Day Scholar** | Paid gym pass required | Duration of purchased pass | Pay → Register face → Activate |

### Residency Toggle Logic (Admin Action)
- **Hosteller → Day Scholar**: All active bookings cancelled automatically · ZKBio turnstile access revoked · Face enrollment reset · Student must re-pay and re-register
- **Day Scholar → Hosteller**: No disruption · Existing bookings preserved · Face stays enrolled · 90-day free pass auto-activates on next verification

---

## 🔴 Real-Time (SSE)

The system uses **Server-Sent Events (SSE)** for all real-time admin dashboard updates:
- No separate ports or WebSocket complexity
- Auto-reconnects via browser native `EventSource`
- Events: `NEW_ACCESS_LOG`, `METRICS_UPDATE`
- Targeted (per-user) and broadcast modes supported

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 18, Vite, TypeScript, Lucide Icons |
| **Backend** | Node.js, Express, TypeScript, Drizzle ORM |
| **Database** | PostgreSQL 15 (multi-schema: `identity`, `people`, `booking`, `membership`, etc.) |
| **Cache / Locks** | Redis (session store, distributed slot locks) |
| **Object Storage** | MinIO (S3-compatible — student photos, reports, archives) |
| **Auth** | Google OAuth 2.0 + Express sessions |
| **Payment** | PayU Payment Gateway (TEST / PRODUCTION modes) |
| **Real-Time** | Server-Sent Events (SSE) |
| **Hardware Bridge** | Python FastAPI (`api_app`) → ZKBio CVSecurity REST API |
| **Containerization** | Docker Compose |
| **Reverse Proxy** | Nginx |

---

## 🚀 Getting Started

### Prerequisites
- Node.js 20+
- Docker + Docker Compose
- Python 3.10+ (for `api_app` only)

### 1. Clone & Install

```bash
git clone https://github.com/Gokulakrishnan610/gym-app.git
cd gym-app
cp .env.example .env   # fill in your credentials
npm install
```

### 2. Start Infrastructure (DB, Redis, MinIO)

```bash
docker compose up -d postgres redis minio
```

### 3. Run in Development

```bash
# Backend API  →  http://localhost:4000
npm run dev:backend

# Frontend SPA →  http://localhost:5173
npm run dev:frontend
```

### 4. (Optional) Start the ZKBio Bridge

```bash
cd api_app
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

### 5. Start the Face ML Service (face verification)

The gym app does not match faces itself. It calls a separate Python service, `face_ML`
(YuNet face detection + AdaFace IR-101 embeddings, served by FastAPI), for face registration
and live verification. The backend talks to it over plain HTTP on the same machine.

> `face_ML/` is **not part of this repository**. Keep it as a sibling folder next to `gym-app/`
> (`REC_Gym/face_ML` and `REC_Gym/gym-app`). Ask the project owner for the folder if you do not have it.

**First run (once)**

```bat
cd face_ML
start.bat
```

`start.bat` creates the virtual environment, installs `requirements.txt`, downloads the models
(YuNet and AdaFace, about 260 MB) into `face_ML/models/`, then starts the service. It also serves
the phone verification page at `https://<your-LAN-IP>:8443` (self-signed certificate: accept the browser warning).

**Every run after that**

```bat
cd face_ML
start_service.bat
```

This starts the service only, on `http://127.0.0.1:8001` (reachable from this machine only). Keep the window open.

**Connect it to the gym app**

1. On first start the service creates an admin token in `face_ML/data/admin.token`
   (or set the `ADMIN_TOKEN` environment variable before starting it).
2. Put the token in the gym app `.env`:

   ```env
   FACE_ML_URL=http://127.0.0.1:8001
   FACE_ML_TOKEN=<contents of face_ML/data/admin.token>
   ```

3. Restart the backend (`npm run dev:backend`).
4. Check the link: sign in as admin and open the Face Upload page, or call `GET /api/v1/face-ml/health`
   with an admin session. It should report the service as reachable.

**Start order:** infrastructure (`docker compose up -d postgres redis minio`) -> `face_ML/start_service.bat`
-> backend -> frontend.

**How it is used**

| Where in the app | What it does |
|------------------|--------------|
| Admin: Face Upload | Upload a student ID photo (one per request). The service stores the face embedding. |
| Admin / trainer: Face Registration | Capture a face with the webcam and match it against the stored ID photo. |
| Student: self registration | Student registers their own face; it is checked against the ID photo on file. |

**Match settings** (`face_ML/app/verify.py`, override in `face_ML/data/config.json`)

| Setting | Default | Meaning |
|---------|---------|---------|
| `t_accept` | `0.50` | Minimum cosine score to accept. Higher = stricter. Calibrated on about 3,500 ID photos: a wrong person is accepted about 2 times in 100,000 attempts. Do not go below 0.45. |
| `min_good_frames` | `2` | Live frames that must pass the quality gate. Every usable frame must reach `t_accept`. |
| `min_blur`, `min_face_width`, `min_brightness`, `max_brightness`, `min_contrast`, `min_det_score`, `max_abs_roll`, `max_abs_yaw` | see file | Photo quality gate. Blurry, shaky, dark, tiny or tilted photos are rejected before matching. |
| `max_attempts` | `3` | Failed matches before the student is sent to the admin. |

Re-tune `t_accept` from real scores in `face_ML/data/scores.csv` after some weeks of use.
Useful tools, run from `face_ML/`:

```bat
REM bulk-register ID photos (file name = student ID)
venv\Scripts\python.exe -m tools.bulk_register photos

REM pick t_accept from one photo per student
venv\Scripts\python.exe -m tools.calibrate_single photos
```

**Troubleshooting**

| Symptom | Fix |
|---------|-----|
| Face pages say the face service is unreachable | Start `face_ML/start_service.bat` and check `FACE_ML_URL`. |
| "Face service rejected the token" | `FACE_ML_TOKEN` must equal `face_ML/data/admin.token`. Restart the backend after changing `.env`. |
| "No face found", "blurry", "too dark" | The photo failed the quality gate. Retake it in good light, facing the camera. |
| Setup fails while downloading models | Check the internet connection and re-run `start.bat`. |

---

---

## ⚙️ Environment Variables

See [`.env.example`](.env.example) for the full list. Key variables:

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `REDIS_HOST` / `REDIS_PORT` | Redis connection |
| `MINIO_*` | MinIO credentials and bucket names |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | OAuth app credentials |
| `SUPER_ADMIN_EMAIL` | Email that gets super_admin role on first login |
| `PAYU_MERCHANT_KEY` / `PAYU_MERCHANT_SALT` | PayU gateway credentials |
| `SESSION_SECRET` | Express session signing secret |
| `ALLOW_DEV_LOGIN` | Set `true` to enable dev bypass login |
| `FACE_ML_URL` | Face ML service URL (default `http://127.0.0.1:8001`) |
| `FACE_ML_TOKEN` | Must equal `face_ML/data/admin.token` |

---

## 📚 Documentation

All documentation lives in the [`docs/`](docs/) directory:

| File | Contents |
|------|----------|
| `college_gym_architecture.md` | Full system architecture and ADRs |
| `college_gym_srs_v1.1.md` | Software Requirements Specification |
| `college_gym_user_stories.md` | Feature user stories by role |
| `college_gym_full_sprint_plan.md` | Sprint-by-sprint build plan |
| `api_documentation.md` | REST API endpoint reference |
| `schema_documentation.md` | Database schema reference |
| `websocket_documentation.md` | SSE / real-time event reference |

---

## 📝 Changelog

See [`CHANGELOG.md`](CHANGELOG.md) for a detailed log of all features and updates.

---

## 👨‍💻 Maintainer

**Gokulakrishnan** — [@Gokulakrishnan610](https://github.com/Gokulakrishnan610)
