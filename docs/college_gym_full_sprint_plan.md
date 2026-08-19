# College Gym System — Full Sprint Plan

**Version:** 1.0  
**Planning basis:** Finalized SRS + User Stories + Architecture Baseline  
**Sprint length:** 2 weeks  
**Delivery model:** Scrum / iterative delivery  
**Initial plan:** 14 sprints + stabilization/release hardening  
**Primary deployment:** Single VPS with Docker Compose  
**Architecture:** Modular Monolith

---

# 1. Planning Assumptions

## Team assumption

This plan assumes a small engineering team. The work is structured so backend, frontend, infrastructure, and QA can proceed in parallel where dependencies allow.

Suggested roles:

| Role | Primary responsibility |
|---|---|
| Tech Lead / Backend | Architecture, backend, DB, integrations |
| Frontend Engineer | PWA and responsive UI |
| Full-Stack Engineer | Cross-module implementation |
| QA / Automation | Test strategy, regression, acceptance |
| DevOps-capable Engineer | Docker, VPS, Nginx, observability, backups |

A smaller team can still execute the plan, but some parallel work will become sequential.

---

# 2. Sprint Cadence

Each sprint is **2 weeks**.

### Sprint structure

```text
Day 1
  Sprint planning
  ↓
Days 2–8
  Development
  ↓
Days 9–10
  Integration + QA
  ↓
Days 11–12
  Fixes + regression
  ↓
Days 13–14
  Acceptance + demo + retrospective
```

Every sprint should end with a deployable increment.

---

# 3. Release Strategy

The project should use staged releases:

```text
Sprint 1–3
Foundation

Sprint 4–7
Core Student / Booking / Membership

Sprint 8–10
Access Control / Trainers / Staff

Sprint 11–12
Admin / Reports / Lifecycle

Sprint 13
System Integration

Sprint 14
Hardening / UAT

Release Candidate
      ↓
Production
```

---

# 4. Definition of Done

A story is Done only when:

- Code is implemented
- Code review is complete
- Unit tests cover important logic
- Integration tests exist where applicable
- Database migrations are included
- API validation/error handling is implemented
- Authorization is tested
- Responsive UI works on mobile and wide desktop where applicable
- Accessibility basics are checked
- Logging/audit requirements are implemented where applicable
- No known critical/high-severity defect remains
- Documentation is updated
- Feature is deployed to the test/staging environment
- Acceptance criteria pass

---

# 5. Definition of Ready

A story is Ready when:

- Requirement is understood
- Dependencies are known
- Acceptance criteria exist
- UI/API behavior is sufficiently defined
- Data impact is understood
- Security implications are known
- The story is small enough to complete within the sprint

---

# 6. Epic Map

| Epic | Main scope |
|---|---|
| E01 | Platform & DevOps Foundation |
| E02 | Identity & Authentication |
| E03 | People / Student / Staff / Authorized Persons |
| E04 | Roles & Permissions |
| E05 | Gym Calendar / Slots |
| E06 | Booking |
| E07 | Membership |
| E08 | Payments |
| E09 | Access Control / Face |
| E10 | Trainer |
| E11 | Staff / Authorized Person |
| E12 | Notifications |
| E13 | Conflicts / Audit |
| E14 | Reports |
| E15 | Data Lifecycle / Archive |
| E16 | Admin CRM |
| E17 | Security / Reliability |
| E18 | QA / Performance / Release |

---

# 7. Sprint 1 — Engineering Foundation

## Goal

Establish a reproducible development and deployment foundation.

### Stories / Tasks

#### INF-001 — Initialize monorepo/repository structure
- Frontend
- Backend
- Worker
- Shared types/utilities where appropriate

#### INF-002 — Initialize Vite + React + TypeScript PWA

#### INF-003 — Initialize Node.js + Express modular monolith

#### INF-004 — Configure TypeScript, ESLint, formatting and commit conventions

