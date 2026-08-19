# College Gym Management System
## Software Requirements Specification (SRS)

**Document Version:** 1.1  
**Date:** 18 August 2026  
**Status:** Requirements Baseline  
**Current Scale:** ~16,000 students  
**Expected Scale:** ~25,000 students next year  

---

## 1. Document Purpose

This Software Requirements Specification defines the functional, non-functional, operational, security, data, and administrative requirements for a college gym management system.

The system provides automated gym access, student slot booking, membership management, trainer operations, administrative CRM capabilities, payment integration, notifications, reporting, conflict handling, auditing, and long-term data archival.

This document establishes the requirements baseline. Detailed technology choices, database architecture, concurrency/locking strategy, face-recognition implementation, infrastructure topology, and failure-recovery mechanisms are deferred to the architecture and technical-design phase where explicitly marked.

---

## 2. Product Overview

The system is a college gym management platform used by:

- Students
- Trainers who are also college students and receive a stipend
- Gym administrators
- Super Admins

Students use the application to access the gym through an automated face-recognition and turnstile process, book gym slots, manage memberships where applicable, view attendance/access history, and receive notifications.

The system distinguishes between two student categories:

- **Hosteller:** Gym access is free; slot booking is still required.
- **Day Scholar:** Requires an active purchased membership; slot booking is still required.

The system is designed for approximately 16,000 students initially and approximately 25,000 students in the following year, with additional headroom and high-concurrency booking support.

---

## 3. Goals and Objectives

1. Automate gym entry and exit validation.
2. Prevent over-capacity slot bookings under concurrent demand.
3. Give students a simple booking-first experience.
4. Support configurable membership plans and gym operating rules.
5. Give trainers real-time operational visibility without exposing unnecessary CRM data.
6. Provide administrators with full gym CRM and configuration capabilities.
7. Maintain reliable, auditable access, booking, payment, trainer, and administrative histories.
8. Handle abnormal/conflicting records through explicit exception logging rather than silent prediction.
9. Keep operational storage fast while retaining long-term historical data in cost-optimized archival storage.
10. Provide 24/7 availability for the application and core platform.

---

## 4. Scope

### 4.1 In Scope

- Student account onboarding from college-provided Excel records
- Staff onboarding from college-provided Excel records
- Authorized-person onboarding and lifecycle management
- Google OAuth identity validation
- Student profiles
- Hosteller/Day Scholar classification
- Gym memberships and pricing
- Slot booking and capacity enforcement
- 3-day rolling booking-window rules
- Face-based entry and exit validation
- Turnstile access control integration
- Gym occupancy for trainers/admins
- Trainer overstayer identification
- Trainer working-hour calculation and stipend reporting
- Admin CRM
- Admin-configurable gym, slot, membership, trainer and notification rules
- Gym closure calendar
- Push notifications
- Payment gateway integration point
- Conflict/exception logging
- Audit trail
- Reports and exports
- Data archival and anonymization management
- Backup and disaster recovery requirements
- Role-based access control

### 4.2 Out of Scope / Deferred

The following are intentionally not finalized in this SRS:

- Exact face-recognition implementation and stored biometric representation
- Camera/turnstile outage recovery mechanics
- Detailed legal retention schedule beyond the current 7-year institutional assumption
- Low-level booking-locking implementation
- Exact WebSocket/event-bus topology and vendor-specific access-control API mapping

---

## 5. Actors and Roles

| Actor | Description |
|---|---|
| Student | College student using gym services. Classified as Hosteller or Day Scholar. |
| Trainer | College student receiving a stipend for gym work. Has operational gym visibility. |
| Admin | Authorized gym administrator with delegated permissions. |
| Super Admin | Highest-privilege administrator with unrestricted administrative access and control over admin roles/permissions. |
| Staff | College/gym staff whose entry and exit are tracked for visibility of gym commitment; no student membership/booking constraints. |
| Authorized Person | Admin-added non-student/non-staff person such as owner, guest or outsider with indefinite access until revoked. |
| College Data Provider | Provides student and leaving-person Excel files. |
| Payment Gateway | Razorpay initially, behind a modular payment-provider abstraction. |
| Entry Camera | Captures and identifies a person's face for entry validation. |
| Exit Camera | Captures and identifies a person's face for exit recording. |
| Turnstile | Physical access-control device used to allow/deny gym passage. |

---

## 6. Student Categories and Access Model

### 6.1 Hosteller

- Does not pay for gym membership under the current policy.
- Must still book gym slots using the same booking rules as Day Scholars.
- Must satisfy entry validation conditions.
- May be converted to/from Day Scholar by authorized administration.

### 6.2 Day Scholar

- Must have an active membership to use the gym.
- Membership plans, durations and prices are configured by Admin.
- Membership begins immediately after successful purchase.
- Slot bookings must fall within the active membership period.
- Overlapping memberships are not permitted under the current policy.
- At most one future membership may be queued.

### 6.3 Staff

- Staff do not use the student membership or slot-booking constraints.
- Staff may enter and exit the gym normally during permitted gym operating conditions.
- Staff entry and exit shall still be recorded.
- The Staff dashboard shall show the staff member's own entry time, exit time and accumulated hours for visibility of gym commitment.
- Staff working-hour visibility is not a payroll requirement under the current scope.

### 6.4 Authorized / Indefinite Access Persons

- Admins may add non-student/non-staff persons such as owners, authorized outsiders, guests or other approved persons.
- Authorized persons do not require membership or slot booking.
- Their access remains active until an authorized Admin disables or removes it.
- Their entry and exit shall be recorded.
- Authorized persons shall have a dedicated dashboard showing their own access history and current access status.
- Admins shall be able to manage authorized-person records and revoke access.

---

## 7. Functional Requirements

### 7.1 Student Onboarding and Identity

**FR-STU-001** The system shall support bulk student onboarding using a college-provided Excel template.

**FR-STU-002** The system shall provide an example/standard Excel format for onboarding.

**FR-STU-003** The system shall validate uploaded student files before committing valid records.

**FR-STU-004** The system shall produce processing results identifying successful, rejected, and invalid records with reasons.

