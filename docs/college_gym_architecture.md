# College Gym System — Architecture Documentation

**Version:** 1.0  
**Status:** Architecture baseline  
**Date:** 2026-08-18

---

## 1. Architecture Overview

The College Gym System is a responsive Progressive Web App (PWA) for managing college gym access, bookings, memberships, trainers, staff, authorized persons, payments, attendance, access control, reporting, and administrative operations.

The initial deployment is intentionally **VPS-centric and simple**, while using modular boundaries so individual infrastructure components can be replaced or scaled later.

### Core technology decisions

| Area | Technology / Decision |
|---|---|
| Frontend | Vite + React + TypeScript (TSX) |
| Application type | Responsive PWA |
| Backend | Node.js + Express |
| Backend architecture | Modular Monolith |
| Database | PostgreSQL |
| ORM / DB access | Drizzle ORM + `pg` for specialized SQL |
| Cache / Queue | Redis |
| Background jobs | BullMQ |
| Object storage | MinIO on the same VPS |
| Reverse proxy | Nginx |
| Authentication | Google OAuth / Google Identity |
| Session storage | Redis-backed server sessions |
| Payments | Razorpay through a provider abstraction |
| Access-control transport | WebSocket, only for the turnstile/access-control integration |
| Current access-control platform | ZKBio CV |
| Time storage | UTC |
| Time presentation | IST (`Asia/Kolkata`) |
| Deployment | Docker Compose on a single VPS |

---

# 2. Architecture Principles

## 2.1 Keep the initial deployment simple

All production services initially run on a single VPS.

The system should not introduce microservices, Kubernetes, service meshes, or distributed infrastructure unless real requirements justify them.

## 2.2 Modular monolith over microservices

The Express backend is one deployable application but internally divided into clear business modules.

This provides:

- Simple deployment
- Simple transactions
- Easier debugging
- Strong domain boundaries
- A path to future module extraction

## 2.3 PostgreSQL is authoritative

PostgreSQL is the source of truth for business data.

Redis, MinIO, browser state, and WebSocket events must never become authoritative replacements for PostgreSQL.

## 2.4 File bytes should bypass the API

The backend authorizes and creates pre-signed URLs, while the browser transfers files directly to MinIO.

This prevents Express from becoming an unnecessary file-transfer bottleneck.

## 2.5 WebSocket has a narrow responsibility

WebSocket is **only for communication with the turnstile/access-control environment**.

It is not the general realtime transport for:

- Student dashboards
- Trainer dashboards
- Admin dashboards
- Booking updates
- General notifications

## 2.6 Server-side enforcement

The frontend may display availability and eligibility, but the backend/database enforce:

- Booking capacity
- Membership validity
- Booking-window rules
- Violations and bans
- Access authorization
- Administrative permissions

---

# 3. C4 Level 1 — System Context

```text
                           ┌─────────────────────────┐
                           │   College Student Data  │
                           │   Excel Source         │
                           └────────────┬────────────┘
                                        │
                                        │ import/export
                                        ▼

┌───────────────┐              ┌──────────────────────────────┐              ┌──────────────┐
│    Student    │─────────────▶│                              │◀─────────────│   Trainer    │
└───────────────┘              │     COLLEGE GYM SYSTEM       │              └──────────────┘
                               │                              │
┌───────────────┐              │        Responsive PWA        │              ┌──────────────┐
│     Staff     │─────────────▶│                              │◀─────────────│    Admin     │
└───────────────┘              │                              │              └──────────────┘
                               └───────────────┬──────────────┘
┌────────────────────┐                        │
│ Authorized Persons │────────────────────────┘
└────────────────────┘                        │
                                              │
                          ┌───────────────────┼───────────────────┐
                          │                                       │
                          ▼                                       ▼
                 ┌────────────────┐                       ┌──────────────────┐
                 │    Razorpay    │                       │     ZKBio CV     │
                 │    Payments    │                       │ Access Control   │
                 └────────────────┘                       └─────────┬────────┘
                                                                    │
                                                                    ▼
                                                             Cameras / Turnstile
```

