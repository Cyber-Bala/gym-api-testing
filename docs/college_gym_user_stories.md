# College Gym Management System — User Stories

**Derived from:** SRS v1.1  
**Date:** 18 August 2026  
**Status:** Product Backlog Baseline  
**Scale:** ~16,000 students now; ~25,000 expected next year

---

## 1. Purpose

This document converts the approved Software Requirements Specification into implementation-ready user stories. Each story contains:

- **Story ID**
- **Epic**
- **Role**
- **Priority**
- **User story**
- **Acceptance criteria**
- **SRS traceability**

The stories intentionally describe **what the system must provide**, not low-level implementation. Architecture decisions such as database locking, WebSocket topology, biometric representation, and ZKBio CV API mechanics remain technical-design concerns.

### Priority legend

| Priority | Meaning |
|---|---|
| P0 | Critical for core gym operation / access |
| P1 | Required for the initial production release |
| P2 | Important operational capability / hardening |
| P3 | Future enhancement or optimization |

---

# 2. Epic Overview

| Epic | Scope | Priority |
|---|---|---|
| E01 | Identity & onboarding | P0 |
| E02 | Student lifecycle | P0 |
| E03 | Student experience | P1 |
| E04 | Memberships & payments | P0 |
| E05 | Slot configuration & booking | P0 |
| E06 | Booking violations | P0 |
| E07 | Gym calendar & closures | P0 |
| E08 | Automated access | P0 |
| E09 | Staff access | P1 |
| E10 | Authorized-person access | P1 |
| E11 | Trainer operations | P0 |
| E12 | Trainer stipend reporting | P1 |
| E13 | Admin CRM & configuration | P0 |
| E14 | Admin permissions | P0 |
| E15 | Notifications | P1 |
| E16 | Conflict & exception management | P0 |
| E17 | Reporting & exports | P1 |
| E18 | Audit & governance | P0 |
| E19 | Data archival & anonymization | P1 |
| E20 | Security, availability & recovery | P0 |
| E21 | Realtime/WebSocket integration boundary | P1 |
| E22 | Scale & concurrency | P0 |

---

# 3. E01 — Identity & Onboarding

## US-001 — Student bulk onboarding

**Role:** Admin  
**Priority:** P0  
**SRS:** FR-STU-001..004

**As an Admin, I want to upload the college-provided student Excel file so that eligible students can be provisioned in bulk.**

### Acceptance Criteria

- Admin can download/use the approved student Excel format.
- System validates the file before committing records.
- Valid records are processed.
- Invalid records are rejected without corrupting valid records.
- Processing produces a result containing success/failure counts and row-level reasons.

---

## US-002 — Student records prefilled from college data

**Role:** Student  
**Priority:** P0  
**SRS:** FR-STU-005..009

**As a Student, I want my college-supplied information prefilled so that I do not have to manually enter institutional data.**

### Acceptance Criteria

- Roll number, name, college email, department, joining year and residency are available from the authoritative record.
- Student cannot edit institution-controlled fields.
- Student can edit only phone number, emergency contact, address and health concerns.

---

## US-003 — Google OAuth identity verification

**Role:** Student  
**Priority:** P0  
**SRS:** FR-STU-006

**As a Student, I want to sign in with Google using my college email so that the system can verify my identity.**

### Acceptance Criteria

- Only a college email associated with an uploaded student record can activate student access.
- Authenticated Google identity is mapped to the correct student record.
- Unrecognized identities cannot access the student application.

---

## US-004 — Student face enrollment

**Role:** Student  
**Priority:** P0  
**SRS:** FR-STU-011..014

**As a Student, I want to enroll my face once so that the gym can identify me at entry and exit.**

### Acceptance Criteria

- Face enrollment is linked to the authenticated student identity.
- Student has one enrollment attempt under the current policy.
- Student cannot freely replace an enrolled face.
- Failed enrollment or later change requires Admin intervention.
- The actual biometric storage/matching mechanism is implementation-defined.

---

## US-005 — Residency change

**Role:** Authorized Admin  
**Priority:** P1  
**SRS:** FR-STU-010

**As an Admin, I want to change a student's Hosteller/Day Scholar status so that gym eligibility follows their current college residency status.**

### Acceptance Criteria

- Admin can change residency from Hosteller to Day Scholar or vice versa.
- Change is audited with actor, timestamp, old value, new value and reason.
- Subsequent eligibility follows the new category.

---

# 4. E02 — Student Lifecycle

## US-006 — Leaving-student batch processing

**Role:** Admin  
**Priority:** P0  
**SRS:** FR-STU-020..026

**As an Admin, I want to upload an Excel file containing leaving-student roll numbers so that departed students can be deactivated in bulk.**