#### INF-005 — Create Docker Compose environment

Services:

```text
nginx
frontend
api
worker
postgres
redis
minio
```

#### INF-006 — Configure internal Docker networking

#### INF-007 — Configure persistent Docker volumes

```text
postgres
redis
minio
backups
```

#### INF-008 — Configure Nginx reverse proxy

Routes:

```text
/
 /api
 /access
```

#### INF-009 — HTTPS/TLS setup

#### INF-010 — Environment/configuration strategy

Separate:

```text
development
test
production
```

### Backend foundation

#### INF-011 — Application error model

#### INF-012 — Structured logging

#### INF-013 — Request correlation IDs

#### INF-014 — Health endpoints

```text
/health/live
/health/ready
```

#### INF-015 — Database migration workflow

Explicit deployment migration command.

### Deliverable

A blank PWA + API + Worker + PostgreSQL + Redis + MinIO stack deployable on one VPS.

### Exit criteria

- All containers start
- Health checks pass
- HTTPS works
- PostgreSQL persists data
- Redis persists data
- MinIO persists data
- Deployment can be recreated from Compose

---

# 8. Sprint 2 — Identity & Authentication

## Goal

Implement trusted user identity and session management.

### Stories

#### AUTH-001 — Google OAuth integration

#### AUTH-002 — Provisioned-user verification

A user cannot self-register unless a matching college-provisioned record exists.

#### AUTH-003 — Internal identity model

#### AUTH-004 — Redis-backed server sessions

#### AUTH-005 — Secure HttpOnly/Secure/SameSite cookies

#### AUTH-006 — Session expiration by role

Defaults:

| Role | Inactivity |
|---|---:|
| Student | 7 days |
| Staff | 7 days |
| Authorized Person | 7 days |
| Trainer | 3 days |
| Admin | 8 hours |
| Super Admin | 4 hours |

#### AUTH-007 — Logout

#### AUTH-008 — Logout all sessions

#### AUTH-009 — Session revocation

Account disablement, student departure, and permission changes.

#### AUTH-010 — Unauthorized access handling

### Security tests

- OAuth identity mismatch
- Unprovisioned user
- Disabled account
- Expired session
- Revoked session
- Cross-user session access

### Exit criteria

A provisioned person can authenticate and receive an application session according to their role.

---

# 9. Sprint 3 — People / Excel Onboarding

## Goal

Build the college data ingestion foundation.

### Student import

#### PEOPLE-001 — Excel template definition

Student fields:

- Roll number
- Name
- Email
- Phone
- Department
- Joining year
- Residency
- Face enrollment status/reference
- Emergency contact
- Address
- Health concerns

#### PEOPLE-002 — Excel upload to MinIO

Browser → pre-signed URL → MinIO.

#### PEOPLE-003 — Import job creation

#### PEOPLE-004 — BullMQ Excel processing

#### PEOPLE-005 — Row validation

#### PEOPLE-006 — Duplicate detection

#### PEOPLE-007 — Import result report

Status:

```text
Success
Warning
Rejected
Conflict
```

#### PEOPLE-008 — Student account provisioning

#### PEOPLE-009 — Staff import

#### PEOPLE-010 — Authorized-person CRUD

#### PEOPLE-011 — Authorized-person dashboard

### Exit criteria

Admin can upload the defined Excel format and obtain a validated processing result.

---

# 10. Sprint 4 — RBAC / Admin Foundation

## Goal

Implement the security and administrative permission system.

### Stories

#### RBAC-001 — Role model

#### RBAC-002 — Permission model

Example permissions:

```text
students.read
students.write
bookings.manage
memberships.manage
payments.reconcile
trainers.manage
reports.export
archive.manage
audit.read
system.configure
admins.manage
```

#### RBAC-003 — Super Admin

#### RBAC-004 — Protected primary Super Admin

#### RBAC-005 — Admin role creation

#### RBAC-006 — Permission assignment

