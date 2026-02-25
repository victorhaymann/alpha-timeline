

# Remove Weekly View, Add Dates to Day Labels, Fix Scroll

## What Changes

1. **Remove the Weekly view mode** — the segmented toggle becomes just "Monthly" and "Project"
2. **Add date numbers to day labels** in Monthly view — e.g. "Wed 26" instead of just "Wed"
3. **Fix horizontal scroll** — the right pane already has `overflow-auto` but the arrows only `scrollBy`. The user reports they can't scroll right, likely because the arrow navigation for removed "week" mode won't be needed, but the month navigation and native scroll/trackpad must work.

## Changes

### 1. `src/components/timeline/ganttTypes.ts`
- Remove `'week'` from the `ViewMode` type: `export type ViewMode = 'month' | 'project';`

### 2. `src/components/timeline/GanttChart.tsx`

**View mode toggle (line 627)**: Change the array from `['week', 'month', 'project']` to `['month', 'project']`. Remove the mobile single-char mapping for `'week'`.

**Default view mode (line 142)**: Already `'month'` — no change needed.

**navigatePeriod (lines 373-391)**: Remove the `week` branch. Keep `month` branch (scroll by ~22 columns). Keep `project` no-op.

**handleViewModeChange (line 365-371)**: No changes needed — works generically.

**Day row label (line 1081)**: Currently shows `col.subLabel || format(col.days[0], 'EEE').charAt(0)`. Change to show day name + date number for month view: `format(col.days[0], 'EEE').charAt(0) + ' ' + format(col.days[0], 'd')` when in month view (but `subLabel` already has full day name from `useGanttCalculations` — for month view columns are individual days with `subLabel = format(day, 'EEE')`). Update to show `format(d, 'EEE') + ' ' + format(d, 'd')` — e.g. "Wed 26".

Actually looking at the screenshot more carefully, the current label shows just "Wed", "Thu" etc. The user wants "Wed 26", "Thu 27" etc. The `subLabel` from `useGanttCalculations` is `format(day, 'EEE')` (3-letter day). I'll change the day row rendering to show both day name and date.

**Legend tooltip (lines 739-741)**: Remove the "Weekly view: 7 days per period" line.

### 3. `src/components/timeline/GanttHeader.tsx`
- Remove `'week'` from the view mode array (line 74)
- Remove the mobile 'W' mapping
- Update legend text if present

### 4. `src/components/timeline/useGanttCalculations.ts`
- No changes needed — the hook handles `week` mode gracefully, it just won't be called with it anymore.

### 5. Scroll fix
The right body pane at line 1089-1095 has `overflow-auto`. The user says they can't scroll right. Looking at the code, `chartWidth = groupedColumns.length * columnWidth`. The `containerWidth` is calculated as `containerRef.current.clientWidth - taskColumnWidth`. The `columnWidth` uses `Math.max(calculatedWidth, minWidths[viewMode])` — for month mode, minimum is 60px desktop. If the project has many working days, `chartWidth` should exceed the viewport, enabling scroll.

The issue might be that the outer container at line 750 has `overflow-x-auto` on the whole wrapper, which could conflict. The inner `div` at line 1089 (`rightBodyRef`) also has `overflow-auto`. This should work for native scroll. Let me verify the container structure doesn't clip.

Line 750: `<div className="rounded-lg border border-border bg-card overflow-hidden overflow-x-auto">` — the `overflow-hidden` here might clip the scroll. This is the outer container. The right body inside has its own scroll. The `overflow-hidden` on the outer might be fine since the inner right body handles its own scroll. But `overflow-x-auto` on the outer could create competing scrollbars. Let me keep the outer as `overflow-hidden` only (remove `overflow-x-auto`) to avoid confusion — the right body pane handles horizontal scroll internally.

Actually, on review: the current structure is that the outer container clips, and the rightBody div scrolls independently. The header scroll is synced via `rightHeaderRef.current.scrollLeft = rightBodyRef.current.scrollLeft`. This should work. The user might just need the native trackpad/mouse wheel horizontal scroll to work on the rightBody div, which `overflow-auto` should enable.

The real fix: ensure the `chartWidth` inner div is wider than the viewport. This depends on column count × columnWidth. For month view with min 60px columns, a 2-week project = ~10 columns × 60px = 600px, which fits in most screens without needing scroll. But a longer project should scroll fine. The arrows should also work — they `scrollBy` on `rightBodyRef`. Let me make sure the navigatePeriod for month mode uses a reasonable offset.

## Summary

| Change | File |
|--------|------|
| Remove `'week'` from ViewMode | ganttTypes.ts |
| Remove week from toggle + legend | GanttChart.tsx, GanttHeader.tsx |
| Day labels show "Wed 26" format | GanttChart.tsx |
| Clean up navigatePeriod | GanttChart.tsx |

