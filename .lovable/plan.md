

# Plan: Enable Bidirectional Scrolling in All Gantt Charts

## Root Cause

### Dashboard Gantts (ProjectsGantt + StaffGantt)
Both use `getTimelineRange()` which generates a fixed window: `today - 14 days` to `today + 12 weeks`. With only ~10 working days to the left of today and a `DAY_W` of 32px, that's only ~320px of past content. Once the viewport is wider than that, there's nothing to scroll left into — the scroll container has no overflow on the left side.

### Project Gantt
The date range is `projectStartDate` to `projectEndDate`. The auto-scroll positions the view at "today". If the project started recently, there's minimal content to the left of today. However, the bigger issue is that if the project started months ago, the full range is rendered but the initial scroll goes to today — scrolling left should already work here unless the project start date is very close to today.

## Solution

### 1. Dashboard Gantts — Extend past range
**Files:** `src/components/dashboard/ProjectsGantt.tsx` and `src/components/dashboard/StaffGantt.tsx`

Change `getTimelineRange()` in both files:
- **Before:** `start = today - 14 days`, `end = start + 12 weeks`
- **After:** `start = today - 8 weeks`, `end = today + 12 weeks`

This gives ~40 working days to the left of today (enough scrollable content in the past). The range becomes 20 weeks total, which is reasonable.

Add an initial scroll-to-today `useEffect` so the view opens centered on today rather than at the far left. This way users see the current week on load but can scroll freely in both directions.

### 2. Project Gantt — Extend past padding
**File:** `src/components/timeline/GanttChart.tsx`

No change needed if the project already has a start date in the past. The full project range is rendered and scrollable. The auto-scroll to today already works. If the user's project started only recently, scrolling left is inherently limited — this is correct behavior (there are no dates before the project start).

However, to be safe and consistent, add a small buffer: extend `viewStart` by 1 week before `projectStartDate` so there's always some scrollable past content even at the project boundary.

## Specific Changes

### `src/components/dashboard/ProjectsGantt.tsx`
- Update `getTimelineRange()`: change `-14` to `-8 * 7` (8 weeks back)
- Add `useEffect` to auto-scroll to today on mount:
  ```
  useEffect(() => {
    if (scrollRef.current && todayIdx >= 0) {
      const targetX = Math.max(0, todayIdx * DAY_W - scrollRef.current.clientWidth / 3);
      scrollRef.current.scrollLeft = targetX;
    }
  }, [todayIdx]);
  ```

### `src/components/dashboard/StaffGantt.tsx`
- Same `getTimelineRange()` update: `-14` to `-8 * 7`
- Same auto-scroll `useEffect` on mount

### `src/components/timeline/GanttChart.tsx`
- When computing `viewStart`, subtract 7 calendar days from `validStartDate` as a buffer:
  ```
  const viewStart = dateRange?.from 
    ? addDays(dateRange.from, -7) 
    : addDays(validStartDate, -7);
  ```
  This ensures there's always scrollable content before the first task.

## Result
- Dashboard Gantts: ~8 weeks of past visible by scrolling left, ~12 weeks of future by scrolling right, centered on today on load
- Project Gantt: 1-week buffer before project start, full project duration rendered, auto-scrolled to today
- All three Gantt views support free bidirectional horizontal scrolling