#### RBAC-007 — Permission checks at API layer

#### RBAC-008 — Permission-aware UI

#### RBAC-009 — Admin management audit trail

#### RBAC-010 — Sensitive-action reason requirement

### Exit criteria

A Super Admin can create admins with granular permissions and authorization is enforced server-side.

---

# 11. Sprint 5 — Gym Calendar & Slot Configuration

## Goal

Build the configurable gym schedule.

### Stories

#### SLOT-001 — Gym configuration model

Admin-configurable:

- Opening time
- Closing time
- Slot duration
- Buffer duration
- Capacity
- Booking rules
- Maximum bookings
- Operating days

#### SLOT-002 — Default slot configuration

Defaults:

```text
50-minute slot
10-minute buffer
100 capacity
```

#### SLOT-003 — Slot generation

#### SLOT-004 — Three-day booking-window calculation

#### SLOT-005 — Closed-day support

#### SLOT-006 — Closure reason

#### SLOT-007 — Closure visibility

#### SLOT-008 — Closure cancellation

Affected bookings are cancelled and students are notified.

#### SLOT-009 — Closed-day exclusion from booking window

#### SLOT-010 — Slot availability API

#### SLOT-011 — Admin slot management UI

### Exit criteria

Admin can configure and manage gym operating periods and slots.

---

# 12. Sprint 6 — Core Booking Engine

## Goal

Implement the concurrency-sensitive booking engine.

This is a critical sprint.

### Stories

#### BOOK-001 — Create booking

#### BOOK-002 — Validate booking eligibility

Checks:

- Active account
- Membership/eligibility
- Active ban
- Slot state
- Window
- Booking allowance

#### BOOK-003 — Enforce maximum 3 slots/window

#### BOOK-004 — Prevent booking of started/past slots

#### BOOK-005 — Transactional capacity enforcement

Default:

```text
100 per slot
```

#### BOOK-006 — Prevent duplicate booking

#### BOOK-007 — Concurrent booking protection

#### BOOK-008 — Booking state model

```text
Booked
Attended
Completed
No-show
Cancelled by student
Cancelled by gym
Expired
Rejected
```

#### BOOK-009 — Cancellation

Allowed until slot start.

#### BOOK-010 — Capacity release after cancellation

#### BOOK-011 — Booking history

#### BOOK-012 — Access/attendance state model

```text
Not entered
Inside
Exited
```

#### BOOK-013 — Violation counter

#### BOOK-014 — No-show processing

#### BOOK-015 — Configurable ban policy

Default:

```text
3rd violation
3-day ban
```

#### BOOK-016 — Booking transaction audit

### Performance tests

- 100 concurrent bookings
- 500 concurrent bookings
- 1,000 concurrent requests
- Last-seat contention
- Duplicate submission
- Cancellation while another user books

### Exit criteria

Capacity can never exceed the configured slot limit under concurrent load.

---

# 13. Sprint 7 — Memberships

## Goal

Implement Day Scholar memberships and Hosteller eligibility.

### Stories

#### MEM-001 — Membership plan CRUD

Admin defines:

- Name
- Duration
- Unit
- Price
- Status

#### MEM-002 — Active membership

#### MEM-003 — One active membership constraint

#### MEM-004 — One queued membership

#### MEM-005 — Automatic queued-membership activation

#### MEM-006 — Membership history

#### MEM-007 — Membership expiry

#### MEM-008 — Booking validity within membership

#### MEM-009 — Hosteller free eligibility

#### MEM-010 — Day Scholar membership eligibility

#### MEM-011 — Residency change handling

#### MEM-012 — Membership administration UI

### Exit criteria

Membership and eligibility rules are fully enforced by backend services.

---

# 14. Sprint 8 — Razorpay Payments

## Goal

Integrate payments without coupling business logic directly to Razorpay.

### Stories

#### PAY-001 — Payment provider interface

#### PAY-002 — Razorpay adapter

#### PAY-003 — Create payment

