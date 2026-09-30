# Per-User First-Booking Anchored Slot Window — Implementation Plan

## 1. Goal

Replace **global rolling window** (`[today, today+1, today+2]` for all users) with a **per-user lazy-start block window** anchored to the user's first booking.

Rules agreed with user:

1. `windowDays = 3` open days (default). Locked/closure days are shown but do NOT count — window extends to next working day.
2. If user books on 23rd, window locks to `[23,24,25]`, max 3 bookings inside (max 3/day also applies).
3. Unused quota is wasted at expiry. On 26th a fresh window starts.
4. If user books nothing, window is NOT locked — it slides daily: on 26th `[26,27,28]`, on 27th (still nothing) `[27,28,29]`.
5. Once user books (e.g. on 27th), window locks to `[27,28,29]` until expiry.

## 2. Current Behaviour (to replace)

- `backend/src/modules/booking/booking.service.ts:204-239` `getRollingWindowDates()` — starts from `today(IST)`, counts `windowDays` open days. Same for all users. Registration / first-booking date ignored.
- `backend/src/modules/booking/reservation.service.ts:140,233-248` — `isDateInRollingWindow()` + window quota `COUNT WHERE slot_date IN globalWindow`. Old bookings haunt next days.
- `slot_configs.windowMode` (`block|rolling`) is stored but never read (`grep windowMode`).

Slot generation (`ensureSlotsForWindow()`) stays global — only visibility/validation becomes per-user.

## 3. Examples

### Example A — active user
```
User1 first books 23rd => locked [23,24,25], can book max 3 inside.
26th => expired => new prospective [26,27,28].
```

### Example B — idle user slides
```
26th: no booking => display [26,27,28]
27th: still no booking => display slides to [27,28,29]
27th: books 1 => locked to [27,28,29], max 3 inside
30th: expired => new [30,01,02]
```

### Example C — with closure
```
windowDays=3, 27th = holiday.
Prospective from 26th => [26,27(locked),28,29] = 3 open + 1 locked.
```

### Example D — two users diverge
```
User1 registered Mon, first booked Mon22 => [Mon22,Tue23,Wed24]
User2 registered Fri, no booking yet on Fri26 => [Fri26,Mon29,Tue30]
Same calendar day, different windows + different quota counts.
```

### Example E — uneven split inside one window (allowed)
```
Window [23,24,25], max 3/day + max 3/window:
23: 2 bookings OK, 24: 0 OK, 25: 1 OK => total 3/3.
4th booking anywhere in [23,24,25] => rejected (window quota).
```

## 4. Algorithm (stateless, no migration)

Add `getUserWindowDates(studentId?, config?)` in `BookingService`. No new table — derive anchor from `booking.bookings` (status=`booked`).

