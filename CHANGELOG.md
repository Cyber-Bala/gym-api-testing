# Gym Management System — Comprehensive Feature & Update Log

> Last updated: September 20, 2026
> This document captures every major change, design decision, and system behaviour update made to the Gym Management System (college-gym) during this development session.

---

## 1. Real-Time Communication: WebSocket → Server-Sent Events (SSE)

### Problem It Solved
The original system used WebSockets for real-time push notifications from the backend to the admin dashboard (for live access logs, entry/exit events, and occupancy updates). While conceptually sound, WebSockets in this context had several practical problems:
- They required a **separate port (4001)** alongside the main API port (4000), creating network complexity.
- When the tab became inactive or the browser throttled background JS, connections would **silently drop** and never reconnect.
- WebSocket handshakes require additional CORS configuration and are stateful, making horizontal scaling harder.
- The frontend had no automatic reconnection strategy, leaving admins staring at stale dashboards with no visual indication of the outage.

### What Changed
The entire real-time pipeline was rebuilt using the **Server-Sent Events (SSE)** protocol — a native browser mechanism designed for exactly this use case: one-way, server-to-client event streaming over standard HTTP.

### How It Works Now

**On the Backend:**
- A dedicated `SseService` (singleton) manages a registry of all connected admin browsers. Each connected browser is tracked by the admin's account ID.
- When a student scans their face at the gym turnstile, the `api_app` sends a webhook/event to the Node.js backend. The backend processes this event, creates an entry/exit log, and instantly broadcasts the new log entry to every connected admin browser using the SSE service.
- The SSE service supports two modes:
  - **`sendToUser(accountId, eventType, payload)`**: Sends a targeted message to a specific user's sessions only.
  - **`broadcast(eventType, payload)`**: Sends a message simultaneously to every connected admin regardless of who they are.
- When an admin browser closes its tab or navigates away, the connection's `close` event automatically removes it from the registry, preventing memory leaks.

**On the Frontend:**
- The SSE connection is established as soon as an admin logs in, using the browser's native `EventSource` API.
- When a `NEW_ACCESS_LOG` event arrives, the live access feed on the dashboard updates instantly — no page refresh, no polling, no delay.
- When a `METRICS_UPDATE` event arrives, the live headcount and occupancy counters update in real-time.
- The `EventSource` implementation automatically handles **reconnection** with exponential backoff built into the browser. If the connection drops, the browser silently re-establishes it on its own.

### Benefits Over Before
- **Zero separate ports**: SSE runs over the same HTTP port as the rest of the API.
- **Automatic reconnects**: Built into the browser specification — no custom retry logic needed.
- **Works with standard auth cookies**: No WebSocket handshake trickery needed since it's plain HTTP.
- **Reduced server memory**: Stateless HTTP streams vs. stateful socket connections.
- **Better firewall/proxy compatibility**: SSE is just HTTP, so it works through every proxy and CDN without special configuration.

---

## 2. Admin Booking Management Panel

### Problem It Solved
Previously, gym slot bookings could only be cancelled by the student themselves. This created a significant operational gap:
- If a student was banned, departed, or changed residency, their bookings would remain locked in the system, blocking other students from booking those slots.
- Admins had no ability to intervene when disputes, No-Show abuse, or scheduling conflicts occurred without asking the student to log in and cancel manually.
- There was no audit trail differentiating between a student-initiated cancellation (which incurs a strike) and an admin override (which should be penalty-free).

### What Changed

**Backend: Three New Admin-Only API Endpoints**

1. **`GET /api/v1/booking/admin/user/:email/bookings`**
   - Accepts a student's email address.
   - Returns a complete chronological list of all their bookings — past, active, and cancelled — with full slot details (date, time, status).
   - Only accessible to users with the `admin` or `super_admin` role.

2. **`DELETE /api/v1/booking/admin/bookings/:bookingId`**
   - Cancels a single specific booking by its ID without applying any discipline strike to the student.
   - Uses a **Redis distributed lock** (`lock:booking:cancel:{id}`) to prevent race conditions if two admin tabs try to cancel the same booking simultaneously.
   - Uses a **database transaction** with `FOR UPDATE` row locking on the booking record, ensuring atomic status updates.
   - Marks the booking as `cancelled_by_admin` rather than the normal `cancelled`, creating a clear audit trail.
   - Decrements the slot's `booked_count` by 1, immediately freeing that slot capacity so another student can book it.