#### PAY-004 — Payment success handling

#### PAY-005 — Payment failure handling

#### PAY-006 — Payment webhook/callback verification

#### PAY-007 — Idempotent payment reconciliation

#### PAY-008 — Membership activation after successful payment

#### PAY-009 — Payment history

#### PAY-010 — Student receipt/confirmation

#### PAY-011 — Admin payment reconciliation

#### PAY-012 — Payment audit logging

### Exit criteria

A Day Scholar can securely purchase a membership and membership activation follows verified payment success.

---

# 15. Sprint 9 — Notifications

## Goal

Implement push notification infrastructure.

### Stories

#### NOTIF-001 — Web Push setup

#### NOTIF-002 — Device subscription management

#### NOTIF-003 — Booking confirmation notification

#### NOTIF-004 — 15-minute reminder

Admin-configurable.

#### NOTIF-005 — Cancellation notification

#### NOTIF-006 — Gym closure notification

#### NOTIF-007 — Membership notification

#### NOTIF-008 — Payment notification

#### NOTIF-009 — No-show/ban notification

#### NOTIF-010 — Admin announcements

#### NOTIF-011 — Push job via BullMQ

#### NOTIF-012 — Notification failure retry

### Explicit non-goal

Email notification is not implemented.

### Exit criteria

Push notifications work reliably across supported PWA browsers/devices.

---

# 16. Sprint 10 — Entry / Exit / Access Domain

## Goal

Build the backend access-control domain without final machine coupling.

### Stories

#### ACCESS-001 — Access session model

#### ACCESS-002 — Entry record

#### ACCESS-003 — Exit record

#### ACCESS-004 — Current presence state

#### ACCESS-005 — Entry eligibility service

Checks:

- Identity
- Booking
- Membership/eligibility
- Time/slot
- Ban
- Already inside

#### ACCESS-006 — Exit processing

#### ACCESS-007 — Buffer behavior

During buffer:

- Current-slot users may exit
- Next-slot users may enter

#### ACCESS-008 — Conflict detection

#### ACCESS-009 — Access alert model

#### ACCESS-010 — Access-control adapter interface

### Exit criteria

The business rules for machine-driven entry/exit exist independently of hardware.

---

# 17. Sprint 11 — ZKBio / WebSocket / Face Synchronization

## Goal

Implement asynchronous access-control integration.

### Stories

#### ACINT-001 — WebSocket access-control channel

WebSocket is dedicated only to turnstile/access-control communication.

#### ACINT-002 — Device authentication

#### ACINT-003 — Device connection health

#### ACINT-004 — Connection reconnect

#### ACINT-005 — Access authorization transport

#### ACINT-006 — Entry/exit event ingestion

#### ACINT-007 — Device failure detection

#### ACINT-008 — Admin access-control alert

#### ACINT-009 — Face enrollment status

#### ACINT-010 — Restricted face/image storage

#### ACINT-011 — Face sync BullMQ job

#### ACINT-012 — Worker → WebSocket → ZKBio CV synchronization

#### ACINT-013 — Sync result recording

States:

```text
Pending
Syncing
Synced
Failed
Admin Action Required
```

#### ACINT-014 — Face update/re-enrollment admin flow

### Important rule

Student-facing enrollment does not wait for machine synchronization to finish.

### Exit criteria

Face enrollment and access-control synchronization operate asynchronously and failure states are visible.

---

# 18. Sprint 12 — Trainer / Staff / Authorized Person Operations

## Trainer

#### TRAIN-001 — Trainer current-slot dashboard

#### TRAIN-002 — Current students list

#### TRAIN-003 — Overstayer list

#### TRAIN-004 — Student identification details

Show:

- Photo
- Roll number
- Name
- Joining year
- Department
- Booking/slot information
- Entry status

#### TRAIN-005 — Current gym occupancy

#### TRAIN-006 — Trainer entry/exit tracking