## 3.1 External actors and systems

### Student

Uses the PWA to:

- Authenticate with Google
- View profile
- Book gym slots
- Cancel bookings
- Purchase memberships when applicable
- View active/queued membership
- View booking and attendance history
- View entry/exit history
- View violation/ban status
- Receive push notifications

### Trainer

Uses the PWA to:

- See students associated with the current slot
- See students whose slot has expired but who remain inside
- Identify those students using photo and basic academic information
- View current occupancy
- View their own entry/exit and working hours

### Staff

Uses the PWA to:

- View their own entry/exit history
- View their time spent in the gym

Staff do not require student-style booking or membership constraints.

### Authorized Person

Admin-created individuals who are neither students nor staff.

Examples:

- Owner
- Authorized outsider
- Maintenance person
- Guest
- Other college-approved individuals

They receive a dedicated dashboard and do not require normal student booking/membership eligibility.

### Admin

Manages the gym CRM, including:

- Students
- Staff
- Authorized persons
- Memberships
- Plans
- Slots
- Gym calendar
- Trainers
- Payments
- Conflicts
- Reports
- Data lifecycle
- System configuration
- Admin permissions within their granted scope

### Super Admin

Has unrestricted permissions and manages the permission model for other admins.

A protected primary Super Admin identity cannot be deleted through normal application operations.

### Razorpay

Initial Day Scholar payment provider.

The payment integration uses an abstraction layer so the provider can be replaced later.

### ZKBio CV

Current planned access-control platform.

The application integrates through an isolated access-control adapter and the approved WebSocket transport.

---

# 4. C4 Level 2 — Container Architecture

```text
                                   INTERNET
                                       │
                                       ▼
                              ┌──────────────────┐
                              │      NGINX       │
                              │ Reverse Proxy    │
                              │ HTTPS / TLS      │
                              └────────┬─────────┘
                                       │
                    ┌──────────────────┼────────────────────┐
                    │                  │                    │
                    ▼                  ▼                    ▼
             ┌─────────────┐   ┌──────────────┐   ┌────────────────┐
             │     PWA     │   │ Express API  │   │ Access WS      │
             │ Vite/React  │   │ Modular      │   │ Turnstile only │
             │ TypeScript  │   │ Monolith     │   │                │
             └─────────────┘   └──────┬───────┘   └───────┬────────┘
                                      │                   │
                  ┌───────────────────┼───────────────────┘
                  │                   │
                  ▼                   ▼
          ┌───────────────┐    ┌───────────────┐
          │  PostgreSQL   │    │     Redis     │
          │ Source of Truth│   │ Sessions/Queue│
          └───────────────┘    └───────┬───────┘
                                      │
                                  BullMQ jobs
                                      │
                                      ▼
                               ┌───────────────┐
                               │    Worker     │
                               │ Background    │
                               │ Processing    │
                               └───────┬───────┘
                                       │
                         ┌─────────────┼─────────────┐
                         │                           │
                         ▼                           ▼
                  ┌───────────────┐           ┌───────────────┐
                  │    MinIO      │           │   External    │
                  │ Object Store  │           │ Integrations  │
                  └───────────────┘           └───────┬───────┘
                                                      │
                                          ┌───────────┴───────────┐
                                          │                       │
                                          ▼                       ▼
                                      Razorpay                 ZKBio CV
```

---

# 5. Single-VPS Deployment

All containers run on the same physical/virtual VPS.

## 5.1 Docker Compose services

Recommended services:

```text
nginx
frontend
api
worker
postgres
redis
minio
```

The turnstile/access-control WebSocket may initially run inside the backend deployment or as a separately scaled process/container, but its logical boundary remains separate.

## 5.2 Internal networking

Only Nginx should expose public application ports.

Internal services communicate through a private Docker network.