**FR-STU-005** The college student record shall initially provide: roll number, name, email, phone number, department, joining year, residency, face enrollment reference, emergency contact, address, and health concerns where supplied/collected.

**FR-STU-006** The student's college email shall be used for Google OAuth identity validation.

**FR-STU-007** Student details supplied by the college shall be prefilled and shall not be student-editable unless explicitly designated below.

**FR-STU-008** Students shall be permitted to edit only: phone number, emergency contact, address, and health concerns.

**FR-STU-009** All other student profile fields shall be controlled by authorized administrators/college records.

**FR-STU-010** The system shall support residency changes between Hosteller and Day Scholar through authorized administration.

**FR-STU-011** Student face enrollment shall be associated with the authenticated student's college identity.

**FR-STU-012** A student shall generally submit their own face enrollment and shall not be able to freely replace it after enrollment.

**FR-STU-013** Administrative reset/re-enrollment shall be the controlled path for legitimate biometric changes.

**FR-STU-014** The system shall not use a freely editable face field as a substitute for identity control.

### 7.2 Student Lifecycle

**FR-STU-020** The system shall support a leaving-student import using an Excel file containing roll numbers.

**FR-STU-021** Leaving-student imports shall not assume all students leave in the same academic year.

**FR-STU-022** When a leaving student is processed successfully, the student's operational record shall be marked inactive and transitioned out of hot operational storage according to the data lifecycle policy.

**FR-STU-023** A leaving student shall immediately lose active gym access and future booking eligibility.

**FR-STU-024** Any active membership shall be terminated as part of the leaving-student transition; the gym system does not implement a separate refund/adjustment workflow for this event.

**FR-STU-025** Historical records for leaving students shall remain retrievable from archive subject to retention policy.

**FR-STU-026** An authorized Admin may reactivate a previously inactive/leaving person; reactivation shall restore an active operational status and shall be fully audited.

### 7.3 Student Dashboard

**FR-DASH-STU-001** The student dashboard shall prioritize gym slot booking.

**FR-DASH-STU-002** The dashboard shall show active membership and expiry information when applicable.

**FR-DASH-STU-003** The dashboard shall show upcoming bookings.

**FR-DASH-STU-004** The dashboard shall show past booking/attendance history.

**FR-DASH-STU-005** The dashboard shall show entry/exit history.

**FR-DASH-STU-006** The dashboard shall show no-show/penalty status when applicable.

**FR-DASH-STU-007** The dashboard shall show payment/transaction history relevant to the student.

**FR-DASH-STU-008** The dashboard shall expose notifications.

**FR-DASH-STU-009** Students shall not see live gym occupancy.

**FR-DASH-STU-010** Students shall not receive trainer information as a standard feature.

### 7.4 Membership Management

**FR-MEM-001** Admins shall be able to create, edit, activate, deactivate and manage membership plans.

**FR-MEM-002** Membership plans shall support configurable durations such as week, month, year, or other institution-defined durations.

**FR-MEM-003** Admins shall set the price for each membership plan.

**FR-MEM-004** Memberships shall start immediately after successful purchase under the current policy.

**FR-MEM-005** Overlapping active memberships shall not be permitted.

**FR-MEM-006** A student may have at most one queued future membership.

**FR-MEM-007** The queued membership shall start automatically when the current active membership expires.

**FR-MEM-008** A Day Scholar shall only be allowed to make bookings within the active membership period.

**FR-MEM-009** The system shall maintain complete membership history, including plan, price, start date, expiry date, payment status, transaction information, and historical status.

**FR-MEM-011** The payment integration shall be implemented behind a modular payment-provider abstraction, with Razorpay as the initial provider.

**FR-MEM-012** Membership activation after payment shall be automatic after successful payment confirmation.

### 7.5 Slot Configuration and Booking

**FR-SLOT-001** Admins shall control the gym operating time window.

**FR-SLOT-002** Admins shall control slot duration.

**FR-SLOT-003** Admins shall control buffer duration between slots.

**FR-SLOT-004** Admins shall control capacity per slot.

**FR-SLOT-005** Admins shall control booking-window configuration.

**FR-SLOT-006** Admin configuration shall permit operational slot rules to evolve without code changes where practical.

**FR-BOOK-001** The default booking policy shall expose a 3-day booking window.

**FR-BOOK-002** Within each 3-day booking window, a student may book any 3 eligible slots.

**FR-BOOK-003** The 3-day booking cycle shall continue until the student's membership ends, where membership is required.

**FR-BOOK-004** An already-started slot shall not be bookable.

**FR-BOOK-005** Students may cancel a booking at any time before the slot starts.

**FR-BOOK-006** A cancelled booking shall immediately release its capacity so another eligible student may book the slot.

**FR-BOOK-007** Student-initiated cancellations and no-shows shall use the same configurable violation policy.

**FR-BOOK-008** The default violation threshold shall be the third violation (more than two violations).

**FR-BOOK-009** The default ban duration shall be 3 days and shall be Admin-configurable.

**FR-BOOK-010** Gym-initiated cancellations caused by closures shall not count as student violations.

**FR-BOOK-011** Slot duration shall default to 50 minutes under the current policy.

**FR-BOOK-012** Buffer duration shall default to 10 minutes under the current policy.

**FR-BOOK-013** During the buffer, students from the ending slot may exit and students from the next slot may enter.

**FR-BOOK-014** Slot capacity shall never be exceeded.

**FR-BOOK-015** The system shall handle concurrent booking requests safely at large scale.

**FR-BOOK-016** A booking transaction shall be atomic with respect to capacity allocation.

**FR-BOOK-017** A failed booking shall not consume the student's booking allowance.

**FR-BOOK-018** The exact concurrency/locking/reservation architecture shall be finalized during architecture design.

**FR-BOOK-019** The system shall maintain complete booking history.

**FR-BOOK-020** The default maximum capacity per slot shall be 100 and shall be Admin-configurable.

### 7.6 Booking and Attendance States

The system shall use separate status dimensions for booking lifecycle and physical access/attendance.

**Booking lifecycle states** shall support at least:

- Booked
- Attended
- Completed
- No-show
- Cancelled by gym
- Expired
- Rejected

**Access/attendance states** shall support at least:

- Not entered
- Inside
- Exited

The model may be extended during architecture/design without breaking existing history.

### 7.7 Automated Entry and Exit

**FR-ACCESS-001** The entry camera shall identify the person attempting entry.

**FR-ACCESS-002** Entry validation shall verify the corresponding student record.

**FR-ACCESS-003** Entry validation shall verify membership eligibility where required.

**FR-ACCESS-004** Entry validation shall verify a valid slot booking.

**FR-ACCESS-005** Entry validation shall verify that the current time is within the permitted booking/access window.

**FR-ACCESS-006** Entry validation shall verify that the student has not already entered.

**FR-ACCESS-007** Entry validation shall verify that the student is not already recorded as inside the gym.

**FR-ACCESS-008** The system shall permit entry only when all required eligibility rules succeed.

**FR-ACCESS-009** Slot capacity shall already be enforced through booking; the access layer shall not be the primary capacity-allocation mechanism.

**FR-ACCESS-010** A successful entry shall be recorded with relevant timestamp and access context.

**FR-ACCESS-011** The turnstile shall be used to physically allow or deny passage based on the access decision.

**FR-ACCESS-012** The exit camera shall identify the exiting student where technically supported.

**FR-ACCESS-013** A successful exit shall be recorded.

**FR-ACCESS-014** The entry/exit system shall maintain sufficient records for attendance, conflict handling, occupancy and audit.

**FR-ACCESS-015** The initial access-control platform is ZKBio CV, but vendor-specific machine integration is deferred from the core SRS to the integration/architecture documentation.

**FR-ACCESS-016** The application shall integrate with the access-control layer through a vendor-neutral adapter boundary.

**FR-ACCESS-017** If a critical access-control dependency fails, the system shall notify Admin and pause the affected access-control operation until the college resolves the problem.

**FR-ACCESS-018** Failure and recovery events shall be logged with relevant diagnostic context.

### 7.8 Staff Operations

**FR-STAFF-001** Staff records shall be onboarded through the same controlled Excel upload mechanism used for student records.

**FR-STAFF-002** Staff shall not be subject to student membership or slot-booking constraints.

**FR-STAFF-003** Staff entry and exit shall be recorded.

**FR-STAFF-004** The Staff dashboard shall show the staff member's own entry time, exit time and accumulated hours.

**FR-STAFF-005** Staff hour visibility is for gym commitment tracking and is not a payroll function under the current scope.

### 7.9 Authorized Person Operations

**FR-AUTH-001** Authorized Admins shall be able to create authorized-person records for non-student/non-staff people.

**FR-AUTH-002** Authorized persons shall not require membership or slot booking.

**FR-AUTH-003** Authorized-person access shall remain active until disabled or removed by an authorized Admin.

**FR-AUTH-004** Authorized persons shall have a dedicated dashboard showing their own access history and current access status.

**FR-AUTH-005** Entry and exit activity for authorized persons shall be logged.

**FR-AUTH-006** Revocation of an authorized person's access shall take effect according to access-control system semantics and shall be audited.

### 7.10 Trainer Operations

**FR-TRAIN-001** Trainers shall be able to see students relevant to the current slot.

**FR-TRAIN-002** Trainers shall be able to see students whose slot has expired while the system still records them as inside.

**FR-TRAIN-003** For an overstaying student, the trainer view shall display sufficient identification information including photo, roll number, name, joining year and department.

**FR-TRAIN-004** The trainer shall physically instruct the overstaying student to leave.

**FR-TRAIN-005** The trainer shall not remotely open/close the turnstile as part of the normal overstayer workflow.

**FR-TRAIN-006** Trainers may enter the gym at any time.

**FR-TRAIN-007** Trainer work hours shall be calculated using their recorded entry and exit times.

**FR-TRAIN-008** Trainer working time shall be paid on an hourly basis.

**FR-TRAIN-009** Admins shall configure the trainer hourly rate.

**FR-TRAIN-010** The system shall calculate payable stipend from working duration and configured hourly rate.

**FR-TRAIN-011** Admins shall be able to review trainer working-hour data.

**FR-TRAIN-012** Admins shall be able to export trainer payroll information to Excel, including trainer identity, working hours, hourly rate and calculated amount.

**FR-TRAIN-013** Trainers shall be able to view their working-hour history and estimated/current stipend information permitted by policy.

### 7.11 Trainer Dashboard

**FR-DASH-TRAIN-001** The trainer dashboard shall show the current active slot.

**FR-DASH-TRAIN-002** It shall show expected/current students relevant to the operational slot.

**FR-DASH-TRAIN-003** It shall show students currently inside.

**FR-DASH-TRAIN-004** It shall show overstaying students.

**FR-DASH-TRAIN-005** It shall show current gym occupancy.

**FR-DASH-TRAIN-006** It shall show the trainer's own entry time, accumulated working hours and relevant stipend information.

### 7.12 Admin CRM

**FR-ADM-001** The system shall provide a full gym-management CRM for authorized administrators.

**FR-ADM-002** Admins shall be able to manage student records.

**FR-ADM-003** Admins shall be able to manage residency status.

**FR-ADM-004** Admins shall be able to manage membership plans and student memberships.

**FR-ADM-005** Admins shall be able to configure slots, capacity and operating hours.

**FR-ADM-006** Admins shall be able to manage trainer records, working hours and hourly rates.

**FR-ADM-007** Admins shall be able to view trainer entry/exit details.

**FR-ADM-008** Admins shall be able to manage gym closure calendar entries.

**FR-ADM-009** Admins shall be able to manage and review conflicts/exceptions.

**FR-ADM-010** Admins shall be able to access reports and exports permitted by their role.

**FR-ADM-011** The main admin dashboard shall show student population, current occupancy, today's bookings/attendance, active memberships, payment/revenue summary, trainers currently working, trainer payable data, pending conflicts, recent alerts, upcoming closures, and archival/retention status.

### 7.13 Gym Calendar and Closures

**FR-CAL-001** The system shall provide an admin-managed calendar of gym operating/closed dates.