### Acceptance Criteria

- File contains roll numbers.
- System validates unmatched/invalid roll numbers.
- Valid students are transitioned to inactive/leaving status.
- Future gym eligibility and bookings are removed.
- Operational data becomes eligible for archival.
- Processing result is available for download/viewing.

---

## US-007 — Automatic departure cleanup

**Role:** Admin  
**Priority:** P0  
**SRS:** FR-STU-022..025

**As the system, I want to remove operational access when a student leaves so that former students cannot use active gym privileges.**

### Acceptance Criteria

- Active access is disabled.
- Future booking eligibility is disabled.
- Active membership is terminated as part of the transition.
- Historical records remain retrievable through archive policy.

---

## US-008 — Reactivate a former student

**Role:** Authorized Admin  
**Priority:** P1  
**SRS:** FR-STU-026

**As an Admin, I want to reactivate a previously inactive student so that an authorized returning person can regain active status.**

### Acceptance Criteria

- Admin can reactivate eligible inactive records.
- Active status is restored.
- Access eligibility is recalculated.
- Reactivation is fully audited with a reason.

---

# 5. E03 — Student Experience

## US-009 — Booking-first student dashboard

**Role:** Student  
**Priority:** P1  
**SRS:** FR-DASH-STU-001..010

**As a Student, I want the dashboard to prioritize booking so that I can quickly reserve my gym time.**

### Acceptance Criteria

- Booking action is the primary dashboard action.
- Active membership/expiry is shown when applicable.
- Upcoming bookings are visible.
- Attendance/access history is available.
- Penalty status is visible.
- Payment history is available for Day Scholars.
- Push notifications are accessible.
- Occupancy and trainer information are not shown.

---

## US-010 — View upcoming bookings

**Role:** Student  
**Priority:** P1  
**SRS:** FR-DASH-STU-003

**As a Student, I want to see my upcoming bookings so that I know when I am scheduled to use the gym.**

### Acceptance Criteria

- Upcoming bookings show date, slot and status.
- A cancelled booking no longer appears as active.
- Rebooked slots appear as new/current bookings.

---

## US-011 — View attendance and access history

**Role:** Student  
**Priority:** P1  
**SRS:** FR-DASH-STU-004..005

**As a Student, I want to see my attendance and entry/exit history so that I can review my gym usage.**

### Acceptance Criteria

- Historical booking and access records are visible to the student.
- Records are presented without exposing other users' data.
- Archived records are returned through the same authorized historical view where supported.

---

# 6. E04 — Memberships & Payments

## US-012 — Configure membership plans

**Role:** Admin  
**Priority:** P0  
**SRS:** FR-MEM-001..003

**As an Admin, I want to create and manage membership plans so that the college can change durations and pricing without code changes.**

### Acceptance Criteria

- Admin can create/edit/deactivate plans.
- Duration can be week, month, year or another configured duration.
- Admin can define the price.
- Changes are audited.

---

## US-013 — Purchase a Day Scholar membership

**Role:** Day Scholar  
**Priority:** P0  
**SRS:** FR-MEM-004, FR-MEM-011..012

**As a Day Scholar, I want to purchase a membership through the configured payment gateway so that I can book gym slots.**

### Acceptance Criteria

- Razorpay is used initially.
- Payment provider is accessed through a modular abstraction.
- Successful payment activates the membership automatically.
- Failed/pending payment does not activate the membership.
- Student receives payment confirmation.

---

## US-014 — View payment and transaction details

**Role:** Student / Admin  
**Priority:** P1  
**SRS:** FR-DASH-STU-007, FR-MEM-009

**As a Student, I want to view my membership transaction history so that I can verify my purchases.**

### Acceptance Criteria

- Transaction ID/reference is shown where available.
- Amount, plan, payment date/time and status are visible.
- Admin can view and reconcile authorized payment records.

---

## US-015 — Queue one future membership

**Role:** Day Scholar  
**Priority:** P1  
**SRS:** FR-MEM-005..008

**As a Day Scholar, I want to queue one future membership so that my gym access can continue after my current membership expires.**

### Acceptance Criteria

- Only one future membership may be queued.
- Active memberships cannot overlap.
- Queued membership begins when the current membership expires.
- Membership history records the queued state and eventual activation.

---

## US-016 — Enforce membership period for booking

**Role:** System  
**Priority:** P0  
**SRS:** FR-MEM-008

**As the system, I want to prevent Day Scholars from booking outside membership validity so that bookings cannot outlive eligibility.**

### Acceptance Criteria

- Booking outside active membership validity is rejected.
- Booking is allowed through the membership end boundary according to configured business rules.
- Hostellers are not blocked by membership payment because their access is free.

