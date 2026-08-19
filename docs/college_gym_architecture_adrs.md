# College Gym System — Architecture Decision Records

**Document:** Architecture Decision Record (ADR) Collection  
**Version:** 1.0  
**Status:** Accepted baseline for implementation planning  
**System:** College Gym Management PWA  
**Current scale:** ~16,000 students  
**Expected near-term scale:** ~25,000 students  
**Primary deployment model:** VPS  
**Timezone:** UTC at rest, IST at presentation  
**Frontend:** Vite + React + TypeScript (TSX)  
**Backend:** Node.js + Express  
**Database:** PostgreSQL

---

## 0. Architecture Context

The College Gym System is a PWA used by students, trainers, staff, authorized persons, admins, and super admins.

The system handles:

- Student onboarding from Excel
- Hosteller and Day Scholar membership/access rules
- Slot booking and cancellation
- 100-person default slot capacity
- No-show/cancellation violation policy
- Face-based gym access
- Entry/exit tracking
- Trainer working-hour tracking
- Membership and Razorpay payments
- Admin CRM
- Granular administrative permissions
- Real-time gym state
- Conflict/exception logging
- Long-term archival and anonymization
- Push notifications
- Reporting and exports

The design must remain practical to operate on a VPS while preserving clean boundaries so individual infrastructure components can later be replaced or scaled independently.

---

# ADR-001 — Use a VPS-Centric Modular Application Architecture

**Status:** Accepted  
**Decision:** Use a modular backend deployed on a VPS rather than adopting a distributed microservice architecture initially.

### Context

The system is expected to grow from approximately 16,000 students to approximately 25,000 students. The application has many modules, but they are owned by the same system and will initially run on a VPS.

The project benefits more from operational simplicity than from introducing network boundaries between every module.

### Decision

Use a **modular monolithic architecture** initially.

The backend remains one deployable Node.js/Express application, internally divided into modules such as:

```text
src/
  modules/
    auth/
    students/
    staff/
    authorized-persons/
    bookings/
    slots/
    memberships/
    payments/
    access/
    trainers/
    notifications/
    reports/
    conflicts/
    audit/
    archival/
    admin/
  realtime/
  database/
  shared/
```

Modules communicate through application services/domain events rather than direct cross-module database manipulation wherever practical.

### Consequences

**Positive**
- Simple VPS deployment
- Simple development and debugging
- Low infrastructure overhead
- Easier database transactions
- Easier local development
- Clear path to later extraction of modules if required

**Negative**
- Application is initially deployed as one main backend unit
- A failure in the backend can affect multiple modules
- Some modules will require deliberate boundaries to avoid becoming tightly coupled

### Rejected

Full microservices from day one.

The current scale does not justify the added operational complexity.

---

# ADR-002 — Frontend: Vite + React + TypeScript PWA

**Status:** Accepted  
**Decision:** Use Vite + React + TypeScript/TSX as the frontend stack and ship the application as a Progressive Web App.

### Requirements

- PWA installability
- Mobile-first usability
- Responsive layouts for phones, tablets, laptops, and wide desktop screens
- Touch-friendly controls
- Keyboard/mouse support on desktop
- Responsive dashboards for all roles
- PWA manifest
- Service worker
- App-shell caching where appropriate
- Push notification support

### Layout principle

The system must support:

```text
Mobile
  ↓
Tablet
  ↓
Laptop
  ↓
Wide desktop / large monitor
```

The UI must not simply stretch a mobile layout onto a desktop.

### Consequences

A single frontend codebase can serve:

- Mobile browsers
- Installed PWAs
- Desktop browsers
- Wide administrative workstations

---

# ADR-003 — Backend: Node.js + Express

**Status:** Accepted  
**Decision:** Use Node.js with Express for the backend.

### Responsibilities

Express is responsible for:

- REST APIs
- Authentication callbacks
- Authorization
- Business rules
- Booking transactions
- Membership management
- Payments
- CRM
- Reports
- Admin operations
- Audit logging
- WebSocket integration boundary
- Background job coordination

### Boundary

Controllers should remain thin:

```text
HTTP Request
    ↓
Controller
    ↓
Application Service
    ↓
Domain/Business Logic
    ↓
Repository
    ↓
PostgreSQL
```

---

# ADR-004 — PostgreSQL as the System of Record

**Status:** Accepted  
**Decision:** Use PostgreSQL as the primary transactional database.

### Rationale

PostgreSQL is appropriate for:

- Strong transactional guarantees
- Relational booking data
- Membership relationships
- Audit records
- Financial records
- Concurrent updates
- Constraints and indexes
- Reporting queries

### Important rule

The application must never rely on the frontend to enforce capacity, membership, or access-control rules.

The database and backend transaction must enforce authoritative state.

---

# ADR-005 — Google Sign-In for User Authentication

**Status:** Accepted  
**Decision:** Use Google Sign-In / Google Identity Services for authentication.

Google's current web identity documentation recommends Google Identity Services for Sign in with Google; for modern browser applications, the Authorization Code flow with PKCE is preferred over the legacy implicit flow. citeturn455452search0turn455452search2

### Business rule

The college's uploaded student/staff record is the application identity source of truth.

The Google account is used to prove control of the corresponding email identity.

### Login flow

```text
User
  ↓
Google Sign-In
  ↓
Backend validates Google identity
  ↓
Match verified email to provisioned person
  ↓
Load internal role/status
  ↓
Create application session
```

### Constraints

- Do not allow arbitrary self-registration.
- A Google account must map to a provisioned record.
- Role is determined by the application's own database.
- Google identity does not determine application permissions.

### Note on "free/unlimited"

The architecture does not depend on purchasing a separate per-seat authentication product. However, Google service quotas/policies must not be assumed to be literally unlimited; implementation should respect Google's current service policies and limits.

---

# ADR-006 — Modular Authorization and Granular Admin Permissions

**Status:** Accepted  
**Decision:** Use RBAC with granular permissions and a protected Super Admin.

### Model

```text
Super Admin
    ↓
Creates / manages
    ↓
Admin Roles
    ↓
Assigns granular permissions
    ↓
Admins
```

This is intentionally similar to Discord-style permission assignment.

### Example permissions

```text
students.read
students.write
memberships.read
memberships.write
bookings.read
bookings.manage
slots.manage
payments.read
payments.reconcile
trainers.read
trainer_hours.manage
conflicts.manage
reports.export
audit.read
archive.manage
system.configure
admins.manage
```

### Super Admin

- Can do everything.
- Manages admin permissions.
- Cannot be deleted through normal UI operations.
- A protected primary Super Admin identity exists at the system level.
- Changes to Super Admin configuration require special controlled procedures.

### Audit

All sensitive permission changes are audited.

---

# ADR-007 — Access Control Must Be Vendor-Neutral

**Status:** Accepted  
**Decision:** The core system will not directly depend on ZKBio CV APIs.

### Current hardware

The current planned access-control environment uses **ZKBio CV** and its API.

The actual machine integration is deferred to the architecture/implementation phase.

### Architecture

```text
Core Application
      ↓
Access-Control Interface
      ↓
ZKBio CV Adapter
      ↓
ZKBio CV API
      ↓
Physical Access Control
```

### Interface responsibilities

The access-control interface should support concepts such as:

```text
validateEntry()
validateExit()
recordEntry()
recordExit()
getDeviceHealth()
pauseAccess()
resumeAccess()
```

The core application must not understand vendor-specific payload formats.

### Benefit

ZKBio CV can later be replaced without redesigning booking, membership, or CRM logic.

---

# ADR-008 — WebSocket Only for Turnstile / Access-Control Communication

**Status:** Accepted  
**Decision:** WebSocket is used **only for the turnstile/access-control machine integration path**. It is not the general-purpose realtime transport for the PWA, Admin dashboard, Trainer dashboard, notifications, or booking updates.

### Context

The system needs a reliable low-latency communication channel between the backend and the gym's physical access-control environment.

The current planned access-control environment uses **ZKBio CV**. The application should be able to receive/send access-control events without coupling the rest of the business system to a vendor-specific transport.