**FR-CAL-002** Admins shall be able to mark an individual day as closed.

**FR-CAL-003** A closure shall support a reason.

**FR-CAL-004** Closure information shall be visible to affected students and trainers.

**FR-CAL-005** When the gym is unexpectedly closed, affected slots shall be cancelled.

**FR-CAL-006** Affected students shall receive push notifications regarding the cancellation.

**FR-CAL-007** Cancelled bookings shall be rebookable using newly available dates under the current policy.

**FR-CAL-008** Closed days shall be ignored when determining the available 3-day booking window; a closed day does not consume a booking-window day.

**FR-CAL-009** When a closed day interrupts availability, the next available/open day begins or continues the applicable booking window.

**FR-CAL-010** Gym closure cancellations do not count toward the student violation policy.

### 7.14 Notifications

**FR-NOTIF-001** The system shall support push notifications.

**FR-NOTIF-002** The notification framework shall be extensible to relevant system events.

**FR-NOTIF-003** Relevant events shall include, at minimum, booking confirmations, booking reminders, gym closures/cancellations, membership events, payment events, penalties when finalized, and administrative announcements.

**FR-NOTIF-004** The default slot reminder shall be 15 minutes before the slot.

**FR-NOTIF-005** Reminder timing shall be admin-configurable.

**FR-NOTIF-006** Student notification preferences shall not be user-configurable under the current scope.

**FR-NOTIF-007** Email notifications are not required under the current scope; push notifications are the supported notification channel.

### 7.15 Payments

**FR-PAY-001** The system shall support Day Scholar membership payments.

**FR-PAY-002** Payment plan pricing shall come from the admin-configured membership plan.

**FR-PAY-003** Payment success shall activate the membership automatically subject to successful gateway confirmation.

**FR-PAY-004** The system shall record transaction/payment status and relevant transaction identifiers.

**FR-PAY-005** Razorpay shall be the initial payment gateway.

**FR-PAY-006** Payment integration shall remain modular so the provider can be replaced later without redesigning the membership domain.

**FR-PAY-007** Failed or pending payments shall not activate the membership.

**FR-PAY-008** Gateway confirmation shall be reconciled safely when callbacks/webhooks are delayed or retried.

**FR-PAY-009** Students shall receive payment confirmation/receipt information and Admins shall be able to view and reconcile payment transactions.

### 7.16 Conflict and Exception Management

**FR-CON-001** The system shall record operational conflicts and abnormal conditions rather than silently guessing a correction.

**FR-CON-002** Examples include entry without corresponding exit, exit inconsistency, duplicate/contradictory access records, unexpected occupancy state, and other system-data conflicts.

**FR-CON-003** Conflict records shall preserve as much relevant context as reasonably available.

**FR-CON-004** Conflict context should include affected student, date/time, conflict type, original data, device context, relevant booking/membership information, description, resolution actor, resolution action and resolution timestamp when available.

**FR-CON-005** Original records shall not be silently destroyed merely to hide a conflict.

**FR-CON-006** Admins shall investigate and resolve conflicts through controlled database/CRM operations.

### 7.17 Audit Trail

**FR-AUD-001** The system shall maintain an audit trail for sensitive administrative actions.

**FR-AUD-002** The audit trail shall capture actor, timestamp, affected object/record, action, prior value, new value, and relevant context.

**FR-AUD-003** A reason shall be mandatory for sensitive administrative changes.

**FR-AUD-004** Sensitive changes include, at minimum, changes to student identity/status, residency, face enrollment/reset, health information, memberships, payments, bookings/access records, trainer pay data, configuration and administrative permissions.

**FR-AUD-005** Audit history shall not be editable through ordinary CRM functions.

### 7.18 Admin Roles and Super Admin

**FR-RBAC-001** The system shall support role-based access control.

**FR-RBAC-002** Administrative roles shall be configurable rather than requiring one universal Admin role.

**FR-RBAC-003** A Super Admin shall manage administrative roles and permissions.

**FR-RBAC-004** Super Admin shall have unrestricted administrative permissions.

**FR-RBAC-005** A protected primary Super Admin identity shall be hardcoded/configured at system level so it cannot be accidentally deleted through normal application operations.

**FR-RBAC-006** Super Admin shall grant other Admins granular permissions based on what those administrators are authorized to do.

**FR-RBAC-007** Permission management shall support Discord-like capability-based assignment rather than requiring a single fixed Admin role.

Recommended permission areas include student/CRM, memberships/payments, slots/calendar, trainers/payroll, conflicts, reports, archival/data lifecycle, system configuration and audit logs.

### 7.19 Search, Filtering and Large Data Sets

**FR-SEARCH-001** Major Admin and Trainer data views shall support search, sorting, filtering and pagination.

**FR-SEARCH-002** Search shall support common identifiers and attributes such as roll number, name, department, joining year, residency, membership status, booking date/slot, current gym presence, trainer and conflict status where applicable.

**FR-SEARCH-003** The system shall support efficient operation at 25,000+ students.

### 7.20 Reporting and Exports

**FR-REP-001** Admins shall be able to generate reports over controlled From/To date ranges.

**FR-REP-002** Reports shall respect the administrator's permissions.

**FR-REP-003** Reports shall cover, as applicable: attendance, booking/slot utilization, membership sales and revenue, active/expired memberships, entry/exit, no-shows/penalties, trainer working hours and stipend, closures, conflicts, and audit logs.

**FR-REP-004** Reports shall support Excel, CSV and PDF export.

**FR-REP-005** Exported reports shall identify the selected date range and appropriate report metadata.

### 7.21 Data Lifecycle, Archival and Retention

**FR-DATA-001** The system shall use a hot operational data layer for frequently accessed/current data.

**FR-DATA-002** Historical data shall be eligible for migration from hot storage to lower-cost archival storage according to retention policy.

**FR-DATA-003** Archival storage should prioritize storage efficiency and long-term durability.

**FR-DATA-004** Historical operational records should support compressed, partitioned archival formats optimized for analytics/retrieval, subject to architecture selection.

**FR-DATA-005** Archived records shall remain retrievable through authorized application/reporting workflows where policy permits.