#### TRAIN-007 — Trainer working hours

#### TRAIN-008 — Trainer stipend calculation

Hourly rate configured by Admin.

## Staff

#### STAFF-001 — Staff access

#### STAFF-002 — Staff dashboard

#### STAFF-003 — Staff hours calculation

## Authorized Persons

#### AUTH-001 — Authorized-person activation

#### AUTH-002 — Authorized-person access logs

#### AUTH-003 — Authorized-person dashboard

#### AUTH-004 — Immediate revocation

### Exit criteria

Trainer, staff, and authorized-person workflows are independently usable.

---

# 19. Sprint 13 — Admin CRM / Reports / Conflicts

## Goal

Complete operational administration.

### Admin CRM

#### ADMIN-001 — Student search

#### ADMIN-002 — Advanced filtering

#### ADMIN-003 — Student profile management

#### ADMIN-004 — Staff management

#### ADMIN-005 — Authorized-person management

#### ADMIN-006 — Membership management

#### ADMIN-007 — Slot management

#### ADMIN-008 — Trainer management

#### ADMIN-009 — Gym calendar

#### ADMIN-010 — Configuration center

## Conflicts

#### CON-001 — Conflict list

#### CON-002 — Conflict detail

#### CON-003 — Preserve original event context

#### CON-004 — Resolution recording

#### CON-005 — Conflict audit history

## Reports

#### REP-001 — Attendance report

#### REP-002 — Slot utilization

#### REP-003 — Membership/revenue

#### REP-004 — Membership status

#### REP-005 — Entry/exit

#### REP-006 — Violations

#### REP-007 — Trainer hours/stipend

#### REP-008 — Gym closures

#### REP-009 — Conflicts

#### REP-010 — Audit report

#### REP-011 — Excel export

#### REP-012 — CSV export

#### REP-013 — PDF export

#### REP-014 — From/To filters

### Exit criteria

Admin can operate the gym without direct database access.

---

# 20. Sprint 14 — Archive / Retention / Security

## Goal

Complete lifecycle management and harden security.

### Archive

#### ARC-001 — Archive policy configuration

#### ARC-002 — Eligibility detection

#### ARC-003 — Archive worker

#### ARC-004 — Parquet export

#### ARC-005 — Compression with Zstandard

#### ARC-006 — Archive metadata

#### ARC-007 — Historical retrieval

#### ARC-008 — Seven-year anonymization workflow

#### ARC-009 — Anonymization audit

#### ARC-010 — Data lifecycle dashboard

### Student departure

#### ARC-011 — Leaving-student Excel import

#### ARC-012 — Active access termination

#### ARC-013 — Move operational records out of hot storage

#### ARC-014 — Reactivation

#### ARC-015 — Reactivation audit

### Security

#### SEC-001 — API authorization review

#### SEC-002 — Sensitive-data access review

#### SEC-003 — Health-data restrictions

#### SEC-004 — Face-data restrictions

#### SEC-005 — Rate limiting

#### SEC-006 — Secure headers

#### SEC-007 — Input validation review

#### SEC-008 — Audit integrity review

#### SEC-009 — Admin session controls

### Exit criteria

The lifecycle and security baseline is production-ready.

---

# 21. Sprint 15 — Full System Integration

## Goal

Integrate all major modules into end-to-end workflows.

### E2E scenarios

#### FLOW-001 — Student onboarding

```text
Excel
→ import
→ Google login
→ profile
```

#### FLOW-002 — Day Scholar membership purchase

```text
Login
→ Plan
→ Razorpay
→ Payment verification
→ Membership active
```

#### FLOW-003 — Booking

```text
Login
→ Slot availability
→ Booking
→ Confirmation push
```

#### FLOW-004 — Cancellation

```text
Booking
→ Cancel
→ Capacity released
→ Another student books
```

#### FLOW-005 — No-show

```text
Booking
→ No entry
→ No-show
→ Violation
→ Ban if threshold reached
```