```text
Internet
   │
 HTTPS
   ▼
Nginx
   ├── PWA
   ├── API
   └── Access WebSocket
            │
            ▼
     Private Docker Network
       ├── PostgreSQL
       ├── Redis
       ├── MinIO
       └── Worker
```

PostgreSQL, Redis, and MinIO should not be directly internet-accessible.

---

# 6. Storage Layout

Persistent data is separated into dedicated Docker volumes/directories.

Recommended host layout:

```text
/srv/gym/
├── app/
├── nginx/
├── postgres/
├── redis/
├── minio/
└── backups/
```

## 6.1 PostgreSQL

Stores authoritative business data.

## 6.2 Redis

Stores:

- Server sessions
- BullMQ queues
- Job metadata
- Short-lived coordination
- Rate-limiting state
- Optional cache entries

Redis is never authoritative for business records.

## 6.3 MinIO

Stores:

- Excel uploads
- Generated reports
- General application files
- Long-term archive objects
- Restricted face/image data as required by the access-control integration

PostgreSQL stores object metadata and references.

---

# 7. File Transfer Architecture

Large files should not pass through Express unnecessarily.

## 7.1 Upload

```text
Browser
   │
   │ request upload authorization
   ▼
Express
   │
   ├── authorize user
   ├── validate file metadata
   └── generate pre-signed URL
                │
                ▼
              Browser
                │
                │ direct upload
                ▼
              MinIO
```

## 7.2 Download

```text
Browser
   │
   │ request file
   ▼
Express
   │
   ├── authorize
   └── generate pre-signed URL
                │
                ▼
              Browser
                │
                │ direct download
                ▼
              MinIO
```

This keeps Express focused on authorization and business logic instead of transferring large file payloads.

---

# 8. Backend Architecture — Modular Monolith

The Express backend is internally divided into modules.

```text
Express Backend
│
├── auth
├── identity
├── students
├── staff
├── authorized-persons
├── bookings
├── slots
├── memberships
├── payments
├── access
├── face
├── trainers
├── notifications
├── conflicts
├── audit
├── reports
├── imports
├── archive
└── administration
```

## 8.1 Recommended module structure

Each major module follows:

```text
module/
├── controller/
├── routes/
├── service/
├── repository/
├── validation/
├── types/
└── domain/
```

Shared infrastructure:

```text
shared/
├── database/
├── auth/
├── errors/
├── logging/
├── config/
├── events/
├── storage/
└── security/
```

## 8.2 Dependency direction

Preferred:

```text
HTTP Controller
      ↓
Application Service
      ↓
Domain Service
      ↓
Repository
      ↓
PostgreSQL
```

Business modules should not directly modify another module's tables.

Example:

```text
Booking Service
      ↓
Membership Service
      ↓
Membership Repository
      ↓
PostgreSQL
```

instead of:

```text
Booking Repository
      ↓
directly reading/writing membership tables
```

---

# 9. Database Access

## 9.1 ORM

Use **Drizzle ORM** for normal application queries and schema/migration management.

## 9.2 Raw PostgreSQL

Use `pg` / raw SQL for specialized operations such as:

- High-concurrency booking transactions
- Locking
- Complex reporting
- Bulk operations
- Archival queries
- Performance-sensitive SQL

Architecture:

```text
Application Service
     │
     ├── Drizzle → normal queries
     │
     └── pg/raw SQL → specialized PostgreSQL operations
```

---

# 10. PostgreSQL Schema Organization

Use logical PostgreSQL schemas to keep domains separated.

Recommended high-level schemas:

```text
identity
people
booking
membership
access
payment
trainer
admin
audit
archive
notification
```

This is a logical organization boundary. It does not imply separate databases.

---

# 11. Authentication Architecture

Use Google OAuth / Google Identity Services.

```text
Browser
   │
   ▼
Google
   │
   │ verified identity
   ▼
Express
   │
   ├── lookup provisioned college record
   ├── validate active status
   └── create application session
            │
            ▼
          Redis
```

