# 🔌 Gym API App — ZKBio CVSecurity Integration Bridge

A lightweight **Python FastAPI** service that acts as the communication bridge between the main [Gym Management System](https://github.com/Gokulakrishnan610/gym-app) backend and the physical **ZKBio CVSecurity face-recognition turnstile device** installed at the college gym entrance.

---

## 🎯 Purpose

The college gym uses **ZKBio CVSecurity** hardware devices for biometric (face scan) access control at the turnstile. The ZKBio device exposes its own proprietary REST API for:
- Registering and deleting persons (students) on the device
- Assigning and revoking access levels
- Querying biometric face template enrollment status
- Polling transaction logs (entry/exit scan events)

This `api_app` wraps all that complexity and provides a clean, application-specific REST API that the main Node.js backend can call without needing to know about ZKBio internals.

---

## 🔄 System Position

```
Node.js Backend (gym-app)
        │
        │  HTTP REST  (localhost:8000)
        ▼
  api_app (this service)
        │
        │  HTTP REST + access_token auth
        ▼
  ZKBio CVSecurity Device
  (Physical Turnstile @ 192.168.x.x)
```

---

## ✨ Key Capabilities

### Student / Person Management
- **Register a person** on the ZKBio device when a student is first enrolled
- **Delete a person** from the device when a student leaves or has their access revoked (e.g., Hosteller → Day Scholar residency change)
- **Get person details** including biometric template info

### Access Level Control
- **Grant access level** to a student (called after successful payment + face enrollment)
- **Revoke access level** from a student (called when membership expires or residency changes)
- **Sync person state** with the device after updates

### Face Enrollment Status
- **`GET /api/students/{roll_no}/face-status`** — queries ZKBio to check if a face biometric template exists for a given student roll number
- Returns `{ enrolled: true/false }` so the main backend can update the student's enrollment status in the database

### Transaction Polling (Background)
- A background async task polls the ZKBio device every N seconds (configurable via `ZKBIO_POLL_INTERVAL`)
- Fetches new face-scan entry/exit transactions
- De-duplicates transactions using an in-memory seen-IDs set
- Writes new `AccessLog` records to the local SQLite database
- Broadcasts real-time updates to any connected dashboard WebSocket clients

### Manual Access Logging
- **`POST /api/access/log`** — manually log an entry/exit event (for testing or manual override when the device is offline)

### Payment Status Sync
- **`PATCH /api/students/{roll_no}/payment`** — updates a student's payment/access status
- When set to `expired` or `unpaid`, automatically calls ZKBio to revoke the student's access level on the physical device
- When set to `paid` with a valid date, automatically grants the access level on the device

---

## 📁 Project Structure

```
api_app/
├── main.py           # FastAPI application, all routes, background poller
├── zkbio_client.py   # ZKBio CVSecurity HTTP API client wrapper
├── models.py         # SQLAlchemy ORM models (Student, AccessLog)
├── schemas.py        # Pydantic request/response schemas
├── database.py       # SQLite database setup and session management
├── requirements.txt  # Python dependencies
└── static/           # Optional static dashboard HTML
```

---

## 🚀 Getting Started

### Prerequisites
- Python 3.10+
- `pip` or `uv`

### Install & Run

```bash
# Clone the repo
git clone https://github.com/Gokulakrishnan610/gym_api_app.git
cd gym_api_app

# Install dependencies
pip install -r requirements.txt

# Run the server
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

The API will be available at `http://localhost:8000`.

Interactive API docs (Swagger UI): `http://localhost:8000/docs`

---

## ⚙️ Configuration (Environment Variables)

Create a `.env` file in the project root:

```env
# ZKBio Device
ZKBIO_ENABLED=false                  # Set to true when real device is connected
ZKBIO_BASE_URL=http://192.168.1.100  # IP address of your ZKBio device
ZKBIO_ACCESS_TOKEN=your_token_here   # Device API access token
ZKBIO_LEVEL_IDS=1                    # Access level ID to grant/revoke on device
ZKBIO_DEPT_CODE=1                    # Department code for person registration

# Polling
ZKBIO_POLL_INTERVAL=5                # Seconds between transaction polls

# Entry/Exit Detection Mode
ZKBIO_ENTRY_EXIT_MODE=two_readers    # "two_readers" or "single_reader"

# For two_readers mode (comma-separated if you have multiple lanes/devices)
ZKBIO_ENTRY_READER=0,2               # Reader indexes for entry
ZKBIO_EXIT_READER=1,3                # Reader indexes for exit

# For single_reader mode (comma-separated if you have multiple doors)
ZKBIO_ENTRY_DOOR_ID=1,3              # Door IDs for entry
ZKBIO_EXIT_DOOR_ID=2,4               # Door IDs for exit
```

> **Note:** When `ZKBIO_ENABLED=false`, all ZKBio device calls are silently skipped (no-op). This allows full local development and testing without a physical device connected.

---

## 📡 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/students` | List all students with optional search/filter |
| `POST` | `/api/students` | Create a student and register on ZKBio device |
| `GET` | `/api/students/{roll_no}` | Get student details |
| `PATCH` | `/api/students/{roll_no}` | Update student fields |
| `DELETE` | `/api/students/{roll_no}` | Delete student and revoke device access |
| `PATCH` | `/api/students/{roll_no}/payment` | Update payment status + sync ZKBio access level |
| `GET` | `/api/students/{roll_no}/face-status` | Check if face template is enrolled on ZKBio device |
| `POST` | `/api/access/log` | Manually log an entry/exit event |
| `GET` | `/api/access/logs` | List all access log entries |
| `GET` | `/api/stats` | Current gym statistics (occupancy, counts) |
| `WS` | `/ws` | WebSocket for real-time transaction broadcast |

---

## 🔧 ZKBio Integration Details

The `zkbio_client.py` module wraps the ZKBio CVSecurity REST API. Key operations:

| Operation | ZKBio Endpoint Called |
|-----------|----------------------|
| Register person | `POST /api/person/add` |
| Get person info | `GET /api/person/getPersonInfo` |
| Delete person | `DELETE /api/person/delete/{pin}` |
| Grant access level | `POST /api/accLevel/addLevelPerson` |
| Revoke access level | `DELETE /api/accLevel/deleteLevelPerson` |
| Sync to device | `POST /api/person/sync` |
| Poll transactions | `GET /api/transaction/listTransaction` |

> The **PIN** field on the ZKBio device corresponds to the student's **Roll Number** in this system.

---

## 🧪 Development Without a Device

Set `ZKBIO_ENABLED=false` in your environment. All ZKBio calls become no-ops and the service runs purely on its local SQLite database. The main gym-app backend can still call all endpoints — face status checks will return `enrolled: false`, and payment syncs will be acknowledged without device interaction.

---

## 🔗 Related Repository

Main Gym Management System (Backend + Frontend):
👉 [github.com/Gokulakrishnan610/gym-app](https://github.com/Gokulakrishnan610/gym-app)

---

## 👨‍💻 Maintainer

**Gokulakrishnan** — [@Gokulakrishnan610](https://github.com/Gokulakrishnan610)