### Decision

Use WebSocket only within the access-control integration boundary:

```text
Core Application
      ↓
Access-Control Adapter
      ↓
WebSocket connection
      ↓
Turnstile / ZKBio CV integration
      ↓
Physical access-control system
```

The exact ZKBio CV API/WebSocket behavior will be handled in the implementation/architecture phase.

### WebSocket responsibilities

The WebSocket connection may carry only access-control-related events/commands such as:

- Entry authorization request/result
- Exit event/result
- Turnstile access result
- Device health/status
- Access-control failure
- Device recovery/status restoration
- Relevant machine/device diagnostics

### WebSocket is NOT used for

- General application notifications
- Student dashboard updates
- Trainer dashboard updates
- Admin dashboard updates
- Booking events
- Membership events
- Chat
- General PWA synchronization

Those concerns should use normal backend APIs and the appropriate push/background-notification mechanisms.

### Reliability requirements

- Authenticate the integration endpoint.
- Authorize the connected device/service.
- Validate all incoming machine events.
- Use unique event/correlation IDs where required.
- Handle disconnect/reconnect.
- Detect stale/dead connections.
- Preserve important access-control events in the backend.
- Never allow the WebSocket connection itself to become the authoritative source of booking or membership state.
- The backend/database remains authoritative.

### Failure behavior

If the access-control communication path fails:

1. The system detects the failure.
2. Admin is notified.
3. The affected access-control operation is paused.
4. Relevant diagnostics/events are logged.
5. The college resolves the physical/operational problem.
6. Normal operation resumes after recovery.

### Consequences

**Positive**
- Keeps WebSocket scope narrow and easier to secure.
- Avoids unnecessary realtime infrastructure for the rest of the application.
- Keeps access-control vendor integration isolated.
- Makes future replacement of the turnstile/access-control provider easier.

**Negative**
- Any future requirement for realtime PWA dashboards would require a separate architecture decision.
- Access-control event reliability must be handled carefully because it interacts with physical entry/exit.


# ADR-009 — Slot Capacity Must Be Enforced Transactionally

**Status:** Accepted  
**Decision:** Booking capacity is authoritative at the backend/database transaction boundary.

### Confirmed defaults

- Maximum slot capacity: **100**
- Capacity is configurable by Admin.
- The slot must never exceed its configured capacity.

### Concurrent booking requirement

The system must safely handle many users attempting to book the same slot at the same time.

Conceptually:

```text
Request
  ↓
Begin transaction
  ↓
Lock / atomically reserve capacity
  ↓
Verify eligibility
  ↓
Create booking
  ↓
Commit
```

Only one set of requests can consume the final available capacity.

### Required properties

- No overselling
- No duplicate successful booking for the same student/slot
- Failed booking does not consume capacity
- Safe under concurrent load

### Architecture note

The exact PostgreSQL locking/reservation strategy will be finalized during detailed architecture.

---

# ADR-010 — Slot Booking Rules

**Status:** Accepted

### Default rules

- Booking window: 3 applicable open days
- Maximum 3 slots per booking window
- Slot duration: 50 minutes
- Buffer: 10 minutes
- Default capacity: 100
- Started/past slots cannot be booked
- Student can cancel any time before slot start
- Cancelled capacity becomes available to others
- Cancellation is only a violation when initiated by the student
- No-show is a violation
- Third violation by default triggers a ban
- Default ban duration: 3 days
- Violation threshold and ban duration are Admin-configurable
- Closed days are ignored by the booking-window calculation

### Buffer behavior

During the 10-minute buffer:

- Students from the ending slot may exit.
- Students from the next slot may enter.

This is a business rule, not merely a UI behavior.

---

# ADR-011 — Unified Booking Violation Policy

**Status:** Accepted  
**Decision:** Student cancellation and no-show are handled by one configurable violation policy.

### Default

```text
0 violations → normal
1 violation  → normal
2 violations → normal
3rd violation → ban
```

Default ban:

```text
3 days
```

Both values are Admin-configurable.

### Exemption

Gym-initiated cancellation due to:

- Closure
- Maintenance
- Administrative shutdown
- Other gym-controlled cancellation

does **not** count as a student's violation.

---

# ADR-012 — Membership Model Supports One Active + One Queued Membership

**Status:** Accepted

### Rules

- A student can have one active membership.
- A student may have one queued/future membership.
- Overlapping active memberships are prohibited.
- Queued membership starts automatically after the active membership expires.
- Plans, price, and duration are Admin-configurable.
- Membership starts immediately after successful payment.
- Slot bookings must fall within the applicable membership validity.
- Hostellers have free access under the same booking rules.

---

# ADR-013 — Razorpay With Payment-Provider Abstraction

**Status:** Accepted

### Initial provider

Razorpay.

### Architectural requirement

Do not make membership logic depend directly on Razorpay SDK concepts.

Use:

```text
Membership Service
      ↓
Payment Provider Interface
      ↓
Razorpay Adapter
```

Possible interface:

```text
createPayment()
verifyPayment()
getPaymentStatus()
handleWebhook()
refundPayment()
```

### Benefit

The college can later replace Razorpay with another payment gateway with minimal impact to the core membership system.

---

# ADR-014 — Hot Database + Cold Archive Storage

**Status:** Accepted

The PostgreSQL database should not be forced to store all historical operational data forever.

### Hot data

Keep frequently accessed data in PostgreSQL:

- Active students
- Active staff/authorized persons
- Active memberships
- Future/current bookings
- Current gym presence
- Recent access history
- Recent conflicts
- Current trainer hours
- Current configuration

### Archive data

Move older historical records to cost-optimized object storage.

Recommended storage representation:

```text
Parquet + Zstandard compression
```

### Retrieval

Historical search should be transparent to Admin.

```text
Recent → PostgreSQL
Older → Archive
       ↓
Combined result
```

### Retention

Current policy assumption:

```text
Operational data
    ↓
Archive
    ↓
7-year anonymization lifecycle
```

Health and biometric information do not automatically inherit the generic seven-year retention rule.

---

# ADR-015 — Student Departure Is a Lifecycle Transition

**Status:** Accepted

### Departure source

College provides an Excel file containing roll numbers for students who have left.

### Processing

```text
Excel
  ↓
Validate roll numbers
  ↓
Identify students
  ↓
Deactivate operational access
  ↓
Invalidate future bookings/access
  ↓
Move operational records out of hot storage
  ↓
Retain historical data in archive lifecycle
```

### Reactivation

Admin may reactivate a departed person.

Reactivation must:

- Be explicitly authorized
- Be audited
- Restore active operational status
- Reapply current eligibility rules

### Active membership at departure

Current decision:

- Gym access is immediately terminated.
- Membership is no longer active for gym access.
- Any business/refund handling outside the gym system is handled by the college/payment process.
- Historical membership data remains in the appropriate history/archive.

---

# ADR-016 — Staff and Authorized Persons Use a Separate Access Policy

**Status:** Accepted

## Staff

Staff records are uploaded through Excel.

Staff:

- Do not require gym booking.
- Do not require membership.
- May enter and exit without student constraints.
- Have entry/exit logs.
- Have a dashboard showing:
  - Entry
  - Exit
  - Hours spent

The dashboard is for visibility into their commitment to the gym and is not a payroll engine.

## Authorized Persons

Admins may create persons outside the student/staff population.

Examples:

- Owner
- Authorized outsider
- Maintenance
- Guest
- Other college-approved personnel

Authorized persons:

- Do not require membership.
- Do not require booking.
- Can enter and exit according to their active authorization.
- Can be disabled/revoked by Admin.
- Have a dedicated dashboard showing their own access information.
- All access remains logged and auditable.

---

# ADR-017 — Time Is Stored in UTC and Presented in IST

**Status:** Accepted

### Storage

All timestamps are stored in **UTC**.

Recommended PostgreSQL representation:

```text
TIMESTAMPTZ
```

### Presentation

The application displays timestamps in **IST (Asia/Kolkata)**.

