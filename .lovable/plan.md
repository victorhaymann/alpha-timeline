

# Add Horizontal Scroll Navigation to Gantt Timeline

## The Problem

The arrow buttons and keyboard arrows correctly shift the date window (±1 week or ±1 month). But the user cannot achieve the same by **scrolling horizontally** with a trackpad or mouse wheel. The timeline content fits exactly within the viewport, so there is nothing to scroll.

## The Solution

Render the **full project duration** as the underlying date range for all view modes, making the timeline physically wider than the viewport. Then auto-scroll to the "current window" position on mode change. The arrows and keyboard shortcuts become smooth-scroll shortcuts instead of date-range swaps.

### How It Works

1. **All view modes set `dateRange` to full project** (`validStartDate` → `validEndDate`). The `viewMode` still controls column granularity (individual days vs week groups).

2. **On mode change**, a `useEffect` scrolls the right pane to the correct initial position:
   - Weekly: scroll so current week's Monday column is at the left edge
   - Monthly: scroll so today's column is at the left edge
   - Project: scroll to 0 (everything visible)

3. **`navigatePeriod` becomes smooth-scroll**: Instead of changing `dateRange`, it calculates a pixel offset (1 week or ~1 month of columns) and calls `rightBodyRef.current.scrollBy({ left: offset, behavior: 'smooth' })`.

4. **Remove slide animation**: The `slideDirection` state and CSS classes (`animate-slide-left/right`) are no longer needed since native scroll provides the visual transition.

5. **Header date display**: The date range shown in the header picker updates dynamically based on `scrollLeft` position, so the user sees which dates are currently visible.

## Technical Changes

### File: `src/components/timeline/GanttChart.tsx`

**`handleViewModeChange`** — Set `dateRange` to full project for all modes. Store the `viewMode` so the scroll effect knows where to jump.

**New `useEffect` for initial scroll position** — After `groupedColumns` and `columnWidth` are computed, calculate the target scroll offset using `dateToX()`:
- Weekly: `dateToX(startOfWeek(today, { weekStartsOn: 1 }))`
- Monthly: `dateToX(today)`  
- Project: `0`

Call `rightBodyRef.current.scrollLeft = targetX` (instant, no smooth for initial).

**`navigatePeriod`** — Replace `setDateRange(...)` with:
- Weekly: `rightBodyRef.current.scrollBy({ left: direction === 'next' ? weekPixels : -weekPixels, behavior: 'smooth' })`  
  where `weekPixels = 5 * columnWidth` (5 working day columns)
- Monthly: `rightBodyRef.current.scrollBy({ left: direction === 'next' ? monthPixels : -monthPixels, behavior: 'smooth' })`  
  where `monthPixels ≈ 22 * columnWidth` (working days in a month)
- Project: no-op

**Remove `slideDirection`** — Delete state, `setTimeout`, and the `animate-slide-left/right` class bindings on the right body div.

**Keyboard arrows** — Already call `navigatePeriod`, so they'll automatically smooth-scroll.

**Header date range display** — Add an `onScroll` handler (extend `handleRightBodyScroll`) that computes the visible date window from `scrollLeft` using `xToDate()`, and updates a `visibleDateRange` state. Pass this to `GanttHeader` for display.

**Initial `dateRange` state** — Change from monthly window to full project: `{ from: validStartDate, to: validEndDate }`.

**`useEffect` for project date sync** — Remove the `viewMode === 'project'` guard so all modes update when project dates change.

### Performance Note

A 6-month Mon-Fri project ≈ 130 day columns. A 12-month project ≈ 260 columns. At 36px minimum width, that is 4,680–9,360px — well within browser rendering limits.

---

## Files Summary

| File | Change |
|------|--------|
| `src/components/timeline/GanttChart.tsx` | Full project dateRange for all modes. navigatePeriod → scrollBy. Auto-scroll on mode change. Remove slideDirection animation. Dynamic visible date display. |