---

# 7. E05 — Slot Configuration & Booking

## US-017 — Configure operating and slot rules

**Role:** Admin  
**Priority:** P0  
**SRS:** FR-SLOT-001..006

**As an Admin, I want to configure operating hours, slot duration, buffer and capacity so that the gym rules can change without redeployment.**

### Acceptance Criteria

- Admin can configure gym operating time.
- Admin can configure slot duration and buffer.
- Admin can configure slot capacity.
- Admin can configure booking-window rules.
- Configuration changes apply to eligible future slots.

---

## US-018 — View three-day booking window

**Role:** Student  
**Priority:** P0  
**SRS:** FR-BOOK-001..003

**As a Student, I want to see the active three-day booking window so that I can choose my allowed reservations.**

### Acceptance Criteria

- Default window contains three open/eligible days.
- Closed days are ignored when determining the window.
- Student can select up to three eligible slots within the window.
- The cycle continues until membership ends where membership is required.

---

## US-019 — Book a slot

**Role:** Student  
**Priority:** P0  
**SRS:** FR-BOOK-002, FR-BOOK-004, FR-BOOK-014..020

**As a Student, I want to book an available slot so that I can reserve gym access.**

### Acceptance Criteria

- Started/past slots cannot be newly booked.
- Student's booking allowance within the active window is enforced.
- Slot capacity is enforced atomically.
- Default capacity is 100 and remains configurable.
- Concurrent booking requests cannot exceed capacity.
- Failed bookings do not consume allowance.
- Successful booking is recorded in complete booking history.

---

## US-020 — Cancel a booking

**Role:** Student  
**Priority:** P0  
**SRS:** FR-BOOK-005..007

**As a Student, I want to cancel my booking before the slot starts so that another student can use the released capacity.**

### Acceptance Criteria

- Cancellation is allowed at any time before slot start.
- Cancellation is rejected once the slot starts.
- Capacity is released immediately.
- Another eligible student can book the released place.
- Student-initiated cancellation counts as a booking violation.

---

## US-021 — View booking status

**Role:** Student / Trainer / Admin  
**Priority:** P1  
**SRS:** Booking/attendance states section

**As an authorized user, I want booking and attendance states to be explicit so that I can distinguish completed, missed and cancelled usage.**

### Acceptance Criteria

- Booking lifecycle is separate from access state.
- Booking states support at least Booked, Attended/Completed, No-show, Cancelled by gym and Expired as applicable.
- Access state supports at least Not Entered, Inside and Exited.

---

# 8. E06 — Booking Violations

## US-022 — Apply cancellation/no-show violations

**Role:** System  
**Priority:** P0  
**SRS:** FR-BOOK-007..010

**As the system, I want student cancellations and no-shows to use one violation policy so that repeated misuse can be controlled consistently.**

### Acceptance Criteria

- Student cancellation increments violation count.
- Genuine no-show increments violation count.
- Gym closure cancellation does not increment violation count.
- Default threshold is third violation.
- Default ban duration is three days.
- Threshold and ban duration are Admin-configurable.

---

## US-023 — Enforce gym ban

**Role:** System  
**Priority:** P0  
**SRS:** BR-013

**As the system, I want to block gym access during a violation ban so that repeated booking misuse has a consequence.**

### Acceptance Criteria

- Banned student cannot book/access the gym.
- Ban expiry is calculated using configured duration.
- Ban status is visible to the student and authorized Admins.
- Admin override follows delegated permissions and is audited.

---

# 9. E07 — Gym Calendar & Closures

## US-024 — Manage gym calendar

**Role:** Admin  
**Priority:** P0  
**SRS:** gym calendar requirements

**As an Admin, I want a calendar for gym operating dates so that I can close individual days when required.**

### Acceptance Criteria

- Admin can mark a date closed.
- Admin can provide a closure reason.
- Closure is visible to affected students and trainers.
- Closed days do not consume booking-window days.

---

## US-025 — Cancel bookings on closure

**Role:** System  
**Priority:** P0  
**SRS:** BR-020..021

**As the system, I want to cancel affected slots when the gym is closed so that students cannot rely on unavailable access.**

### Acceptance Criteria

- All affected bookings are marked cancelled-by-gym.
- Students receive push notification.
- Cancellation does not count toward violation thresholds.
- Students can rebook using the newly available/open period.
- The next open days define the applicable booking window.

---

# 10. E08 — Automated Access

## US-026 — Validate student entry

**Role:** Student / System  
**Priority:** P0  
**SRS:** FR-ACCESS-001..009

**As a Student, I want the gym entrance to recognize and validate me automatically so that eligible access does not require manual checking.**

### Acceptance Criteria