#### FLOW-006 — Entry

```text
Face
→ Access integration
→ Eligibility
→ Entry
→ Presence state
```

#### FLOW-007 — Exit

```text
Exit event
→ Access service
→ Exit log
→ Presence cleared
```

#### FLOW-008 — Face enrollment

```text
Student
→ Face submission
→ Restricted storage
→ BullMQ
→ Worker
→ WebSocket
→ ZKBio
→ Sync status
```

#### FLOW-009 — Gym closure

```text
Admin closure
→ Booking cancellations
→ Push
→ Rebooking availability
```

#### FLOW-010 — Student departure

```text
Leaving Excel
→ Deactivate
→ Access disabled
→ Future bookings invalidated
→ Archive lifecycle
```

#### FLOW-011 — Reactivation

```text
Admin reactivation
→ Active
→ Eligibility restored
→ Audit
```

#### FLOW-012 — Trainer shift

```text
Trainer entry
→ Work timer
→ Trainer exit
→ Hours
→ Stipend
```

---

# 22. Sprint 16 — Performance, Security & Failure Testing

## Goal

Validate the architecture under realistic conditions.

### Performance testing

#### PERF-001 — 25,000 student dataset

Generate a production-like test dataset.

#### PERF-002 — Concurrent slot booking

Test:

```text
100
500
1,000
2,000
```

concurrent requests against the same slot and mixed slots.

#### PERF-003 — Entry burst

Simulate a busy gym transition.

#### PERF-004 — Database performance

Test:

- Bookings
- Entry/exit
- Search
- Reports
- Audit queries

#### PERF-005 — Redis queue load

#### PERF-006 — MinIO upload/download load

#### PERF-007 — Archive job load

### Failure testing

#### FAIL-001 — PostgreSQL restart

#### FAIL-002 — Redis restart

#### FAIL-003 — MinIO restart

#### FAIL-004 — Worker restart

#### FAIL-005 — API restart

#### FAIL-006 — WebSocket disconnect

#### FAIL-007 — ZKBio communication failure

#### FAIL-008 — Payment callback delay

#### FAIL-009 — Browser disconnect during booking

#### FAIL-010 — Duplicate payment callback

### Security

#### SEC-010 — Penetration testing

#### SEC-011 — Authorization bypass tests

#### SEC-012 — Session theft/revocation tests

#### SEC-013 — File access authorization tests

#### SEC-014 — Signed URL expiry tests

#### SEC-015 — Injection testing

### Exit criteria

No critical architectural failure or capacity defect remains unresolved.

---

# 23. Sprint 17 — UAT / Release Candidate

## Goal

College stakeholder validation.

### UAT groups

- Student
- Trainer
- Staff
- Authorized Person
- Admin
- Super Admin

### UAT coverage

#### Students

- Login
- Booking
- Cancellation
- Membership
- Payment
- History
- Notifications

#### Trainers

- Current slot
- Occupancy
- Overstayers
- Working hours

#### Staff

- Access history
- Hours

#### Authorized Persons

- Access
- Dashboard

#### Admin

- CRM
- Configuration
- Reports
- Conflicts
- Data lifecycle

#### Super Admin

- Admin permissions
- Role management
- Protected Super Admin

### Release candidate

Fix all:

- Critical defects
- High-severity defects
- Security blockers
- Booking-capacity defects
- Access-control blockers
- Payment blockers

---

# 24. Cross-Sprint Technical Work

These must happen continuously instead of being left to the final sprint.

## Testing

- Unit tests
- Integration tests
- API contract tests
- E2E tests
- Regression suite

## Security

- Dependency scanning
- Secret scanning
- Auth testing
- Authorization testing
- Input validation

## DevOps

- Docker image builds
- Health checks
- Log rotation
- Backup jobs
- Restore testing
- Deployment scripts

## Documentation

- API documentation
- Database schema documentation
- Architecture updates
- Operational runbooks
- Admin documentation