**FR-DATA-006** The application should hide hot-versus-archive location from normal administrative users and present a unified historical view where practical.

**FR-DATA-007** The system shall provide an Admin Data Lifecycle/Retention page.

**FR-DATA-008** The retention page shall show data categories, archival eligibility, records approaching policy thresholds, anonymization status, execution history and relevant operational health.

**FR-DATA-009** The current institutional assumption is a 7-year anonymization lifecycle for applicable archived records, subject to legal/institutional policy.

**FR-DATA-010** The anonymization/retention process shall be auditable.

**FR-DATA-011** Data subject to legal, accounting, institutional or active operational retention requirements shall not be prematurely deleted or anonymized.

**FR-DATA-012** Biometric and health data shall follow stricter purpose-based retention rules and shall not automatically be treated like general operational logs.

**FR-DATA-013** After the applicable 7-year archival lifecycle, eligible personal data shall be anonymized, while only data required for legal, audit, statistical or institutional purposes may be retained.

**FR-DATA-014** Direct identifiers and unnecessary personal information shall be removed or irreversibly anonymized during the approved anonymization process.

**FR-DATA-015** The Admin Data Lifecycle page shall support review, execution/status tracking and audit of archival and anonymization operations.

**FR-DATA-016** The system shall support configurable retention policies by data category rather than one global retention period.

### 7.22 Backup and Recovery

**FR-BACK-001** The system shall support backups for operational and critical configuration data.

**FR-BACK-002** Backup and disaster recovery procedures shall be documented and tested.

**FR-BACK-003** Recovery requirements shall cover student identity, memberships, bookings, access records, payments, trainer pay records, audit data and critical configuration.

**FR-BACK-004** Backup retention and recovery-point/recovery-time targets shall be finalized in the architecture/operations phase.

---

## 8. Non-Functional Requirements

### 8.1 Availability

**NFR-AVL-001** The platform shall be designed for 24/7 availability.

**NFR-AVL-002** Planned maintenance shall be controlled and communicated through the administration/operations process.

### 8.2 Scalability

**NFR-SCL-001** The initial design shall support approximately 16,000 students.

**NFR-SCL-002** The system shall support at least 25,000 students in the next-year target population with headroom.

**NFR-SCL-003** Booking, notifications and access services shall be designed for burst traffic rather than only average traffic.

**NFR-SCL-004** The booking engine shall guarantee capacity correctness under concurrent requests.

### 8.3 Performance

**NFR-PERF-001** Normal interactive CRM operations shall remain responsive under expected institutional load.

**NFR-PERF-002** Booking requests during a high-demand release window shall be handled safely without capacity oversubscription.

**NFR-PERF-003** Current gym occupancy and active-slot views shall be suitable for near-real-time operational use.

Exact response-time targets shall be finalized during architecture/performance testing.

### 8.4 Security

**NFR-SEC-001** Data shall be protected in transit and at rest using appropriate encryption.

**NFR-SEC-002** Google OAuth shall be used for student identity authentication under the current design.

**NFR-SEC-003** Role-based access control shall restrict data and operations to authorized users.

**NFR-SEC-004** Sensitive administrative changes shall be audited.

**NFR-SEC-005** Biometric and health data shall receive enhanced access control and protection.

**NFR-SEC-006** Admin and privileged accounts shall use appropriate session security and timeout controls.

**NFR-SEC-007** The system shall support secure backup and disaster recovery.

**NFR-SEC-008** Unauthorized access attempts involving gym entry systems shall be logged where technically possible.

### 8.5 Privacy and Data Minimization

**NFR-PRV-001** The system shall collect and retain only data required for identified operational, safety, legal, institutional or accounting purposes.

**NFR-PRV-002** Health concerns shall not be exposed to trainers or general staff unless specifically authorized and required.

**NFR-PRV-003** Raw face images should not be retained indefinitely by default; the final biometric storage approach shall be determined during technical and privacy design.

**NFR-PRV-004** Historical data lifecycle shall support archival, retention and anonymization.

**NFR-PRV-005** The final retention schedule shall be reviewed by the college against applicable Indian legal and institutional requirements.

### 8.6 Auditability

**NFR-AUD-001** Sensitive data changes shall be attributable to an authenticated administrator.

**NFR-AUD-002** Audit records shall preserve the reason and before/after context for sensitive changes.

**NFR-AUD-003** Audit data shall itself be protected from unauthorized alteration.

### 8.7 Usability

**NFR-USE-001** The student application shall make slot booking the primary action.

**NFR-USE-002** Trainer workflows shall prioritize current operational information.

**NFR-USE-003** Admin workflows shall prioritize search, filtering, configuration, conflicts and reporting.

### 8.8 Extensibility and Maintainability

**NFR-EXT-001** Configurable business rules should be externalized from hard-coded logic where practical.

**NFR-EXT-002** Notification events should be extensible.

**NFR-EXT-003** Payment provider integration shall be replaceable without redesigning the membership domain.

**NFR-EXT-004** Data archival and retention policies shall be configurable by data category.

---

## 9. Core Business Rules