- Entry camera identifies the person.
- Student record exists and is active.
- Membership eligibility is checked where required.
- Valid booking is checked.
- Current time is within the permitted access window.
- Student is not already inside.
- Student is not banned.
- Entry is allowed only if all required rules succeed.
- Capacity is enforced by booking, not re-counted as an independent capacity decision at entry.

---

## US-027 — Record student entry

**Role:** System  
**Priority:** P0  
**SRS:** access requirements

**As the system, I want to record successful entry so that attendance and current occupancy are accurate.**

### Acceptance Criteria

- Entry timestamp is recorded.
- Student is marked Inside.
- Relevant booking becomes attended/in-progress as appropriate.
- Entry data is auditable.

---

## US-028 — Record student exit

**Role:** Student / System  
**Priority:** P0  
**SRS:** access requirements

**As the system, I want the exit camera to identify departing students and record exit so that occupancy and attendance remain accurate.**

### Acceptance Criteria

- Exit is associated with the correct person.
- Exit timestamp is recorded.
- Student is marked Exited/not-inside.
- Exit history is available to authorized users.

---

## US-029 — Support buffer entry/exit

**Role:** Student / System  
**Priority:** P0  
**SRS:** FR-BOOK-013

**As a Student, I want the ten-minute transition buffer to permit both outgoing exits and incoming early entries so that slot turnover is practical.**

### Acceptance Criteria

- Student from ending slot can exit during buffer.
- Student from next slot can enter during buffer.
- Access decisions still respect booking, membership, ban and identity rules.
- Buffer duration is configurable.

---

## US-030 — Handle access-control failure alert

**Role:** Admin / System  
**Priority:** P0  
**SRS:** architecture/access-control failure policy

**As an Admin, I want critical access-control failures to alert me and pause affected access operations so that the college can resolve the physical/system problem.**

### Acceptance Criteria

- Critical failure is detected.
- Admin receives an alert.
- A detailed exception/failure record is created.
- Affected access operation is paused until resolution.
- Recovery is logged.
- Exact hardware recovery behavior is handled outside the SRS implementation scope.

---

# 11. E09 — Staff Access

## US-031 — Onboard staff

**Role:** Admin  
**Priority:** P1

**As an Admin, I want to upload staff records using the supported onboarding process so that staff can use the gym without student restrictions.**

### Acceptance Criteria

- Staff can be loaded in bulk.
- Staff identity is associated with an active staff record.
- Staff do not require membership or student slot booking.

---

## US-032 — Record staff entry and exit

**Role:** Staff / System  
**Priority:** P1

**As a Staff member, I want my entry and exit times recorded so that I can see my gym commitment.**

### Acceptance Criteria

- Staff may enter/exit without student booking/membership constraints.
- Entry and exit timestamps are recorded.
- Staff can see their own duration history.

---

## US-033 — Staff commitment dashboard

**Role:** Staff  
**Priority:** P1

**As a Staff member, I want a simple dashboard showing my entry time, exit time and hours so that I can track my gym commitment.**

### Acceptance Criteria

- Current/recent entry is visible.
- Exit is visible after departure.
- Duration is calculated from entry to exit.
- Staff cannot see student CRM data.

---

# 12. E10 — Authorized-Person Access

## US-034 — Add authorized person

**Role:** Admin  
**Priority:** P1

**As an Admin, I want to add an authorized person such as an owner or approved outsider so that they can use the gym without student restrictions.**

### Acceptance Criteria

- Admin can create an authorized-person record.
- No student membership or slot is required.
- Access is active until disabled/revoked.
- Entry and exit are logged.

---

## US-035 — Authorized-person dashboard

**Role:** Authorized Person  
**Priority:** P1

**As an Authorized Person, I want to see my own access history so that I know my recorded gym entry/exit activity.**

### Acceptance Criteria

- Only the person's own access records are visible.
- Current access status is shown.
- No student or trainer CRM information is exposed.

---

## US-036 — Revoke authorized access

**Role:** Admin  
**Priority:** P1

**As an Admin, I want to disable an authorized person immediately so that their access can be withdrawn when no longer permitted.**

### Acceptance Criteria

- Admin can deactivate the person.
- Future access attempts are rejected.
- Historical records remain available according to policy.
- Revocation is audited.

---

# 13. E11 — Trainer Operations

## US-037 — Trainer operational dashboard

**Role:** Trainer  
**Priority:** P0  
**SRS:** trainer requirements

**As a Trainer, I want to see current gym operations so that I can manage people physically inside the gym.**

### Acceptance Criteria

- Current slot is visible.
- Students expected/currently inside are visible.
- Current gym occupancy is visible.
- Trainer sees information necessary to identify students.
- Student health information, payment data and unnecessary CRM information are not exposed.