```text
Database
    UTC
     ↓
Backend
     ↓
Client presentation
     ↓
Asia/Kolkata (IST)
```

### Rules

- Never store local time as the authoritative timestamp.
- Do not manually add/subtract 5:30 in application code.
- Use timezone-aware libraries/formatters.
- Date-range queries must define the intended timezone before converting boundaries to UTC.

---

# ADR-018 — Brand and Theme System

**Status:** Accepted with implementation calibration

### Official visual direction

The current Rajalakshmi Engineering College web presence uses the institution's newer **purple-and-gold identity**. The college site is the authoritative reference for the current brand direction. citeturn479906search5turn479906search1

### Decision

The PWA will use the official Rajalakshmi logo/brand direction rather than inventing a separate visual identity.

### Theme requirements

The application supports:

- Light mode
- Dark mode
- User-selectable theme
- Default = **System**

Theme setting:

```text
System
Light
Dark
```

### Color system

Use semantic design tokens rather than scattering raw colors throughout the UI.

```css
--brand-primary
--brand-secondary
--brand-accent
--surface
--surface-elevated
--text-primary
--text-secondary
--border
--success
--warning
--danger
```

### Palette

The official current visual identity is purple + gold. Exact HEX values should be sampled from the final approved official logo/brand asset during UI implementation rather than copied from an unofficial third-party logo source. The official college site currently exposes the logo as part of its site identity. citeturn579933view0

Recommended semantic structure:

```text
Primary  → REC Purple
Accent   → REC Gold
Neutral  → White / neutral gray scale
Dark     → Near-black / deep neutral surface
```

The logo must retain sufficient contrast in both themes.

---

# ADR-019 — Responsive PWA Across Mobile and Wide Desktop

**Status:** Accepted

### Decision

The application is a responsive PWA designed for:

- Mobile phones
- Tablets
- Laptops
- Desktop PCs
- Wide monitors

### Requirements

- Mobile-first layouts
- Adaptive navigation
- Touch-friendly targets
- Keyboard/mouse support
- Responsive tables
- Wide dashboard layouts
- Mobile cards where tables become impractical
- No fixed-width application shell
- No role should require a desktop-only workflow

### Large-screen rule

Wide screens should use additional space intentionally for:

- Multi-column dashboards
- Filters
- Tables
- Real-time monitoring
- Side-by-side details

---

# ADR-020 — Push Notifications Only

**Status:** Accepted

### Decision

Use push notifications as the application's notification delivery mechanism.

Email notifications are intentionally not part of the current product.

### Default reminder

```text
15 minutes before slot start
```

Reminder time is Admin-configurable.

### Push events include

- Booking confirmation
- Slot reminder
- Booking cancellation
- Gym closure
- Membership purchase
- Membership expiry
- Payment status
- No-show/ban events
- Relevant Admin announcements
- Access/system alerts where appropriate

---

# ADR-021 — Admin Data Lifecycle Management

**Status:** Accepted

Provide an Admin page dedicated to:

- Retention policies
- Archive status
- Records approaching archival
- Records approaching anonymization
- Archive jobs
- Anonymization jobs
- Execution history
- Errors/failures
- Audit trail

The interface must not imply that "archive" equals "delete."

### Seven-year lifecycle

```text
Active / Hot
    ↓
Historical
    ↓
Cold Archive
    ↓
7-year policy threshold
    ↓
Anonymize / delete approved personal fields
    ↓
Retain only permitted non-identifying information
```

---

# ADR-022 — Audit Everything Sensitive

**Status:** Accepted

Sensitive actions must produce an audit record.

### Minimum audit information

```text
actor
timestamp
action
entity
entity_id
previous_value
new_value
reason
IP/device/context where available
correlation/request ID where available
```

### Mandatory reason

A reason is required for sensitive changes such as:

- Residency
- Face enrollment
- Health information
- Membership overrides
- Entry/exit correction
- Booking overrides
- User status
- Admin permission changes
- Archive/anonymization
- Reactivation

Audit history must not be casually overwritten.

---

# ADR-023 — Excel Is the College Data Exchange Format

**Status:** Accepted

