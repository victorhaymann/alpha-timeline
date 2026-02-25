

# Fix: Timezone-Induced Date Shift in Dashboard Gantt Charts

## Root Cause

The bug is a classic **UTC vs local timezone** mismatch. Here is the chain:

1. **Database** stores dates as strings like `"2026-03-09"` (a Monday).
2. **`Dashboard.tsx`** (lines 96-102, 116-117) parses them with `new Date("2026-03-09")`, which JavaScript interprets as **UTC midnight** — i.e. `2026-03-09T00:00:00Z`.
3. In UTC+1 (Paris), that becomes `2026-03-08T23:00:00` local time — **the previous day** (Sunday).
4. **`dayIndex()`** in `ProjectsGantt.tsx` (line 191-196) and `StaffGantt.tsx` (line 231-236) uses `days[i] >= date`. The `days` array is built with `addDays()` which produces **local midnight** dates. So a UTC-midnight date that maps to the previous evening in local time gets matched to the wrong grid column.

This only affects dates where the UTC-to-local shift crosses midnight — which is why it hits some phases but not all.

## Fix (3 files, minimal changes)

### 1. `src/pages/Dashboard.tsx`

Add a `parseLocalDate` helper that splits `"YYYY-MM-DD"` and constructs `new Date(year, month-1, day)` (local midnight). Replace all 6 occurrences of `new Date(dateString)` for task/project dates with `parseLocalDate(dateString)`.

Lines affected: ~96, 98, 99, 102, 116, 117 — plus the same pattern in the staff assignment builder (~140-155).

### 2. `src/components/dashboard/ProjectsGantt.tsx`

Fix `dayIndex` (lines 191-196) to compare by calendar date instead of timestamp:

```typescript
function dayIndex(date: Date): number {
  for (let i = 0; i < days.length; i++) {
    if (
      days[i].getFullYear() === date.getFullYear() &&
      days[i].getMonth() === date.getMonth() &&
      days[i].getDate() === date.getDate()
    ) return i;
    if (days[i] > date) return i;
  }
  return days.length - 1;
}
```

### 3. `src/components/dashboard/StaffGantt.tsx`

Same `dayIndex` fix (lines 231-236) — identical change.

Also fix the staff assignment date parsing in `Dashboard.tsx` (lines ~140-155) where `new Date(t.start_date!)` and `new Date(t.end_date!)` are used for staff assignment bars.

## Summary

| File | Change |
|------|--------|
| `src/pages/Dashboard.tsx` | Add `parseLocalDate()` helper. Replace all `new Date(dateString)` with `parseLocalDate(dateString)` for task/project/assignment dates. |
| `src/components/dashboard/ProjectsGantt.tsx` | Fix `dayIndex` to compare year/month/day instead of timestamp. |
| `src/components/dashboard/StaffGantt.tsx` | Same `dayIndex` fix. |

No logic duplication. No new dependencies. Just correcting how date strings are parsed and compared.