---

## US-038 — Identify overstayed students

**Role:** Trainer  
**Priority:** P0

**As a Trainer, I want to see students whose booked slot has expired while they remain inside so that I can ask them to leave.**

### Acceptance Criteria

- Overstayer detection uses slot end versus recorded presence.
- Trainer can see student's photo, roll number, name, joining year, department and relevant slot/access information.
- Trainer does not remotely control the turnstile.
- The trainer physically asks the student to leave.

---

## US-039 — Trainer own attendance

**Role:** Trainer  
**Priority:** P1

**As a Trainer, I want to see my entry, exit and accumulated hours so that I can review my work commitment.**

### Acceptance Criteria

- Entry and exit are recorded.
- Working hours are calculated as entry-to-exit duration.
- Trainer can view current and historical hours.

---

# 14. E12 — Trainer Stipend Reporting

## US-040 — Configure trainer hourly rate

**Role:** Admin  
**Priority:** P1

**As an Admin, I want to set trainer hourly rates so that stipend calculations can be generated from recorded work duration.**

### Acceptance Criteria

- Rate can be configured per trainer or according to the approved payroll model.
- Changes are audited.
- Historical calculations retain the applicable rate used at the time.

---

## US-041 — Calculate trainer pay

**Role:** Admin / System  
**Priority:** P1

**As an Admin, I want trainer stipend amounts calculated from entry-to-exit hours so that payroll preparation is accurate.**

### Acceptance Criteria

- Working duration is based on recorded entry and exit.
- Hourly rate is applied.
- Total payable amount is calculated.
- Admin can review the underlying records before export.

---

## US-042 — Export trainer payroll

**Role:** Admin  
**Priority:** P1

**As an Admin, I want to export trainer working hours and calculated payment into Excel so that I can submit payroll information.**

### Acceptance Criteria

- Export supports a controlled From/To date range.
- Includes trainer identity, hours, hourly rate and calculated amount.
- Export is permission-controlled.

---

# 15. E13 — Admin CRM & Configuration

## US-043 — Admin CRM management

**Role:** Admin  
**Priority:** P0

**As an Admin, I want broad CRM management of students, staff, memberships, bookings, trainers and access records so that operational exceptions can be resolved.**

### Acceptance Criteria

- Admin can manage all domains allowed by delegated permissions.
- Sensitive changes require a reason.
- All sensitive changes are audited.
- Historical information is not silently destroyed where audit/history is required.

---

## US-044 — Manage gym operating configuration

**Role:** Admin  
**Priority:** P0

**As an Admin, I want to configure gym rules from the administration interface so that common operational changes do not require a developer.**

### Acceptance Criteria

- Operating hours configurable.
- Slot duration configurable.
- Buffer configurable.
- Capacity configurable.
- Booking-window rules configurable.
- Violation threshold configurable.
- Ban duration configurable.
- Notification reminder timing configurable.

---

# 16. E14 — Admin Permissions

## US-045 — Create delegated admin permissions

**Role:** Super Admin  
**Priority:** P0

**As a Super Admin, I want granular permissions that can be assigned to other admins so that administrative access follows job responsibilities.**

### Acceptance Criteria

- Super Admin can create/manage permission groupings.
- Admin access can be split by capability, similar to granular permission systems.
- Admins cannot grant themselves elevated permissions.
- Permission changes are audited.

---

## US-046 — Protected Super Admin identity

**Role:** Super Admin  
**Priority:** P0

**As a Super Admin, I want one protected primary administrator identity so that accidental removal cannot lock the organization out of the system.**

### Acceptance Criteria

- Protected identity cannot be deleted through normal UI operations.
- Other administrators cannot remove the protected identity through ordinary permission management.
- Any special system-level identity change follows a controlled process.

---

# 17. E15 — Notifications

## US-047 — Push notification delivery

**Role:** Student / Trainer / Admin  
**Priority:** P1

**As a user, I want timely push notifications for relevant system events so that I do not miss changes affecting my gym access.**

### Acceptance Criteria

- Push is the supported notification channel.
- Email notifications are not required.
- Notifications support booking, cancellation, closure, membership, payment, no-show/ban and other relevant events.
- Notification architecture remains extensible for future events.

---

## US-048 — Slot reminder

**Role:** Student  
**Priority:** P1

**As a Student, I want a reminder before my booked slot so that I am less likely to forget it.**

### Acceptance Criteria

- Default reminder is 15 minutes before slot start.
- Reminder timing is Admin-configurable.
- Reminder identifies the relevant date/time and booking.
- Cancelled bookings do not produce an active reminder.

---