---

# 25. Critical Path

The highest-risk dependency chain is:

```text
Infrastructure
   ↓
Authentication
   ↓
People / Identity
   ↓
RBAC
   ↓
Slots
   ↓
Booking Engine
   ↓
Membership
   ↓
Payment
   ↓
Access Domain
   ↓
ZKBio Integration
```

Parallel branches:

```text
Infrastructure
   ├── Notifications
   ├── Reports foundation
   ├── Audit
   └── Admin UI foundation
```

---

# 26. Highest-Risk Areas

## Risk 1 — Booking concurrency

Severity: **Critical**

If capacity can exceed 100, the core gym logic is invalid.

Mitigation:

- PostgreSQL transaction
- Correct locking
- Stress testing
- Idempotency
- Race-condition testing

## Risk 2 — Access-control integration

Severity: **Critical**

Physical access depends on reliable integration.

Mitigation:

- Vendor-neutral adapter
- Isolated WebSocket layer
- Health monitoring
- Async face synchronization
- Explicit failure state

## Risk 3 — Single-VPS failure

Severity: **High**

The architecture intentionally has a single VPS.

Mitigation:

- PostgreSQL backups
- WAL
- Persistent volumes
- Redis persistence
- MinIO persistence
- Restore testing

This does **not** protect against complete VPS loss.

## Risk 4 — Sensitive biometric/health data

Severity: **Critical**

Mitigation:

- Separate storage
- Restricted access
- Audit
- Encryption
- Minimal retention
- Lifecycle management

## Risk 5 — Payment reconciliation

Severity: **High**

Mitigation:

- Verified webhook
- Idempotency
- Payment state machine
- Reconciliation jobs

---

# 27. Suggested Sprint Velocity Planning

Do not estimate the entire project only in story count.

Use a velocity measure after Sprint 1–2.

### Initial estimation

Use:

```text
1 point  = trivial
2 points = small
3 points = normal
5 points = complex
8 points = very complex / architectural
13 points = split required
```

Stories over 8 points should normally be split.

---

# 28. Sprint Planning Rule

Each sprint should contain:

```text
~70% feature work
~15% technical debt / architecture
~15% QA / hardening
```

During critical integration sprints, this may become:

```text
~55% feature
~25% integration
~20% QA
```

---

# 29. Milestones

| Milestone | Target |
|---|---|
| M1 | Development environment operational |
| M2 | Authentication + onboarding working |
| M3 | Booking engine working |
| M4 | Membership + Razorpay working |
| M5 | Access-control domain working |
| M6 | ZKBio integration candidate |
| M7 | Admin CRM complete |
| M8 | Archive/lifecycle complete |
| M9 | Full E2E integration complete |
| M10 | Performance/security sign-off |
| M11 | UAT complete |
| M12 | Production release |

---

# 30. Minimum Viable Release

If scope must be reduced for a first release, the minimum viable system should be:

### Must Have

- Google login
- Student onboarding
- Hosteller / Day Scholar
- Slot management
- Booking
- Cancellation
- No-show/ban policy
- Membership
- Razorpay
- Entry/exit records
- Access-control integration
- Trainer dashboard
- Admin CRM
- Push notifications
- Audit logging
- Basic reports
- Security
- Backup

### Can Follow Immediately After

- Advanced archive reporting
- Advanced report generation
- Expanded admin role templates
- Advanced analytics
- More detailed operational dashboards

### Do Not Remove

Never cut:

- Transactional booking capacity enforcement
- Authorization
- Audit logging
- Payment reconciliation
- Access-control failure handling
- Backup/restore capability
- Sensitive-data protection

---

# 31. Release Checklist

Before production:

## Application

- [ ] All critical user journeys pass
- [ ] Booking concurrency tests pass
- [ ] Payment reconciliation passes
- [ ] Face sync flow passes
- [ ] Access-control failure flow passes
- [ ] Push notifications pass
- [ ] Excel imports pass
- [ ] Reports pass