3. **`DELETE /api/v1/booking/admin/user/:email/bookings`**
   - Cancels **all** active (status: `booked`) bookings for a student at once.
   - Iterates through each booking individually, applying the same Redis lock + transaction safety as single-booking cancellation.
   - Errors on individual bookings are caught and logged without aborting the others, ensuring a partial failure doesn't leave the student in a half-cancelled state.

**Frontend: Admin Student Bookings Modal**

A brand new `AdminStudentBookingsModal` component was built and integrated into the Student Directory:
- Every student row in the directory now has a **"Bookings"** button in its action column.
- Clicking it opens a slide-up modal that immediately fetches and displays all of that student's bookings.
- Each booking is shown with its date, time, and current status badge.
- A **trash icon** button next to each active booking lets admins delete it one at a time.
- A **"Cancel All Bookings"** button at the top of the modal lets admins wipe all active slots for that student in one click.
- A confirmation dialog appears before any destructive action, requiring explicit admin intent.
- After every cancellation, the booking list automatically refreshes to reflect the current state.

---

## 3. Intelligent Residency Toggle with Full Business Logic Enforcement

### Problem It Solved
The system had two student residency types with completely different rules:
- **Hostellers** get free, inclusive gym access as part of their hostel fees. They just need to register their face at the turnstile once.
- **Day Scholars** must purchase a gym membership pass separately before they can use the gym, and their access is payment-gated.

Previously, when an admin changed a student's residency in the system, it was a pure database field update with no downstream effects. This caused serious loopholes:
- A Hosteller being moved to Day Scholar status would still have their face enrolled on the physical ZKBio turnstile devices, meaning they could physically walk into the gym and scan their face despite no longer having a valid entitlement.
- Their existing slot bookings would remain active and usable.
- The system would display them as "Pending" enrollment but the physical device still let them in.
- Conversely, a Day Scholar being moved to Hosteller had no issues — their existing access was already payment-gated, so if anything their access would improve.

### What Changed

The `PATCH /api/v1/people/students/:id/residency` endpoint now triggers a **two-path intelligent workflow** depending on the direction of the residency change.

**Path A: Hosteller → Day Scholar**

This is the security-sensitive transition. The following happens automatically in sequence when an admin clicks the residency badge to change a Hosteller to a Day Scholar:

1. **Booking Cancellation**: All of the student's active (status: `booked`) gym slot bookings are immediately cancelled by admin, freeing up the capacity in each of those slots for other students. The student receives no discipline strikes for these cancellations since they are system-initiated.

2. **ZKBio Turnstile Revocation**: An internal HTTP call is made to the `api_app` (the Python FastAPI service that interfaces with the ZKBio hardware at `http://localhost:8000`), marking the student's payment status as `expired`. This triggers the `api_app` to make a follow-up call to the ZKBio device's API, which immediately removes the student's access level on the physical turnstile. From that moment on, if the student walks up to the gym entrance and scans their face, the turnstile will deny them entry.

3. **Biometric Status Reset**: The student's `faceEnrollmentStatus` field is set back to `not_enrolled` and their `faceReferenceId` is cleared in both the `people` table and the `students` table. This is the state they were in before they ever registered at the gym.

4. **Enforced Re-onboarding**: Because their face enrollment status is now `not_enrolled`, the next time they log into the student app, they will be presented with the Day Scholar onboarding flow. This requires them to:
   - Purchase a valid Day Scholar gym membership pass (payment via PayU gateway).
   - Physically go to the gym and register their face on the ZKBio device (biometric enrollment).
   - Only after both steps are complete will the system re-activate their access.

**Path B: Day Scholar → Hosteller**

This is a seamless, non-disruptive upgrade. The following happens when an admin changes a Day Scholar to a Hosteller:

1. **No booking cancellation**: All existing booked gym slots remain fully active. The student keeps every session they had already reserved. Their plans don't need to change.

2. **No biometric reset**: Their face template remains active and registered on the ZKBio turnstile. They do not need to visit the gym to re-enroll.

3. **No payment re-requirement**: They immediately benefit from the Hosteller free access model. If they had an existing membership pass, it remains as-is. Their next verification step (if needed) will auto-activate a hosteller 90-day pass.

The admin sees instant feedback via a toast notification confirming the residency update succeeded.

---

## 4. Face Verification & Membership Activation Flow