| Rule ID | Business Rule |
|---|---|
| BR-001 | Hostellers use the gym without membership payment under current policy. |
| BR-002 | Day Scholars require an active membership. |
| BR-003 | Hostellers and Day Scholars use the same slot-booking rules. |
| BR-004 | Default booking window is 3 days. |
| BR-005 | A student may book any 3 eligible slots within the current 3-day window. |
| BR-006 | Default slot duration is 50 minutes with a 10-minute buffer. |
| BR-007 | Default maximum capacity per slot is 100; Admin may configure capacity. |
| BR-008 | Capacity can never be exceeded, including under concurrent booking requests. |
| BR-009 | Started/past slots cannot be newly booked. |
| BR-010 | Students may cancel before the slot starts. |
| BR-011 | A student cancellation releases the slot for other eligible students. |
| BR-012 | Student cancellations and no-shows use the same violation policy. |
| BR-013 | More than 2 violations by default triggers a 3-day gym ban; threshold and duration are Admin-configurable. |
| BR-014 | Gym-initiated cancellations due to closure do not count as student violations. |
| BR-015 | The 10-minute buffer permits exits from the ending slot and entries for the next slot. |
| BR-016 | Day Scholar bookings must fall within active membership validity. |
| BR-017 | Membership starts immediately after successful payment. |
| BR-018 | At most one queued future membership may exist; it starts when the current membership expires. |
| BR-019 | Overlapping active memberships are not permitted. |
| BR-020 | A gym closure cancels affected slots and push-notifies affected students. |
| BR-021 | Closed days are ignored when determining the 3-day booking window. |
| BR-022 | Trainers may enter/exit freely; trainer working hours are entry-to-exit duration. |
| BR-023 | Staff have no student booking/membership constraints but their entry/exit is logged. |
| BR-024 | Authorized persons require neither booking nor membership and remain active until revoked. |
| BR-025 | Sensitive admin changes require a reason and audit trail. |
| BR-026 | Super Admin has unrestricted permissions and controls delegated Admin permissions. |
| BR-027 | A protected primary Super Admin identity cannot be deleted through normal application operations. |
| BR-028 | When a student leaves college, active access and future booking eligibility are removed and operational data moves toward archive. |
| BR-029 | A student who leaves with an active membership has that membership terminated by the leaving-student transition. |
| BR-030 | An authorized Admin may reactivate an inactive/leaving person; reactivation is fully audited. |
| BR-031 | Razorpay is the initial payment provider and must be replaceable through a modular integration. |
| BR-032 | Push notifications are the supported notification channel; email is not required. |
| BR-033 | The system is intended for 24/7 availability. |
| BR-034 | Historical operational data may be archived to cost-optimized storage rather than remaining indefinitely in the hot database. |
| BR-035 | Eligible archived personal data enters a 7-year anonymization lifecycle under the current institutional assumption. |

---

## 10. Major User Workflows

### 10.1 Student Onboarding

1. College prepares the prescribed Excel file.
2. Admin uploads the file.
3. System validates records.
4. System reports successful and failed rows with reasons.
5. Valid student records become available.
6. Student signs in through Google OAuth using the authorized college email.
7. Student completes the four editable profile fields as required.
8. Student completes controlled face enrollment.

### 10.2 Day Scholar Membership Purchase

1. Student signs in.
2. Student selects an available membership plan.
3. System displays the Admin-configured price and duration.
4. Student completes payment using the college-provided payment gateway.
5. Gateway confirms successful payment.
6. System activates membership immediately.
7. Membership transaction is recorded.
8. Student can book eligible slots within membership validity.

### 10.3 Slot Booking

1. Student opens the booking experience.
2. System determines the applicable 3-day window, ignoring closed days.
3. System displays eligible slots and remaining capacity (default capacity 100).
4. Student selects a permitted slot.
5. System atomically reserves capacity.
6. System records the booking.
7. Student receives confirmation notification.

### 10.3A Booking Cancellation / Violation

1. Student may cancel before the slot starts.
2. Capacity is released immediately.
3. The released slot becomes available to other eligible students.
4. The cancellation is counted as a student violation.
5. No-shows are counted under the same violation policy.
6. On the default third violation, the student is banned for 3 days; Admin-configured threshold/duration may override the defaults.

### 10.4 Gym Entry

1. Student arrives at entry point.
2. Entry camera captures and matches identity.
3. System checks student record.
4. System checks required membership eligibility.
5. System checks valid booking.
6. System checks access timing.
7. System checks current inside/not-already-entered state.
8. System grants or denies access.
9. Turnstile responds to the decision.
10. Successful entry is logged.

### 10.5 Gym Exit

1. Student reaches exit point.
2. Exit camera identifies the student.
3. System records exit.
4. Access state changes from Inside to Exited.
5. Occupancy and trainer operational views are updated.

### 10.6 Staff / Authorized Person Access

1. Staff or an authorized person is identified by the access-control flow.
2. No student membership or slot check is required.
3. Entry is recorded.
4. Exit is recorded.
5. Staff can view their own time/hours; authorized persons can view their own access dashboard.

### 10.7 Trainer Monitoring

1. Trainer opens operational dashboard.
2. System shows the current slot and student population.
3. System identifies students still inside after their slot has ended.
4. Trainer views photo and identifying details.
5. Trainer physically asks the student to leave.
6. Any unresolved inconsistency may be captured as a conflict/exception.

### 10.8 Trainer Payroll

1. Trainer enters and exits normally.
2. System records timestamps.
3. Working duration is calculated from entry to exit.
4. Admin-configured hourly rate is applied.
5. System calculates payable stipend.
6. Admin exports payroll information to Excel.

### 10.9 Gym Closure

1. Admin marks a date as closed and provides a reason.
2. System identifies affected bookings/slots.
3. Affected slots are cancelled.
4. Students receive push notifications.
5. Newly opened availability can be used for rebooking under current policy.

### 10.10 Leaving Student

1. College supplies roll numbers of students who have left.
2. Admin uploads the file.
3. System validates the list.
4. Matching students are marked inactive.
5. Active access and future booking eligibility are disabled.
6. Operational records are moved toward archival storage.
7. Historical records remain retrievable under policy.

### 10.11 Conflict Resolution

1. System detects or an Admin notices an inconsistency.
2. A conflict record is created with maximum relevant context.
3. Original evidence is preserved.
4. Admin investigates.
5. Admin makes any required authorized CRM correction.
6. The correction is audited, including reason, actor, timestamp and before/after values.

### 10.12 Data Archival and Anonymization

1. Data lifecycle service identifies records eligible for archival.
2. Historical records are migrated to cost-optimized archive storage.
3. Application keeps appropriate historical references/indexes.
4. Retention page shows records approaching policy thresholds.
5. After the approved retention period, eligible data enters anonymization workflow.
6. The anonymization process is logged and auditable.
7. Biometric and health data follow stricter, purpose-based rules.

---

## 11. Data Requirements

### 11.1 Student Data

- Roll number
- Name
- Email
- Phone number
- Department
- Joining year
- Residency
- Face enrollment reference/template as technically finalized
- Emergency contact
- Address
- Health concerns
- Account status