## 11.1 Important identity rule

Google identity proves account ownership.

The application's PostgreSQL records determine:

- Person type
- Active/inactive state
- Residency
- Permissions
- Gym eligibility

The system does not allow arbitrary self-registration.

---

# 12. Session Architecture

Use server-side application sessions.

Browser stores only the session identifier in:

```text
HttpOnly
Secure
SameSite
```

cookie.

Redis stores the session state.

## Default inactivity policy

| User | Default inactivity |
|---|---:|
| Student | 7 days |
| Staff | 7 days |
| Authorized Person | 7 days |
| Trainer | 3 days |
| Admin | 8 hours |
| Super Admin | 4 hours |

Sensitive operations may require re-authentication.

Sessions must be revoked when:

- Account becomes inactive
- Student leaves college
- Admin permissions change
- Explicit logout-all is performed

---

# 13. Redis Architecture

Redis is a supporting infrastructure component.

```text
Redis
├── Sessions
├── BullMQ queues
├── Rate limits
├── Temporary coordination
└── Optional short-lived cache
```

Redis persistence:

- AOF and/or RDB
- Persistent Docker volume
- Recovery tested during operations

Redis data never replaces authoritative PostgreSQL state.

---

# 14. Background Processing

Use **BullMQ + Redis**.

Workers handle long-running operations.

```text
Express
   ↓
BullMQ
   ↓
Redis
   ↓
Worker
```

## Jobs

Examples:

```text
excel.process
report.generate
archive.move
archive.anonymize
payment.reconcile
notification.push
face.sync
```

## Requirements

- Retry with controlled backoff
- Failure state
- Job result/status
- Idempotency where required
- Concurrency limits
- Delayed jobs
- Admin visibility for important failed jobs

---

# 15. Access-Control Architecture

The access-control boundary is intentionally isolated.

```text
                    Core System
                        │
                  Access Service
                        │
                Access-Control Adapter
                        │
                 Access WebSocket
                        │
                    ZKBio CV
                        │
             Camera / Turnstile
```

## 15.1 WebSocket scope

WebSocket is only for:

- Access authorization
- Entry/exit events
- Device synchronization
- Device health
- Access-control alerts
- Face synchronization payloads/events

It is not the general application realtime channel.

---

# 16. Face Enrollment Architecture

Face enrollment is one of the most security-sensitive workflows.

## 16.1 Enrollment

```text
Student
   ↓
Google identity verified
   ↓
Face enrollment submission
   ↓
Express
   ├── PostgreSQL → metadata/status
   └── restricted VPS image storage
          ↓
      BullMQ job
          ↓
     Access Worker
          ↓
   Access WebSocket
          ↓
        ZKBio CV
```

## 16.2 Enrollment policy

- Student receives one enrollment attempt.
- Student cannot independently replace it.
- Failed or changed enrollment requires Admin intervention.
- Synchronization to ZKBio CV is asynchronous.
- Sync state is persisted.

Example:

```text
PENDING
   ↓
SYNCING
   ↓
SYNCED

or

SYNCING
   ↓
FAILED
   ↓
ADMIN ACTION
```

---

# 17. Booking Architecture

Booking is one of the most concurrency-sensitive domains.

## 17.1 Client view

The PWA displays currently available capacity.

This is not authoritative.

## 17.2 Booking transaction

```text
POST /booking
      ↓
Validate authenticated student
      ↓
Validate active membership/eligibility
      ↓
Validate booking window
      ↓
Validate cancellation/ban state
      ↓
Atomic capacity check
      ↓
Create booking
      ↓
Commit transaction
```

## 17.3 Capacity

Default:

```text
100 students / slot
```

Admin can configure capacity.

The capacity must never exceed its configured limit even when many users book simultaneously.

---

# 18. Booking Window Rules

Default business rules:

- 3 applicable open days
- Up to 3 slots during the window
- 50-minute slot duration
- 10-minute buffer
- Started/past slots cannot be booked
- Capacity default 100
- Admin can configure operational slot settings
- Closed dates are ignored in the booking-window calculation

During the 10-minute buffer:

- Ending-slot students may exit.
- Next-slot students may enter.

---

# 19. Cancellation / No-Show Architecture

Student cancellation:

- Allowed until slot start
- Releases capacity immediately
- Available to another eligible student

Violations:

```text
Student cancellation
       +
Student no-show
       ↓
Unified violation counter
```

Default:

```text
3rd violation
    ↓
3-day gym ban
```

Threshold and ban duration are Admin-configurable.

Gym-initiated cancellation does not count as a student violation.

---

# 20. Membership Architecture

Membership module manages:

```text
Plan
  ↓
Purchase
  ↓
Payment
  ↓
Active Membership
  ↓
Optional Queued Membership
```

Rules:

- One active membership
- Maximum one queued membership
- No overlapping active memberships
- Queued membership starts automatically after active membership expiry
- Plan duration and price are Admin-configurable

---

# 21. Payment Architecture

Use a provider abstraction:

```text
Membership
    ↓
Payment Service
    ↓
Payment Provider Interface
    ↓
Razorpay Adapter
    ↓
Razorpay
```

Razorpay is the initial provider.

The system must reconcile delayed or repeated payment notifications safely.

Payment records are maintained independently of the external gateway's API availability.

---

# 22. Staff and Authorized Person Architecture

## Staff

Staff bypass:

- Membership requirement
- Slot booking requirement
- Student booking-window rules

Their access is still logged.

Dashboard:

```text
Entry
Exit
Hours spent
```

## Authorized Persons

Admin-created, non-student/non-staff users.

They:

- Have no membership requirement
- Have no booking requirement
- Can be activated/deactivated by Admin
- Have access logs
- Have a dedicated dashboard

---

# 23. Data Lifecycle Architecture

```text
Operational PostgreSQL
        │
        │ archive job
        ▼
Compressed Archive Objects
        │
        │ after 7-year policy threshold
        ▼
Anonymization
        │
        ▼
Retained non-identifying data / deletion
```

## Hot database

Contains operationally useful data.

## Archive

Long-term historical information is stored in MinIO using cost-efficient formats such as:

```text
Parquet + Zstandard
```

## Anonymization

Handled by BullMQ worker jobs and controlled from Admin.

Every archive/anonymization action is audited.

Sensitive biometric/health information has stricter handling than generic operational records.

---

# 24. Time Handling

All authoritative timestamps are stored in UTC.

PostgreSQL:

```text
TIMESTAMPTZ
```

Presentation:

```text
Asia/Kolkata
```

Example:

```text
Stored:
2026-08-18T15:00:00Z

Displayed:
18 Aug 2026, 20:30 IST
```

No hard-coded `+05:30` arithmetic should be used.

---

# 25. Reporting Architecture

Large reports should be generated asynchronously.

```text
Admin
  ↓
Report request
  ↓
BullMQ
  ↓
Worker
  ↓
Query PostgreSQL / Archive
  ↓
Generate Excel / CSV / PDF
  ↓
Store result in MinIO
  ↓
Return pre-signed download URL
```

All reports use controlled:

```text
From
To
```

date ranges.

---

# 26. Audit Architecture

Sensitive administrative changes generate audit events.

Example:

```text
Admin A
   ↓
Student residency changed
   ↓
Audit Event
   ├── Actor
   ├── Timestamp
   ├── Entity
   ├── Previous value
   ├── New value
   ├── Reason
   ├── Request/correlation ID
   └── Context
```

Audit records are authoritative historical records and should not be silently modified.

---

# 27. Error and Conflict Architecture

The system must log conflicts rather than inventing facts.

Examples:

- Entry exists without exit
- Exit appears without entry
- Duplicate machine event
- Invalid membership state
- Unexpected access state
- Machine synchronization failure
- Payment inconsistency
- Import conflict

