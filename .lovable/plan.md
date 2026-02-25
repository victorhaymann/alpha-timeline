

# Fix Gantt View Modes: Weekly, Monthly, Project

## The Problem

All three view modes (Weekly, Monthly, Project) set the date range to the **full project duration**. The only difference between them is how columns are grouped (days vs weeks), but the visible window is always the same. This means:

- **Weekly** shows 6+ weeks of individual day columns instead of just 5 working days
- **Monthly** shows the entire project range instead of ~1 month of days
- **Project** works acceptably (shows full range with week-grouped columns) but the date picker shows a confusing range

## The Fix

Change `handleViewModeChange` to set the correct date window per mode, and update `navigatePeriod` to shift by the correct amount.

### View Mode Behavior

| Mode | Date Window | Navigation Step | Columns |
|------|------------|-----------------|---------|
| **Weekly** | Monday of current week → Friday of current week (5 working days) | ±1 week (7 calendar days) | Individual days |
| **Monthly** | Today → Today + 1 month | ±1 month | Individual days |
| **Project** | Project start → Project end (full duration) | Navigation disabled | Week-grouped columns (W1, W2...) |

### File: `src/components/timeline/GanttChart.tsx`

**`handleViewModeChange` (lines 365-369):**

Replace the single "set full project range" logic with mode-specific date windows:

- `week`: Calculate Monday of the current week → Friday of the current week. Use `startOfWeek` and `endOfWeek` from date-fns (with `weekStartsOn: 1` for Monday). Then trim to Friday (5 working days).
- `month`: Set from today → `addMonths(today, 1)`.
- `project`: Set from `validStartDate` → `validEndDate` (full project, as it works today).

**`navigatePeriod` (lines 372-403):**

The weekly navigation already shifts by 7 days (correct). The monthly navigation already shifts by 1 month (correct). Project view already returns early (correct). No changes needed here -- the issue is purely in the initial date range set by `handleViewModeChange`.

**Initial state (line 146, 156-158):**

The default `viewMode` is `'month'` and the default `dateRange` is the full project range. Update the initial `dateRange` to reflect monthly: today → today + 1 month. This ensures the first render matches the selected mode.

### Summary of Changes

| File | Change |
|------|--------|
| `src/components/timeline/GanttChart.tsx` | Fix `handleViewModeChange` to set mode-appropriate date windows. Fix initial `dateRange` state to match default `viewMode`. Add `startOfWeek`/`endOfWeek` imports from date-fns. |

No other files need changes. The `useGanttCalculations` hook, `GanttHeader`, and all other components already work correctly with whatever date range is passed in.

