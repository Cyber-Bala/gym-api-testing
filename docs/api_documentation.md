# College Gym Management System — API Documentation

## 1. Overview & Architectural Standards

The College Gym Management System API is structured as a **Modular Monolith** organized into 13 logical domain modules. All endpoints conform to standard REST conventions, returning predictable JSON responses wrapped in a uniform schema envelope.

- **Base URL (Production):** `https://gym.lazplay.in/api/v1`
- **Base URL (Local Dev):** `http://localhost:4000/api/v1`
- **Authentication:** HttpOnly session cookies (`session_id`) or Bearer tokens.
- **Timezone:** All timestamps are ISO-8601 strings in UTC or `Asia/Kolkata` (`IST`).

### Uniform JSON Response Envelope

#### Successful Response (`2xx`)
```json
{
  "success": true,
  "data": { ... },
  "message": "Optional human-readable description"
}
```

#### Error Response (`4xx`, `5xx`)
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR | UNAUTHORIZED | FORBIDDEN | NOT_FOUND | CONFLICT | INTERNAL_ERROR",
    "message": "Descriptive error message",
    "details": {},
    "correlationId": "uuid-v4-string"
  }
}
```

---

## 2. Authentication & Identity Domain (`/auth`)

### 2.1 Initiate Google OAuth PKCE Login
- **Method & Path:** `GET /auth/google`
- **Description:** Generates PKCE code challenge and redirects student/staff to Google OAuth consent screen.
- **Query Parameters:**
  - `redirect_to` *(optional)*: Target client URL after successful authorization.
- **Response:** `302 Found` (Redirect to Google OAuth).

### 2.2 Google OAuth Callback
- **Method & Path:** `GET /auth/google/callback`
- **Description:** Validates Google authorization code and PKCE code verifier. Enforces provisioned-only check against `people.people` before provisioning session.
- **Query Parameters:** `code`, `state`
- **Response:** `302 Found` (Sets `Set-Cookie: session_id=<UUID>; HttpOnly; Secure; SameSite=Lax`).

### 2.3 Dev Direct Authentication (Development & UAT)
- **Method & Path:** `POST /auth/dev-login`
- **Description:** Directly issues session cookie for pre-provisioned persona in non-production environments.
- **Request Body:**
```json
{
  "email": "dayscholar@rajalakshmi.edu.in"
}
```
- **Response (`200 OK`):**
```json
{
  "success": true,
  "data": {
    "accountId": "acc-102",
    "personId": "per-102",
    "email": "dayscholar@rajalakshmi.edu.in",
    "name": "Priya Sharma",
    "role": "student",
    "personType": "student",
    "studentDetails": {
      "rollNumber": "2024CS002",
      "department": "CSE",
      "joiningYear": 2024,
      "residency": "day_scholar",
      "isBanned": false,
      "violationCount": 0
    }
  }
}
```

### 2.4 Get Current Session User Profile
- **Method & Path:** `GET /auth/me`
- **Headers:** `Cookie: session_id=<uuid>`
- **Response (`200 OK`):** Returns authenticated session profile.

### 2.5 Logout
- **Method & Path:** `POST /auth/logout`
- **Description:** Destroys session in Redis cache and PostgreSQL, clearing cookie.
- **Response (`200 OK`):** `{"success": true, "message": "Logged out successfully"}`

---

## 3. Directory & Roster Ingestion (`/people`)

### 3.1 List Students (Search & Pagination)
- **Method & Path:** `GET /people/students`
- **Query Parameters:**
  - `page` *(default: 1)*
  - `limit` *(default: 50)*
  - `search` *(searches name, email, roll number)*
  - `department` *(e.g., `CSE`, `ECE`, `MECH`)*
  - `residency` *(e.g., `hosteller`, `day_scholar`)*
- **Response (`200 OK`):** Paginated array of students.

### 3.2 Bulk Excel Student Ingestion
- **Method & Path:** `POST /people/import/students`
- **Headers:** `Content-Type: multipart/form-data`
- **Form Data:** `file` (`.xlsx` or `.csv`)
- **Description:** Streams Excel roster into MinIO, parses rows with fast-csv, applies transactional upsert, and returns statistics.
- **Response (`200 OK`):**
```json
{
  "success": true,
  "data": {
    "totalRows": 1500,
    "inserted": 1450,
    "updated": 50,
    "failed": 0
  }
}
```

### 3.3 Manage Authorized Persons (VIP & Guest Whitelist)
- **`GET /people/authorized-persons`**: Lists active authorized individuals with VIP gym floor clearance.
- **`POST /people/authorized-persons`**: Provisions custom authorized identity.
- **`POST /people/authorized-persons/:id/revoke`**: Revokes institutional gym access.

---

## 4. Per-User Booking Window Engine (`/booking`)

### 4.1 Get Per-User Booking Window Slots
- **Method & Path:** `GET /booking/slots/window`
- **Description:** Returns hourly slots for each active working date within the student's personal booking window (anchored to their last active booking date, greedy-partitioned based on configured open days) in `Asia/Kolkata` time.
- **Response (`200 OK`):**
```json
{
  "success": true,
  "data": {
    "timezone": "Asia/Kolkata",
    "days": [
      {
        "date": "2026-08-19",
        "dayLabel": "Today",
        "slots": [
          {
            "id": "slot-uuid",
            "startTime": "06:00:00",
            "endTime": "07:00:00",
            "capacity": 100,
            "bookedCount": 42,
            "availableSpots": 58,
            "occupancyPercentage": 42,
            "isFull": false,
            "isPast": false,
            "isBookedByCurrentUser": false
          }
        ]
      }
    ]
  }
}
```

### 4.2 Reserve Slot (Two-Tier Locking & Zero Overbooking)
- **Method & Path:** `POST /booking/reserve`
- **Permissions:** Authenticated active Student with valid membership / Day Scholar pass.
- **Request Body:**
```json
{
  "slotId": "slot-uuid-1234"
}
```
- **Concurrency Protection:** Acquires Redis mutex `lock:slot:<id>` (5s TTL) + PostgreSQL `SELECT ... FOR UPDATE`. Rejects bookings once capacity reaches 100.
- **Response (`201 Created`):**
```json
{
  "success": true,
  "data": {
    "bookingId": "book-uuid-9876",
    "slotDate": "2026-08-19",
    "startTime": "18:00:00",
    "status": "booked"
  }
}
```

### 4.3 Cancel Reservation
- **Method & Path:** `POST /booking/cancel/:bookingId`
- **Description:** Enforces late-cancellation penalty check. If cancelled < 60 mins before start, logs a disciplinary strike.
- **Request Body:**
```json
{
  "reason": "Academic laboratory conflict"
}
```

### 4.4 Get My Active & Historical Bookings
- **Method & Path:** `GET /booking/my-bookings`
- **Response (`200 OK`):** Array of user bookings sorted by date descending.

---

## 5. Turnstile Hardware Access & ZKBio Webhooks (`/access`)

### 5.1 ZKBio Turnstile Admission Webhook
- **Method & Path:** `POST /access/webhook/zkbio`
- **Authentication:** Hardware Device Signature / Token (`ACCESS_DEVICE_TOKEN`)
- **SLA:** Evaluates rules and responds under 3000ms.
- **Request Body:**
```json
{
  "deviceId": "turnstile-entry-01",
  "eventType": "entry",
  "identifierType": "roll_number",
  "identifierValue": "2024CS001",
  "verificationMode": "face",
  "timestamp": "2026-08-19T06:05:00Z"
}
```
- **Access Rule Engine (ADR-010):**
  1. Verifies identity is not banned (`violation_count < 3`).
  2. For Day Scholars, validates active membership pass.
  3. Verifies slot reservation falls within **±15 minute grace window** (e.g. 05:45 to 07:15 for 06:00–07:00 slot).
  4. Enforces **Anti-Pass-Back (APB)**: Rejects entry if person already marked inside.
- **Response (`200 OK`):**
```json
{
  "success": true,
  "data": {
    "accessGranted": true,
    "personId": "per-101",
    "name": "Karthik Raja",
    "eventType": "entry",
    "timestamp": "2026-08-19T06:05:00Z"
  }
}
```

### 5.2 Real-Time Live Gym Floor Occupancy
- **Method & Path:** `GET /access/live-occupancy`
- **Response (`200 OK`):** Current active occupants count, category breakdown (Students, Staff, VIPs), and capacity percentage.

---

## 6. Day Scholar Passes & Razorpay Checkout (`/membership`, `/payment`)

### 6.1 List Active Membership Plans
- **Method & Path:** `GET /membership/plans`
- **Response (`200 OK`):**
```json
{
  "success": true,
  "data": [
    { "id": "plan-1", "name": "1-Month Student Pass", "durationDays": 30, "price": "500.00" },
    { "id": "plan-2", "name": "3-Month Student Pass", "durationDays": 90, "price": "1200.00" },
    { "id": "plan-3", "name": "1-Year Annual Pass", "durationDays": 365, "price": "4000.00" }
  ]
}
```

### 6.2 Create Razorpay Order
- **Method & Path:** `POST /payment/create-order`
- **Request Body:** `{"planId": "plan-2"}`
- **Response (`201 Created`):** Returns Razorpay `order_id`, `amount`, `currency`.

### 6.3 Verify Razorpay Payment Signature
- **Method & Path:** `POST /payment/verify`
- **Security:** Validates HMAC SHA-256 signature using `RAZORPAY_KEY_SECRET`.
- **Request Body:**
```json
{
  "orderId": "order_H76gds87sd6",
  "paymentId": "pay_98sdf67sd",
  "signature": "hmac-sha256-signature-string"
}
```
- **Response (`200 OK`):** Activates pass in `membership.memberships` and returns pass expiry date.

---

## 7. Violations & Disciplinary Desk (`/violations`)

- **`GET /violations/flagged`**: Lists students with active strikes or suspensions.
- **`POST /violations/forgive`**: Admin forgiving of disciplinary violation with mandatory audit log note.
- **`POST /violations/ban`**: Explicit administrative 3-day suspension.
- **`POST /violations/unban`**: Reinstates student before automated 3-day expiry.
- **`POST /violations/auto-unban-check`**: Idempotent cron processor checking for expired suspensions.

---

## 8. Trainer Shifts, Payroll & Live Floor Supervision (`/trainer`, `/floor`)

- **`POST /trainer/clock-in`**: Records student-trainer shift clock-in with geo/terminal validation.
- **`POST /trainer/clock-out`**: Closes shift, calculates total minutes, and credits ₹200/hr stipend ledger.
- **`GET /trainer/payroll`**: Returns monthly institutional stipend accounting report.
- **`GET /floor/status`**: Live floor occupancy status with overstayer detection (>75 min).
- **`POST /floor/checkout`**: Manual trainer checkout for students who missed turnstile exit scan.

---

## 9. Executive Analytics & Emergency Calendar Blackouts (`/admin`)

- **`GET /admin/analytics`**: Real-time KPI summaries: Total active members, daily visits, peak hours, revenue.
- **`GET /admin/calendar`**: List of scheduled gym closures and blackout dates.
- **`POST /admin/calendar/closure`**: Emergency calendar closure: Automatically cascades cancellations to all booked slots with status `cancelled_by_gym` without penalizing students.
- **`GET /admin/audit-logs`**: Immutable security audit explorer for compliance tracking.

---

## 10. Reports Engine & Multi-Format CSV Export (`/reports`)

### 10.1 Generate Tabular Domain Report
- **Method & Path:** `GET /reports/generate`
- **Query Parameters:**
  - `reportType`: `attendance` | `revenue` | `violations` | `payroll` | `hardware_telemetry` | `cold_archive`
  - `startDate`, `endDate` (ISO-8601 dates)
- **Response (`200 OK`):** Tabular data with headers, total row counts, and summary totals.

### 10.2 Stream Instant CSV Export
- **Method & Path:** `GET /reports/export-csv`
- **Headers:** `Content-Type: text/csv; Content-Disposition: attachment; filename="report-<type>.csv"`
- **Response:** Raw streamed RFC-4180 CSV file.

---

## 11. Turnstile APB Conflicts & Hardware Biometrics (`/conflicts`, `/biometrics`)

- **`GET /conflicts/list`**: Lists turnstile Anti-Pass-Back conflicts and tailgate attempts.
- **`POST /conflicts/resolve`**: Resolves conflict (`overridden`, `dismissed`, `penalty_applied`).
- **`GET /biometrics/devices`**: Hardware health telemetry (`online`, `degraded`, `offline`).
- **`POST /biometrics/sync-process`**: Triggers batch biometric facial vector synchronization to ZKBio terminals.

---

## 12. Data Lifecycle, Departure & 7-Year Cold Storage (`/archive`)

- **`POST /archive/job`**: Creates compressed Parquet/Zstandard cold archive bundle in MinIO.
- **`POST /archive/departure`**: Graduating student departure: Marks student departed, revokes passes, and purges facial templates (`face_enrollment_status = 'purged'`).
- **`GET /archive/summary`**: Overview of active vs archived records.

---

## 13. System Liveness, Readiness & E2E Verification (`/health`, `/integration`)

- **`GET /health`** or **`GET /health/live`**: Fast liveness probe (`{"status": "ok", "uptimeSeconds": 1200}`).
- **`GET /health/ready`**: Deep readiness probe querying PostgreSQL, Redis ping, and MinIO storage availability.
- **`POST /integration/run-all-flows`**: Programmatically executes and validates all 12 End-to-End system flows (`FLOW-001..012`).