Conflict records should preserve as much relevant context as available.

The application does not resolve uncertain physical events through prediction.

---

# 28. Deployment Diagram

```text
                              INTERNET
                                  │
                                  ▼
                       ┌─────────────────────┐
                       │        NGINX        │
                       │ TLS / Reverse Proxy │
                       └──────────┬──────────┘
                                  │
       ┌──────────────────────────┼──────────────────────────┐
       │                          │                          │
       ▼                          ▼                          ▼
┌──────────────┐          ┌───────────────┐          ┌──────────────┐
│ PWA Container│          │ API Container │          │ Access WS    │
│ React/Vite   │          │ Node/Express  │          │ / Integration│
└──────────────┘          └───────┬───────┘          └──────┬───────┘
                                  │                         │
                           Internal Docker Network          │
                                  │                         │
                    ┌─────────────┼───────────────┐         │
                    │             │               │         │
                    ▼             ▼               ▼         ▼
              PostgreSQL       Redis            MinIO    ZKBio CV
              Container      Container        Container   System
                    │             │               │
                    │             │               │
                    │          BullMQ             │
                    │             │               │
                    │             ▼               │
                    │        Worker               │
                    │        Container             │
                    │             │               │
                    └─────────────┴───────────────┘

                        Docker Persistent Volumes
```

---

# 29. Recommended Directory Structure

```text
/srv/gym/
├── compose.yml
├── .env
├── app/
│   ├── backend/
│   ├── frontend/
│   └── worker/
├── nginx/
│   └── conf.d/
├── postgres/
├── redis/
├── minio/
└── backups/
```

The exact host directory structure can change, but every persistent service must have an explicitly managed volume.

---

# 30. Architecture Rules for Implementation

1. PostgreSQL is authoritative.
2. Redis is never authoritative.
3. MinIO stores bytes; PostgreSQL stores metadata/references.
4. Express should not stream ordinary large files when a pre-signed URL is possible.
5. Business modules communicate through services/interfaces rather than cross-writing tables.
6. Booking capacity is enforced transactionally.
7. Face synchronization is asynchronous.
8. Access-control WebSocket is isolated from normal application traffic.
9. Vendor-specific ZKBio CV logic stays behind an adapter.
10. Production database migrations are explicit deployment steps.
11. Long-running operations use BullMQ workers.
12. Sensitive operations are audited.
13. All timestamps are stored in UTC and displayed in IST.
14. The PWA must support both mobile and wide desktop layouts.
15. The theme defaults to System and supports Light/Dark modes.
16. The official Rajalakshmi visual identity is used for the brand layer.
17. The initial deployment remains a single VPS with Docker Compose.
18. The architecture should allow future horizontal scaling without changing business contracts.

---

# 31. Next Architecture Deliverables

The next architecture artifacts should be:

### C4 Level 3 Component Diagrams

- Booking & Slot Management
- Identity & RBAC
- Membership & Payments
- Access Control & Face Synchronization
- Import & Data Lifecycle
- Reports & Notifications

### ER Diagram

The database model should cover at minimum:

- People
- Students
- Staff
- Authorized Persons
- Roles
- Permissions
- Membership Plans
- Memberships
- Bookings
- Slots
- Gym Calendar / Closures
- Access Sessions
- Entry/Exit Logs
- Violations/Bans
- Face Enrollment / Sync State
- Payments
- Trainer Work Records
- Notifications
- Conflicts
- Audit Logs
- Import Jobs
- Archive/Anonymization Jobs

### Sequence Diagrams

- Student booking
- Booking cancellation
- Student entry
- Student exit
- Face enrollment
- Face synchronization
- Membership purchase
- Excel import
- Student departure
- Student reactivation
- Archive/anonymization

### Deployment Detail

- Docker Compose service definitions
- Internal networking
- Volumes
- Nginx routing
- Health checks
- Backup jobs
- Secrets/configuration management
- VPS resource sizing