### How It Works
When a student claims they have registered their face at the gym device, they trigger a verification check from the student app. The backend:

1. Looks up the student's roll number.
2. Makes an HTTP call to the `api_app` at `/api/students/{roll_number}/face-status`.
3. The `api_app` in turn queries the ZKBio device API for that PIN (the roll number is the device PIN) and checks if a face biometric template exists.
4. If the ZKBio device confirms the face is registered:
   - The student's `faceEnrollmentStatus` is updated to `enrolled` in the database.
   - If the student is a **Hosteller**: A 90-day free hosteller pass membership is automatically created and activated without any payment.
   - If the student is a **Day Scholar**: The system finds their most recent `pending_activation` membership (created after their PayU payment completed) and activates it, beginning their pass validity window from that moment.
5. If the face is not yet registered, the system returns a `not yet registered` message and the student is instructed to visit the gym.

---

## 5. Super Admin Identity & Mock Data Setup

### Change Made
The default Super Admin email in the system configuration was updated from the generic institutional email `iiic@rajalakshmi.edu.in` to `gokulakrishnankadhirvelu@gmail.com`.

### Why It Matters
- The Super Admin account has the highest level of system access — it can view all students, override all bookings, manage plans, manage admins, and access audit logs.
- During development and demo presentations, this account needs to be consistently available and pre-configured.
- The mock face biometric data was seeded specifically for this account's roll number so that the face-scan and biometric enrollment flow can be demonstrated end-to-end without needing a real ZKBio device.

---

## 6. No-Show Violation Evaluator (Background Scheduler)

### What It Does
A background job runs every 5 minutes (`cron: */5 * * * *`) to evaluate whether any students who booked a gym slot did not actually show up.

- It checks bookings whose slot time has already passed and status is still `booked` (not `attended` or `cancelled`).
- Students who no-showed receive a **violation strike** on their record, incrementing their `violationCount`.
- If a student accumulates enough strikes (`violationCount >= threshold`), they are automatically flagged as banned and lose access until an admin reviews and clears them.
- This system ensures fairness — preventing students from hoarding slot bookings and then not showing up, which blocks other students from accessing the gym.

---

## 7. Admin Slot Control Endpoints

These endpoints existed but were confirmed working as part of this session's validation:

- **`GET /api/v1/booking/config`**: Returns the current slot generation configuration (e.g., number of slots per day, capacity per slot, start/end hours).
- **`PUT /api/v1/booking/config`**: Lets super admins update slot configuration globally.
- **`POST /api/v1/booking/slots/generate`**: Manually triggers slot generation for upcoming days.
- **`PATCH /api/v1/booking/slots/:id/capacity`**: Overrides the capacity of a specific slot (e.g., reduce from 20 to 10 for a maintenance day).
- **`PATCH /api/v1/booking/slots/:id/status`**: Closes or reopens a specific slot (e.g., cancel a slot entirely due to gym closure).

---

## 8. Student Directory Enhancements

The admin Student Directory received several UI-level improvements:

- **Residency Badge is now an Interactive Toggle**: The `Hosteller` / `Day Scholar` badge in the directory table is now a clickable button. Clicking it instantly triggers the residency change workflow described in Section 3. A loading pulse animation indicates the change is in progress.
- **Trainer Role Toggle**: Similarly, the Role column shows a clickable button for assigning or removing the Trainer role from a student. Trainers get access to the trainer-specific features and schedule.
- **Bookings Button in Action Column**: Each student row now has a "Bookings" button that opens the Admin Student Bookings Modal (Section 2).
- **Add Student Modal**: A "Add Student" button at the top of the directory opens an inline form where admins can manually register a single student (name, roll number, email, department, batch year, residency type) without needing an Excel import.
- **Residency Filter**: The directory now has a filter dropdown to quickly show only Hostellers or only Day Scholars.
- **Live Hosteller Counter**: The directory header shows a real-time count of how many Hostellers are loaded in the current view.

---

## 9. Git Repository Setup

Both repositories were initialized and pushed to GitHub under the `Gokulakrishnan610` account:

- **Main Application** (`college-gym` — full stack: backend + frontend + worker + nginx + docs):
  → `https://github.com/Gokulakrishnan610/gym-app`

- **Hardware Integration Bridge** (`api_app` — Python FastAPI ZKBio integration service):
  → `https://github.com/Gokulakrishnan610/gym_api_app`

Both repositories have their `main` branch set as the default tracking branch.