## US-049 — Closure notification

**Role:** Student / Trainer  
**Priority:** P1

**As a user, I want to be notified when the gym closes unexpectedly so that I know my planned access has changed.**

### Acceptance Criteria

- Closure reason is included where available.
- Affected students receive push notification.
- Trainers receive appropriate operational notification.
- Cancelled bookings are clearly identified.

---

# 18. E16 — Conflict & Exception Management

## US-050 — Detect and log access/data conflicts

**Role:** System / Admin  
**Priority:** P0

**As an Admin, I want abnormal records to be logged as conflicts so that inconsistencies can be investigated rather than silently guessed away.**

### Acceptance Criteria

- Examples such as entry-without-exit can create a conflict record.
- Conflict retains as much relevant context as reasonably available.
- Original events are preserved.
- System does not silently infer a correction.

---

## US-051 — Review conflict details

**Role:** Admin  
**Priority:** P0

**As an Admin, I want a detailed conflict view so that I can understand what happened and decide how to handle it.**

### Acceptance Criteria

- Conflict shows related person, timestamps, source/device context where available, related booking/access data and current state.
- Admin can record resolution information.
- Conflict remains part of the historical audit trail.

---

# 19. E17 — Reporting & Exports

## US-052 — Generate controlled-range reports

**Role:** Admin  
**Priority:** P1

**As an Admin, I want to generate reports using a From/To date range so that reports match the period I need to analyze.**

### Acceptance Criteria

- From and To dates are required for applicable time-based reports.
- Report generation is permission-controlled.
- Reports respect filters and authorized data scope.

---

## US-053 — Export reports

**Role:** Admin  
**Priority:** P1

**As an Admin, I want reports exportable as Excel, CSV and PDF so that I can use them outside the system.**

### Acceptance Criteria

- Excel export supported.
- CSV export supported.
- PDF export supported.
- Export respects date range and filters.
- Export action is auditable where required.

---

## US-054 — Search and filter large datasets

**Role:** Admin / Trainer  
**Priority:** P0

**As an authorized user, I want fast search/filtering across large tables so that I can operate the system with 25,000+ students.**

### Acceptance Criteria

- Search by roll number and name.
- Filters include department, joining year, residency, membership, booking, presence and relevant status.
- Tables support sorting and pagination.
- Results are permission-scoped.

---

# 20. E18 — Audit & Governance

## US-055 — Audit sensitive administrative changes

**Role:** System  
**Priority:** P0

**As the system, I want to record sensitive changes so that administrative actions are accountable.**

### Acceptance Criteria

- Actor is recorded.
- Timestamp is recorded.
- Affected record/entity is recorded.
- Action is recorded.
- Previous value and new value are recorded where applicable.
- Reason is mandatory for sensitive changes.
- Audit data is protected from ordinary modification.

---

## US-056 — Audit reactivation and access changes

**Role:** Admin / Super Admin  
**Priority:** P0

**As an Admin, I want reactivation, access, role and biometric-related changes audited so that high-impact operations are traceable.**

### Acceptance Criteria

- Reactivation is audited.
- Permission changes are audited.
- Face re-enrollment/reset actions are audited.
- Access revocation is audited.
- Membership/residency changes are audited.

---

# 21. E19 — Data Archival & Anonymization

## US-057 — Archive old operational data

**Role:** System  
**Priority:** P1

**As the system, I want old operational records moved to cost-optimized archival storage so that the primary database remains efficient while history is retained.**

### Acceptance Criteria

- Eligible historical records can be moved out of hot storage.
- Archive prioritizes compact, durable storage.
- Historical data remains retrievable through authorized workflows.
- Archival operations are auditable.

---

## US-058 — Unified historical view

**Role:** Admin  
**Priority:** P1

**As an Admin, I want historical data to appear as one logical history even when some records are archived so that storage location does not complicate operations.**

### Acceptance Criteria

- Recent data is queried from hot storage.
- Archived data can be included in historical views where authorized.
- User does not need to manually locate archive files.

---

## US-059 — Data lifecycle dashboard

**Role:** Admin / Super Admin  
**Priority:** P1

**As an authorized administrator, I want a data lifecycle page so that I can monitor archival and anonymization status.**

### Acceptance Criteria

- Data categories are shown.
- Archival eligibility is visible.
- Records approaching policy thresholds are visible.
- Anonymization status is visible.
- Previous lifecycle executions are visible.
- Lifecycle actions are audited.

---

## US-060 — Seven-year anonymization process

**Role:** Authorized Admin / System  
**Priority:** P1

**As the system, I want eligible archived personal data anonymized after the approved seven-year lifecycle so that unnecessary personal information is not retained indefinitely.**