### 11.2 Booking Data

- Booking identifier
- Student identifier
- Slot identifier
- Booking timestamp
- Slot date/time
- Booking status
- Attendance/access status
- Entry timestamp
- Exit timestamp
- No-show/penalty data when finalized
- Closure cancellation indicator
- Rebooking linkage where applicable

### 11.3 Membership Data

- Membership identifier
- Student identifier
- Plan identifier
- Plan name
- Duration
- Price
- Start date
- End date
- Payment status
- Transaction identifier
- Membership status
- Historical lifecycle events

### 11.4 Trainer Data

- Trainer/student identifier
- Entry timestamps
- Exit timestamps
- Working duration
- Hourly rate
- Calculated stipend
- Payroll/export history

### 11.5 Conflict Data

- Conflict identifier
- Conflict type
- Affected entity
- Student/trainer context
- Original records/context
- Device/camera context where available
- Timestamps
- Description
- Resolution status
- Resolution action
- Resolver identity
- Resolution timestamp

### 11.6 Audit Data

- Audit event identifier
- Actor
- Role
- Timestamp
- Affected object
- Action
- Old value
- New value
- Reason
- Context/metadata

### 11.7 Operational Configuration Data

- Gym operating hours
- Slot duration
- Buffer duration
- Capacity
- Booking-window settings
- Membership plans
- Membership prices
- Trainer rates
- Notification timing
- Closure calendar
- Administrative roles and permissions
- Retention/archival policies

---

## 12. Permission Baseline

| Capability | Student | Trainer | Staff | Authorized Person | Admin | Super Admin |
|---|:---:|:---:|:---:|:---:|:---:|:---:|
| Own profile | Edit 4 fields | Own permitted data | Own permitted data | Own permitted data | Manage | Manage |
| Own bookings | View/book | - | - | - | Manage | Manage |
| Own membership | View | - | - | - | Manage | Manage |
| Student directory | No | Operational subset | No | No | Yes | Yes |
| Current occupancy | No | Yes | No | No | Yes | Yes |
| Trainer data | No | Own | No | No | Authorized | Yes |
| Health information | Own | No by default | No | No | Authorized | Yes, subject to policy |
| Payments | Own | No | No | No | Authorized | Yes |
| Slots/calendar | View availability | View operations | No | No | Manage | Manage |
| Conflicts | No | Operational visibility as needed | No | No | Manage | Manage |
| Reports | Personal only | Own work data | Own hours | Own access | Authorized | All |
| Roles/permissions | No | No | No | No | Delegated | Manage |
| Retention/anonymization | No | No | No | No | Authorized | Yes |
| System configuration | No | No | No | No | Delegated | Yes |

The exact preconfigured admin role names may be chosen by the Super Admin; capability-level permission assignment is the required model.

---

## 13. Admin Configuration Requirements

The design principle is that business rules expected to change should be **Admin-configurable** rather than embedded as fixed constants wherever practical.

Recommended configurable areas:

1. Gym operating hours
2. Slot duration
3. Buffer duration
4. Slot capacity
5. Booking-window settings
6. Membership duration options
7. Membership pricing
8. Trainer hourly rate
9. Notification timing
10. Gym closure calendar
11. Residency status transitions
12. Admin roles and permissions (Super Admin controlled)
13. Data retention/archival policies
14. Report/export availability by role
15. Cancellation-violation threshold
16. Cancellation/no-show ban duration
17. Future operational rules as requirements evolve

Configuration changes affecting active operations should be audited and should take effect according to controlled configuration semantics defined in architecture.

---

## 14. Data Architecture Requirement

The system shall separate **operational hot data** from **historical archival data**.

### 14.1 Hot Data

Examples:

- Active students
- Active memberships
- Upcoming/current bookings
- Current gym presence
- Recent access events
- Recent conflicts
- Current trainer work records
- Active configuration

### 14.2 Archive Data

Examples:

- Historical bookings
- Historical entry/exit logs
- Historical memberships
- Historical trainer payroll
- Historical conflicts
- Historical notifications
- Historical audit records

### 14.3 Archive Characteristics

The archive should be optimized for:

- Low storage cost
- High durability
- Compression
- Partitioning by logical date/category
- Historical reporting
- Controlled retrieval

A columnar compressed format such as Parquet with Zstandard is a recommended implementation candidate, not a mandatory technology choice.

---

## 15. Concurrency and Capacity Requirement

The booking subsystem is expected to experience bursts, especially when a new 3-day booking window becomes available.

The system shall behave like a high-integrity reservation system:

- Capacity must never be exceeded.
- Concurrent requests must be serialized/controlled as required.
- The same slot must not be oversold.
- Failed booking attempts must not consume booking quota.
- Duplicate submission/retry behavior must not create duplicate bookings.
- Exact locking, optimistic/pessimistic strategy, reservation tokens, queues, database constraints and scaling model are architecture-phase decisions.

---

## 16. Privacy, Security and Governance Considerations

The system processes ordinary identity/account information as well as potentially sensitive health and biometric information.

The implementation should therefore follow these principles:

- Data minimization
- Purpose limitation
- Least-privilege access
- Strong authentication for privileged users
- Encryption in transit and at rest
- Auditability
- Controlled retention
- Secure anonymization
- Secure deletion where appropriate
- Restricted access to health and biometric information
- Explicit institutional/legal review of final retention periods and privacy procedures

The college's legal/privacy stakeholders should validate the final retention and processing policy against applicable Indian law and institutional policy before production deployment.

---

## 17. Open Questions / Architecture-Phase Decisions

No major business-policy questions remain unresolved in the current requirements baseline. The remaining TBD items are technical/design decisions:

| ID | Decision | Owner/Phase |
|---|---|---|
| OQ-001 | Exact biometric storage representation and face-matching implementation | Architecture/Privacy |
| OQ-002 | Exact ZKBio CV API endpoints, authentication, event/polling model and vendor payload mapping | Integration/Architecture |
| OQ-003 | Exact WebSocket/realtime topology, broker and horizontal-scaling strategy | Architecture |
| OQ-004 | Exact camera/turnstile failure and recovery mechanics below the required pause/notify behavior | Architecture/College Operations |
| OQ-005 | Final legal/institutional retention schedule and anonymization validation | College/Legal/Privacy |
| OQ-006 | Backup RPO/RTO targets | Architecture/Operations |
| OQ-007 | Exact performance/SLA targets | Architecture/Performance |