## Security

- [ ] HTTPS enabled
- [ ] Secure cookies
- [ ] RBAC enforced
- [ ] Sensitive fields restricted
- [ ] Audit logs active
- [ ] Rate limits active
- [ ] Secrets outside source control

## Infrastructure

- [ ] Docker Compose validated
- [ ] Persistent volumes validated
- [ ] PostgreSQL backup tested
- [ ] PostgreSQL restore tested
- [ ] Redis recovery tested
- [ ] MinIO recovery tested
- [ ] Nginx health checked
- [ ] Monitoring configured

## Operations

- [ ] Admin runbook
- [ ] Incident runbook
- [ ] Backup runbook
- [ ] Access-control failure runbook
- [ ] Payment reconciliation runbook
- [ ] Release/rollback procedure

---

# 32. Final Delivery Sequence

```text
Sprint 1
Foundation
   ↓
Sprint 2
Identity
   ↓
Sprint 3
People / Import
   ↓
Sprint 4
RBAC
   ↓
Sprint 5
Slots
   ↓
Sprint 6
Booking
   ↓
Sprint 7
Membership
   ↓
Sprint 8
Payments
   ↓
Sprint 9
Notifications
   ↓
Sprint 10
Access Domain
   ↓
Sprint 11
ZKBio / WebSocket / Face
   ↓
Sprint 12
Trainer / Staff / Authorized
   ↓
Sprint 13
Admin / Reports / Conflicts
   ↓
Sprint 14
Archive / Security
   ↓
Sprint 15
Integration
   ↓
Sprint 16
Performance / Security / Failure Testing
   ↓
Sprint 17
UAT / Release Candidate
   ↓
PRODUCTION
```

---

# 33. Recommended First Sprint Backlog

The first sprint should not begin with feature development.

It should finish with the complete development platform working.

```text
INF-001 Repository
INF-002 Frontend
INF-003 Backend
INF-004 Tooling
INF-005 Docker Compose
INF-006 Networking
INF-007 Persistent volumes
INF-008 Nginx
INF-009 HTTPS
INF-010 Configuration
INF-011 Error model
INF-012 Logging
INF-013 Correlation IDs
INF-014 Health endpoints
INF-015 DB migrations
```

### Sprint 1 acceptance

A developer should be able to run:

```bash
docker compose up -d
```

and obtain a working environment where:

```text
PWA → Nginx → Express
Express → PostgreSQL
Express → Redis
Express → MinIO
Worker → Redis
Nginx → WebSocket endpoint
```

with persistent data and health checks.

---

# 34. Architecture-to-Sprint Traceability

| Architecture area | Sprint |
|---|---:|
| VPS / Docker Compose | 1 |
| PWA | 1–2, ongoing |
| Google OAuth | 2 |
| Redis sessions | 2 |
| Excel + MinIO | 3 |
| RBAC | 4 |
| PostgreSQL schemas | 1–4 |
| Slots | 5 |
| Booking concurrency | 6 |
| Membership | 7 |
| Razorpay | 8 |
| Push | 9 |
| Access domain | 10 |
| WebSocket / ZKBio | 11 |
| Face sync | 11 |
| Trainer | 12 |
| Staff | 12 |
| Authorized persons | 12 |
| Admin CRM | 13 |
| Reports | 13 |
| Audit/conflicts | 13–14 |
| Archive/anonymization | 14 |
| Security hardening | 14, 16 |
| E2E integration | 15 |
| Performance | 16 |
| UAT | 17 |

---

# 35. Final Planning Principle

The project should optimize for **correctness of the gym's core invariants** before polishing secondary features.

The three most important invariants are:

1. **A slot can never exceed its capacity.**
2. **No person can gain access unless the access rules authorize it.**
3. **Every sensitive administrative or operational change can be reconstructed through audit/history.**

Everything else should be built around preserving these invariants.