The college will exchange bulk records through Excel templates.

### Supported workflows

- Initial student import
- New student import
- Staff import
- Leaving-student import
- Other approved bulk update workflows

### Processing pipeline

```text
Upload
  ↓
Validate schema
  ↓
Validate row-level data
  ↓
Detect duplicates/conflicts
  ↓
Process valid rows
  ↓
Produce result report
```

### Result report

The system must clearly report:

- Successfully processed records
- Rejected records
- Reason for rejection
- Warnings
- Duplicate/conflicting records
- Summary counts

---

# ADR-024 — Background Jobs for Non-Interactive Work

**Status:** Accepted

The backend must not perform long-running work inside synchronous HTTP requests.

Use a background worker/process for:

- Excel import processing
- Archive jobs
- Anonymization
- Large report generation
- Notification fan-out
- Payment reconciliation
- Other long-running jobs

### Initial VPS approach

A separate Node.js worker process can run on the same VPS.

Example:

```text
VPS
 ├── Reverse Proxy
 ├── Frontend static/PWA
 ├── Express API
 ├── WebSocket/Realtime
 └── Background Worker
         ↓
      PostgreSQL
         ↓
     Object Storage
```

A message queue can be introduced when workload requires it.

---

# ADR-025 — Reverse Proxy and TLS

**Status:** Accepted

Use a production reverse proxy such as **Nginx** in front of the application.

Responsibilities:

- HTTPS termination
- HTTP → HTTPS redirect
- Static frontend delivery where appropriate
- API proxying
- WebSocket upgrade proxying
- Request size limits
- Basic rate limiting
- Security headers

Public traffic:

```text
Internet
   ↓
HTTPS
   ↓
Nginx
   ├── /        → PWA
   ├── /api     → Express
   └── /ws      → Realtime server
```

---

# ADR-026 — Do Not Over-Distributed the First Release

**Status:** Accepted

The initial deployment is intentionally simple:

```text
                VPS
                 │
        ┌────────┴─────────┐
        │                  │
   Web Application      Background Worker
        │                  │
        └────────┬─────────┘
                 │
            PostgreSQL
                 │
          Archive Storage
```

Do not introduce Kubernetes, service mesh, multiple database clusters, or many independent microservices unless real load or reliability requirements justify them.

The architecture must still preserve clean module boundaries so components can be extracted later.

---

# ADR-027 — Booking Is Authoritative on the Server

**Status:** Accepted

The client may display availability, but the client never reserves capacity.

The server/database determines:

- Slot availability
- Student eligibility
- Membership validity
- Booking count
- Violation/ban status
- Capacity
- Cancellation validity
- Gym closure status

Frontend availability is informational and may become stale between rendering and booking.

The final booking decision is always server-side.

---

# ADR-028 — Security Baseline

**Status:** Accepted

Required security controls include:

- HTTPS/TLS
- Google identity verification
- Secure application sessions
- RBAC
- Granular admin permissions
- Server-side authorization
- Encryption at rest where supported
- Encryption in transit
- Input validation
- SQL parameterization/ORM-safe queries
- CSRF protection where cookie-based state-changing requests are used
- Rate limiting
- Security headers
- Audit logging
- Secure secrets management
- Backup and disaster recovery
- Admin/trainer session timeout

Sensitive fields require stricter authorization.

Health and biometric data must never be exposed through generic student APIs.

---

# ADR-029 — Face Enrollment Policy

**Status:** Accepted

### Flow

```text
Google verified identity
      ↓
Student face enrollment
      ↓
One submission attempt
      ↓
Enrollment locked
```

The student cannot freely replace their face enrollment.

A change requires Admin intervention.

### Security goal

Prevent a student from replacing their own biometric enrollment with a friend's face.

### Storage

The exact representation and storage method are architecture decisions.

The system should minimize retention of raw biometric imagery.

---

# ADR-030 — Availability Target

**Status:** Accepted

The system is expected to be available **24/7**.

Exceptions:

- Planned maintenance
- College-controlled access-control outages
- Infrastructure failures

Critical operational failures must be visible to Admin.