> IMPORTANT — expiry fix (Claude's first version was wrong here):
> Do NOT loop every booked date independently (`for each d: buildBlock(d); if contains today return`).
> That extends the window forever: booked `[23,24,25]`, today=26 → anchor 24 gives `[24,25,26]` contains 26 → wrongly locked.
> Correct: partition bookings into non-overlapping blocks greedily from the earliest date. Only the block that owns today locks. Expired blocks are skipped.

Pseudocode (fixed):

```ts
async getUserWindowDates(studentId?: string, config?: SlotConfigDto) {
  cfg = config ?? await getSlotConfig();
  lockedMap = await loadLockedMap();
  today = formatISTDate();

  if (!studentId) return { dates: buildBlockFrom(today, windowDays, lockedMap), lockedMap, anchor: today, locked: false };

  bookedDates: string[] = unique sorted slot_dates WHERE student AND status='booked' AND slot_date > today-14d;

  // Greedy partition into non-overlapping blocks
  let i = 0;
  while (i < bookedDates.length) {
    const start = bookedDates[i];
    const block = buildBlockFrom(start, windowDays, lockedMap);
    const set = new Set(block);
    if (set.has(todayStr)) return { dates: block, lockedMap, anchor: start, locked: true };
    if (start > todayStr) return { dates: block, lockedMap, anchor: start, locked: true }; // future (defensive)
    while (i < bookedDates.length && set.has(bookedDates[i])) i++; // skip consumed dates
    // else: block expired (blockEnd < today) → continue to next uncovered booking
  }
  // No containing block → idle: prospective block starting at today
  return { dates: buildBlockFrom(today, windowDays, lockedMap), lockedMap, anchor: today, locked: false };
}

helper buildBlockFrom(startDate: string, windowDays: number, lockedMap): string[] {
  // walk forward max 14d from startDate, push each date,
  // count open only, stop at windowDays open. Include locked dates pushed.
}
```

Notes:
- `getRollingWindowDates()` KEEP for scheduler/slot-generation. Refactor shared `buildBlockFrom()` + `loadLockedMap()` so both use same closure logic.
- `isDateInUserWindow(dateStr, studentId?)` replaces `isDateInRollingWindow()` in booking path.
- Quota query changes from `s.slot_date = ANY(globalWindow)` to `= ANY(myWindow)`.

## 5. File-by-File Changes

### 5.1 `backend/src/modules/booking/booking.service.ts`
- [ ] Extract `loadLockedMap(): Promise<Map<string,string>>` from `getRollingWindowDates()`.
- [ ] Extract `buildBlockFrom(startStr, desiredOpenDays, lockedMap): string[]`.
- [ ] Refactor `getRollingWindowDates()` to use helpers (no behaviour change — used by scheduler + `ensureSlotsForWindow()`).
- [ ] Add `getUserWindowDates(studentId?, config?)` per §4 (USE FIXED greedy-partition loop, not per-date loop).
- [ ] Add `isDateInUserWindow(dateStr, studentId?)`.
- [ ] Change `getSlotsForDate(dateStr, studentId?, config?)` to use `getUserWindowDates(studentId)`.
- [ ] Change `getRollingWindowSlots(studentId?)` to use `getUserWindowDates(studentId)`. Keep response shape.
- [ ] Keep `ensureSlotsForWindow()` on GLOBAL window. Do NOT per-user generate.

### 5.2 `backend/src/modules/booking/reservation.service.ts`
- [ ] `createBooking()`: replace `isDateInRollingWindow(slotDateStr)` with per-user `getUserWindowDates(studentTableId)` check.
- [ ] Window quota: replace `getRollingWindowDates()` with `getUserWindowDates(studentTableId)`, count `IN myWindow`.
- [ ] Daily quota (max 3/day) UNCHANGED.
- [ ] No change to Redis lock / `FOR UPDATE` / capacity / membership / ban logic.

### 5.3 Controller/routes + frontend
- [ ] No new endpoints. `GET /slots/window` already forwards optional `studentId`; anon gets global prospective.
- [ ] No response-shape break.

## 6. Edge Cases

| # | Case | Expected |
|---|------|----------|
| 1 | Anon views slots | Global prospective `[today..]` |
| 2 | Past booking in expired block, today outside | Ignored, new anchor=`today` (expiry fix) |
| 3 | Cancelled booking | Excluded (`status='booked'` only) |
| 4 | 4th booking in same window | `409 Max 3 in your window` |
| 5 | Date outside `myWindow` | `400 outside your window [..]` |
| 6 | Closure inside locked window | Window rebuild extends by 1 day |
| 7 | Today itself locked | Prospective starts today(locked) + next 3 open |

## 7. Acceptance Criteria

- [ ] Book 23rd → window `[23,24,25]` locked.
- [ ] New user, no bookings → `[today..]` sliding.
- [ ] Booked `[23,24,25]` 3/3 → 4th rejected; on 26th fresh `[26,27,28]` 0/3 (NOT `[24,25,26]` — expiry-fix check).
- [ ] Idle on 26th `[26,27,28]`; 27th no booking `[27,28,29]`.
- [ ] `2+0+1` split passes; quota counts only `myWindow`.
- [ ] `tsc --noEmit` passes.

## 8. Prompt for Claude (copy-paste)

> Implement per-user first-booking anchored lazy-start block window per this plan. Files: `backend/src/modules/booking/booking.service.ts` (add `getUserWindowDates` with FIXED greedy-partition loop from §4, `isDateInUserWindow`, refactor helpers, wire into `getSlotsForDate`/`getRollingWindowSlots`), `backend/src/modules/booking/reservation.service.ts` (use per-user window for date check + window quota). Keep `ensureSlotsForWindow` global. No DB migration. Verify with `tsc`. IMPORTANT: do not use per-date `for (anchor of bookedDates) if block.contains(today) return` — use §4 partition loop so expired windows close.