### Acceptance Criteria

- Current institutional default is seven years for applicable archived personal data.
- Direct identifiers and unnecessary personal data are removed/irreversibly anonymized.
- Required legal/audit/statistical data may be retained.
- Health and biometric data follow stricter purpose-based rules.
- Execution is controlled and audited.

---

# 22. E20 — Security, Availability & Recovery

## US-061 — Enforce RBAC

**Role:** System  
**Priority:** P0

**As the system, I want every protected operation to respect role and delegated permissions so that users only access authorized capabilities.**

### Acceptance Criteria

- Student sees only own information.
- Trainer sees operationally relevant data.
- Staff and authorized persons see only their own access data.
- Admin access follows delegated permissions.
- Super Admin has unrestricted access.
- Permission checks are enforced server-side.

---

## US-062 — Protect sensitive data

**Role:** System  
**Priority:** P0

**As the system, I want sensitive information protected so that health, biometric-related and other personal data are not unnecessarily exposed.**

### Acceptance Criteria

- Encryption is used in transit and at rest according to the security architecture.
- Health information is restricted.
- Biometric-related data is not exposed through ordinary operational channels.
- Sensitive data is minimized and purpose-controlled.

---

## US-063 — 24/7 availability

**Role:** System  
**Priority:** P0

**As a gym operator, I want the application available 24/7 so that students and staff can use the service whenever the gym is operating and Admin can manage it at any time.**

### Acceptance Criteria

- Production service is designed for continuous availability.
- Planned maintenance is controlled and communicated.
- Critical dependencies are monitored.

---

## US-064 — Backup and disaster recovery

**Role:** Admin / Operations  
**Priority:** P0

**As an operator, I want backups and recovery procedures so that critical gym data can be restored after failure.**

### Acceptance Criteria

- Critical operational data is backed up.
- Restore procedures are documented and tested.
- Student identity, memberships, bookings, access records, payments, trainer pay data, audit data and configuration are recoverable.
- Exact RPO/RTO is finalized during architecture/operations design.

---

# 23. E21 — Realtime / WebSocket Integration Boundary

## US-065 — Realtime operational updates

**Role:** Trainer / Admin  
**Priority:** P1

**As an Admin or Trainer, I want live operational updates so that dashboards reflect current gym state without constant manual refresh.**

### Acceptance Criteria

- Authorized clients receive relevant live updates.
- Current occupancy/presence changes can update in realtime.
- Booking/slot state changes can be delivered in realtime where needed.
- Access-control alerts can be delivered in realtime.

---

## US-066 — Secure realtime subscriptions

**Role:** System  
**Priority:** P0

**As the system, I want realtime channels to enforce identity and permissions so that sensitive live data is not broadcast to unauthorized users.**

### Acceptance Criteria

- WebSocket clients authenticate before protected subscriptions.
- Subscription scope is authorization-checked.
- Health and sensitive student data are not broadcast on general channels.
- Realtime traffic uses secure transport in production.

---

## US-067 — Reconnect and resynchronize

**Role:** System  
**Priority:** P1

**As the system, I want realtime clients to recover after disconnects so that temporary network failures do not leave dashboards permanently stale.**

### Acceptance Criteria

- Clients can reconnect.
- Client can request/resume current authoritative state after reconnect.
- Event IDs prevent accidental duplicate processing where relevant.
- WebSocket failure does not corrupt the primary transaction/data state.

---

## US-068 — Vendor-neutral access-control adapter

**Role:** System  
**Priority:** P1

**As the system, I want access-control integration behind a vendor-neutral adapter so that ZKBio CV can be used initially without coupling the business domain to vendor-specific APIs.**

### Acceptance Criteria

- Core booking/membership logic does not depend on raw vendor payloads.
- Access adapter exposes stable application-level operations/events.
- ZKBio CV integration can be implemented behind the adapter during architecture/implementation.
- Vendor replacement does not require rewriting the core domain model.

---

# 24. E22 — Scale & Concurrency

## US-069 — Scale to 25,000+ students

**Role:** System  
**Priority:** P0

**As the system, I want capacity for at least 25,000 students with headroom so that the platform remains usable as the college population grows.**

### Acceptance Criteria

- Student data model supports at least 25,000 active/operational users.
- Search, dashboard and reporting functions remain operational at target scale.
- Architecture accounts for future growth beyond 25,000.

---

## US-070 — Safe concurrent booking

**Role:** Student / System  
**Priority:** P0

**As the system, I want simultaneous booking requests handled atomically so that a slot with capacity 100 can never sell more than 100 places.**

### Acceptance Criteria