The access-control process may be paused during hardware/integration failures as already defined.

---

# ADR-031 — Scale and Performance Baseline

**Status:** Accepted

### Population

```text
Current:       ~16,000 students
Expected:      ~25,000 students
```

The system must have headroom beyond 25,000.

### Important peak

The highest-risk workload is not merely total users. It is burst traffic during:

- New 3-day booking window opening
- Popular slot booking
- Simultaneous entry
- Simultaneous exit
- Live Trainer/Admin dashboards
- Notification fan-out

### Requirement

The architecture must sustain bursty concurrent booking traffic without exceeding slot capacity.

---

# ADR-032 — Operational Backups and Disaster Recovery

**Status:** Accepted

The deployment must include:

- PostgreSQL backups
- Off-VPS backup copies
- Backup encryption
- Restore testing
- Defined recovery procedures
- Archive-storage backup strategy
- Configuration/secret backup strategy where appropriate

A backup is not considered valid merely because a file was created; restore testing is required.

### Architecture detail

Exact:

- RPO
- RTO
- backup frequency
- retention

should be finalized based on college operational requirements.

---

# ADR-033 — Recommended Minimal Production Stack

**Status:** Accepted baseline

The first production release can use:

```text
Frontend
  Vite + React + TypeScript
  PWA

Backend
  Node.js + Express

Realtime
  WebSocket

Database
  PostgreSQL

Authentication
  Google Identity Services

Payments
  Razorpay Adapter

Reverse Proxy
  Nginx

Background Work
  Node.js Worker

Archive
  Object Storage + Parquet/Zstandard

Push
  Web Push / PWA push infrastructure

Deployment
  VPS
```

### Not required initially

- Kubernetes
- Microservice fleet
- Service mesh
- Dedicated API gateway
- Distributed cache
- Multiple databases
- Complex cloud orchestration

Add these only when actual requirements justify them.

---

# ADR-034 — Decisions Deliberately Deferred to Architecture

The following are **not business open questions anymore**. They are implementation/architecture decisions:

1. Exact PostgreSQL booking locking strategy.
2. WebSocket connection reliability/scaling for the turnstile/access-control integration.
3. Message broker/pub-sub choice if horizontal scaling is needed.
4. ZKBio CV API implementation.
5. Camera/face-recognition engine.
6. Biometric template/embedding storage mechanism.
7. PWA push implementation details.
8. Exact object-storage provider.
9. Archive query mechanism.
10. Background-job framework.
11. Reverse proxy configuration.
12. VPS sizing and capacity testing.
13. Monitoring/log aggregation.
14. Exact RPO/RTO.
15. Database indexing strategy.
16. Excel processing library and validation engine.

---

# Final Architecture Direction

The overall system direction is:

```text
                        INTERNET
                           │
                        HTTPS
                           │
                        NGINX
                           │
               ┌───────────┴───────────┐
               │                       │
             PWA                 WebSocket
       Vite + React + TS          Realtime
               │                       │
               └───────────┬───────────┘
                           │
                    Node.js / Express
                           │
        ┌──────────────────┼──────────────────┐
        │                  │                  │
      Modules           Worker            Integrations
        │                  │                  │
        │                  │          ┌───────┴────────┐
        │                  │          │                │
        │                  │       Razorpay       Access Adapter
        │                  │                           │
        │                  │                       ZKBio CV
        │                  │
        └────────────┬─────┘
                     │
                PostgreSQL
                     │
               Archive Layer
                     │
          Compressed Object Storage
```

The architecture intentionally keeps the first deployment **simple, VPS-friendly, modular, transactional, and replaceable at infrastructure boundaries**.

---

## Sources for Brand/Auth Decisions

- Rajalakshmi Engineering College official website: https://rajalakshmi.org/ citeturn579933view0
- Current REC visual identity is described as a purple-and-gold rebrand. citeturn479906search1
- Google Identity Services / Sign in with Google guidance: https://developers.google.com/identity/oauth2/web/guides/overview citeturn455452search0
- Google recommends the Authorization Code flow with PKCE for modern browser-based applications. citeturn455452search2
