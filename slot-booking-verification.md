# Slot Booking Window — Verification Report + Required Changes

Date: 2026-09-30 | Branch state: `booking.service.ts`, `reservation.service.ts`, `tests/booking.test.ts` modified + `per-user-window-plan.md` (new)

## 1. Verdict

**Booking slot logic is working correctly with the per-user first-booking anchored window method.** No functional changes required. Two small fixes were already applied during this check (§3). One optional performance note in §4. This method is useful for users — see §5.

## 2. What was checked

| Area | File | Result |
|------|------|--------|
| Window build (locked days extend, 14-day cap) | `backend/src/modules/booking/booking.service.ts` (`buildBlockFrom`, `loadLockedMap`) | OK |
| Per-user anchor + greedy-partition expiry | `booking.service.ts` (`getUserWindowDates`) | OK |
| Global window preserved for scheduler/slot generation | `booking.service.ts` (`getRollingWindowDates`, `ensureSlotsForWindow`) | OK |
| Per-user date check + window quota on reserve | `backend/src/modules/booking/reservation.service.ts` (`createBooking`) | OK |
| Daily quota (3/day), capacity, pass, ban — unchanged | `reservation.service.ts` | OK |
| Display (`windowDates`, labels, counts) | `booking.service.ts` (`getSlotsForDate`, `getRollingWindowSlots`) | OK, 1 fix (§3.2) |
| Controller wiring (studentId passthrough, anon fallback) | `booking.controller.ts`, `booking.routes.ts` | OK |

## 3. Changes applied during this check (required)

### 3.1 Fixed 2 pre-existing test failures — `backend/tests/booking.test.ts:27-42`
Tests called async `getRollingWindowDates()` / `isDateInRollingWindow()` without `await` (broken before this feature too — methods were already `async`). Added `await` and destructured `{ dates }`.
Evidence before fix: `booking.test.ts 5 tests | 2 failed` → after fix: `13/13 pass` across `booking.test.ts` + `reservation.test.ts`.

### 3.2 Fixed `dayLabel` mislabel — `booking.service.ts` (`getSlotsForDate`)
Old: `dates[0]` → `'Today'`. With a locked window `[23,24,25]` viewed on the 24th, yesterday (23rd) was labeled Today.
New: label derived from real IST date (`todayStr` → Today, `today+1` → Tomorrow), independent of window position.

## 4. Optional (not required, no behaviour change)

1. **Double slot-ensure (perf only):** `getRollingWindowSlots()` calls `ensureSlotsForWindow()` once, then each `getSlotsForDate()` calls it again (3–4 DB scans per window view). Safe to leave; if optimizing, add a `skipEnsure` flag to `getSlotsForDate()`.
2. **Docs refresh:** `slot_booking_features.md` (Feature 1, 2, 7) and `gym_booking_workflow.md` (Step 3, 5) still describe the old global rolling window. Update wording to per-user lock/slide per `per-user-window-plan.md` §5 when convenient.

## 5. Test evidence

- `npx tsc --noEmit` → clean.
- `npx vitest run tests/booking.test.ts tests/reservation.test.ts` → **13/13 passed** (was 11/13 before §3.1).
- Pure-logic simulation of partition + quotas → **9/9 passed**: lock on first booking, stays locked mid-window, expiry gives fresh `[26,27,28]`, idle slides daily, re-lock on booking, closure extends window, uneven `2+0+1` passes daily (`<3`) and window (`3/3`) quotas.

## 6. Why this method is useful for the user

Each student gets their own three-working-day window instead of sharing one global calendar. Late joiners are not punished for missing earlier days, idle students always see the next available working days, and active students get a predictable locked block with clear messages showing their exact window dates. Uneven booking inside the window (e.g. 2+0+1) is allowed, unused quota is cleanly reset at expiry, and the next window opens at midnight IST automatically.