- Concurrent booking attempts cannot exceed configured capacity.
- Exactly the available number of requests can succeed.
- Late requests receive a clear slot-full result.
- Failed requests do not consume booking allowance.
- The mechanism works at high demand, including booking-window release/opening events.
- Locking/reservation strategy is finalized in architecture.

---

## US-071 — High-demand booking-window release

**Role:** Student / System  
**Priority:** P0

**As a Student, I want the booking window to open reliably even when many students attempt bookings at once so that the booking process is fair and usable.**

### Acceptance Criteria

- Large simultaneous demand does not corrupt booking state.
- Slot counts remain correct.
- Duplicate reservations are prevented.
- System remains responsive within the final performance/SLA targets.

---

# 25. Cross-Cutting Definition of Done

A story is considered complete only when applicable criteria below are satisfied:

- Functional behavior is implemented and tested.
- Authorization is enforced server-side.
- Audit requirements are implemented where applicable.
- Failure/edge cases are covered.
- Data validation is implemented.
- Relevant notifications are triggered.
- Historical records are not lost accidentally.
- Analytics/reporting implications are handled.
- Performance is acceptable at the expected scale.
- Automated tests cover core business rules.
- Documentation is updated where behavior or configuration changes.

---

# 26. Recommended MVP Slice

## Release 1 — Core Gym Operation

1. US-001 Student bulk onboarding
2. US-003 Google OAuth
3. US-004 Face enrollment
4. US-012 Membership configuration
5. US-013 Membership payment
6. US-017 Slot configuration
7. US-018 Booking window
8. US-019 Slot booking
9. US-020 Cancellation
10. US-022 Violations/no-show
11. US-023 Ban enforcement
12. US-024 Gym calendar
13. US-025 Closure/rebooking
14. US-026 Entry validation
15. US-027 Entry recording
16. US-028 Exit recording
17. US-029 Buffer handling
18. US-037 Trainer dashboard
19. US-038 Overstayer identification
20. US-043 Admin CRM
21. US-045 Admin permissions
22. US-047 Push notifications
23. US-050 Conflict logging
24. US-055 Audit trail
25. US-061 RBAC
26. US-062 Sensitive-data protection
27. US-063 Availability
28. US-070 Concurrent booking

## Release 1.1 — Operational Hardening

- Staff access and dashboard
- Authorized-person access
- Trainer payroll export
- Reports/exports
- Data lifecycle dashboard
- Archive migration
- Realtime dashboard updates
- Reconnect/resynchronization
- Backup/recovery operationalization

## Later / Architecture-Dependent

- Detailed ZKBio CV adapter implementation
- Vendor-specific device event integration
- Final realtime topology/broker
- Offline/degraded access-control behavior
- Final biometric implementation
- Final legal retention/anonymization policy

---

# 27. Product Decisions Captured in This Backlog

- Hostellers have free gym access but still require slot booking.
- Day Scholars require an active membership.
- Slot booking uses a default three-day window and three eligible slots per window.
- Closed days are ignored by the booking-window calculation.
- Default slot duration is 50 minutes with a 10-minute buffer.
- During the buffer, outgoing students may exit and next-slot students may enter.
- Default slot capacity is 100 and is Admin-configurable.
- Capacity can never be exceeded, including under concurrent load.
- Students may cancel any time before a slot starts.
- Cancelled capacity becomes available to other students.
- Student cancellations and no-shows share the same violation policy.
- Default third violation triggers a three-day ban; both threshold and duration are configurable.
- Gym-initiated closure cancellations do not count as violations.
- At most one future membership may be queued.
- Razorpay is the initial payment provider behind a modular payment abstraction.
- Push notification is the required notification channel; email is not required.
- Trainers are students receiving a stipend and may enter/exit freely; working hours equal entry-to-exit duration.
- Staff have no student booking/membership constraints and can view their own gym commitment hours.
- Authorized persons have indefinite admin-granted access until revoked and have a dedicated dashboard.
- Students who leave the college lose operational access and active membership is terminated; records move into the archive lifecycle.
- Former students/persons can be reactivated by authorized Admins with full audit trail.
- Super Admin has unrestricted access and controls granular delegated permissions.
- A protected primary Super Admin identity cannot be removed through normal application operations.
- Historical operational data can move to cost-optimized archival storage and later enter a seven-year anonymization lifecycle, subject to institutional/legal policy.

---

# 28. Traceability Note

The Story IDs in this document are product-backlog identifiers. The SRS requirement IDs remain the normative requirements baseline. During implementation planning, each story should be linked to:

1. one or more SRS requirement IDs,
2. a technical design decision where needed,
3. test cases,
4. release/sprint assignment,
5. owner/status.

This allows the team to maintain end-to-end traceability from **business need → requirement → user story → implementation → test → release**.
