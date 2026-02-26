

# Plan: Fix Review Table Sorting, Clean Up Header, and Align Day Axis

## Issues Identified

1. **Review table not sorted chronologically** — `reviewSegments` are iterated in whatever order they come from the `segments` array. Need to sort by `start_date` ascending.

2. **"· 50 days" badge under title** — The `.sub` div shows the date range, a dot separator, and a "50 days" badge. Remove the dot and badge, keep only the date range.

3. **Delivery Date card still showing** — Lines 338-341 render a Delivery Date info-card. Remove it. Keep only the PM card and make it larger (bigger padding, larger font).

4. **Day axis misalignment with timeline bars** — The `pct()` function and day tick positioning both use `differenceInDays` which counts calendar day boundaries. The day ticks use `left` positioning at the start of each day, but bars also start at the left edge of a day. The issue is that the day-tick `width` is `100 / totalDays` but the track area for bars starts at `left: 200px` (the task-info column), while the day-bar spans the full width. The day-bar, month-bar, and week-bar all span the full container width, but the task bars are inside a child div that starts after the 200px task-info column. The axis headers need to be offset by the same 200px left margin to align with the bars.

## Changes to `src/components/exports/exportTimelinePDF.ts`

### 1. Sort review table chronologically
Change line 166-167 from:
```js
const reviewSegments = segments.filter(s => s.segment_type === 'review');
```
to:
```js
const reviewSegments = segments
  .filter(s => s.segment_type === 'review')
  .sort((a, b) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime());
```

### 2. Remove "· 50 days" from subtitle
Lines 326-330: Remove the dot span and badge span from the `.sub` div, keeping only the date range text.

### 3. Remove Delivery Date card, enlarge PM card
- Remove lines 338-341 (the Delivery Date info-card)
- Update the PM info-card CSS: increase padding to `12px 24px`, bump `.value` font to `14px`, and increase `min-width` to `160px`

### 4. Fix day/week/month axis alignment with task bars
The root cause: the header rows (month-bar, week-bar, day-bar) span the full container width, but the task track area only occupies `flex: 1` after a 200px task-info column. The percentage positions calculated by `pct()` are correct for the track area, but the header bars don't account for the 200px offset.

Fix: Add `margin-left: 200px` to `.month-bar`, `.week-bar`, and `.day-bar` so they align with the task track area. This way, the percentage positions in both the axis labels and the bars refer to the same coordinate space.

