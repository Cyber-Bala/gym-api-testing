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
- **Slot Booking System** — browse and reserve 30-minute gym sessions from a rolling 7-day window
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