---

## 18. Architecture Handoff Requirements

The following must be explicitly addressed during architecture design:

1. High-concurrency slot booking and hard capacity enforcement.
2. Database transaction strategy and uniqueness/locking constraints.
3. Hot/archive data movement architecture.
4. Historical cross-storage querying.
5. Face-recognition enrollment and matching architecture.
6. Secure biometric storage.
7. Entry/exit camera and turnstile integration.
8. Failure and offline/partial-connectivity behavior.
9. Notification delivery architecture and retry handling.
10. Payment gateway abstraction.
11. Role/permission implementation.
12. Protected Super Admin mechanism.
13. Audit-log immutability/protection.
14. Backup, disaster recovery and recovery testing.
15. Scaling model for 25,000+ students and burst traffic.
16. Rate limiting, abuse protection and duplicate-request handling.
17. Monitoring, alerting and operational observability.
18. Data archival format, partitioning, compression and lifecycle jobs.
19. Secure anonymization process and verification.
20. Privacy and compliance controls for health and biometric data.

---

## 19. Acceptance Criteria Summary

The SRS baseline should be considered successfully implemented only when the following are demonstrably true:

1. A valid Hosteller can authenticate and book a slot without membership payment.
2. A valid Day Scholar can purchase a configured membership and book only during valid membership dates.
3. A started/past slot cannot be booked.
4. Slot capacity cannot be exceeded under concurrent booking tests.
5. Valid students can pass entry validation and have entry recorded.
6. Exit is recorded and reflected in occupancy/access state.
7. Trainers can identify current and overdue students using the required information.
8. Trainer work hours and stipend can be calculated from entry/exit data.
9. Admins can configure slots, capacity, memberships, rates and closures.
10. Closure cancellation produces push notifications and rebooking opportunity under current policy.
11. Bulk student onboarding returns clear processing results.
12. Leaving-student imports deactivate students and start archival transition.
13. Sensitive administrative changes require a reason and create audit records.
14. Historical data can be archived without losing authorized retrievability.
15. The Admin data lifecycle page can manage archival/anonymization status.
16. Reports can be generated using controlled From/To ranges and exported as Excel, CSV and PDF.
17. Role-based permissions prevent unauthorized access to sensitive data.
18. The platform supports 24/7 operation and is architected for the 25,000+ student scale target.

---

## 20. Recommended Initial Release Boundaries

### Release 1 / Core

- Student onboarding
- Google OAuth
- Student profile
- Hosteller/Day Scholar logic
- Membership plans and payments
- Slot booking
- Capacity enforcement
- Entry/exit integration
- Trainer dashboard
- Admin CRM
- Push notifications
- Closures
- Basic reports
- Audit trail
- Staff dashboard
- Authorized-person dashboard
- Booking cancellation and violation/ban policy
- Razorpay payment integration
- Basic hot/archive lifecycle

### Release 1.1 / Operational Hardening

- Advanced conflict handling
- Trainer payroll exports
- Advanced filters/search
- Hot/archive migration
- Data lifecycle page
- Anonymization workflow
- Advanced reporting
- Backup/recovery automation

### Future / Architecture-Dependent

- Advanced access-control failure/recovery implementation
- Advanced analytics
- Additional preconfigured administrative permission templates
- Advanced privacy/anonymization verification tooling

---

## 21. Notes for Future Architecture Document

This SRS intentionally describes **what the system must achieve**, not the final technology stack.

The following decisions should be captured in Architecture Decision Records (ADRs) and C4 diagrams:

- Booking concurrency model
- Primary database and indexing strategy
- Hot/archive storage design
- Access-control device integration
- Biometric subsystem architecture
- Event/notification architecture
- Payment gateway abstraction
- RBAC implementation
- Audit logging and immutability
- Backup/disaster recovery
- Security boundaries
- Deployment topology
- Monitoring/observability

---

## 22. Requirement Traceability Convention

Requirement IDs use the following prefixes:

- `FR-*` — Functional Requirement
- `NFR-*` — Non-Functional Requirement
- `BR-*` — Business Rule
- `OQ-*` — Open Question

Future architecture components, APIs, test cases and ADRs should reference these IDs where practical so that implementation and testing remain traceable to the approved requirements.

---

## 23. Approval / Sign-Off

| Role | Name | Date | Status |
|---|---|---|---|
| College/Gym Owner | TBD | TBD | Pending |
| Super Admin / System Owner | TBD | TBD | Pending |
| Product/Requirements Owner | TBD | TBD | Pending |
| Technical Lead | TBD | TBD | Pending |
| Privacy/Legal Reviewer | TBD | TBD | Pending |

---

## Appendix A — Current Assumptions

1. The college is the authoritative source for initial student identity data.
2. Google OAuth is used for student identity validation.
3. Students do not use trainer information as part of the student UI.
4. Trainers are students receiving a college stipend.
5. Trainers' pay is based on recorded entry-to-exit duration.
6. Students cannot directly override college-controlled profile attributes.
7. Push notifications are available in the system.
8. Email notifications are not required; push notifications are the supported notification channel.
9. Razorpay is the initial payment gateway behind a modular provider abstraction.
10. The system needs to support approximately 25,000 students and burst booking demand.
11. Staff are onboarded by Excel, have no student booking/membership constraints, and can view their own entry/exit hours.
12. Authorized persons are Admin-added, require no membership/booking, and remain active until revoked.
13. Data should not be kept indefinitely in the transactional database when it can be safely archived.
14. Seven years is the current institutional anonymization assumption for applicable archived data, subject to final policy/legal confirmation.

---

## Appendix B — Interview Baseline Decisions

The requirements in this document were gathered interactively from the system owner and represent the current agreed baseline. Any later policy change should be versioned rather than silently replacing this baseline.
