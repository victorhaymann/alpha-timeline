

# Plan: Landscape Default, Weekday-Only Day Labels, Alternating Week Bands

## Changes to `src/components/exports/exportTimelinePDF.ts`

### 1. Landscape by default
The `@page { size: landscape; }` is already set. This controls the print dialog default. No change needed here -- it's already landscape.

### 2. Remove weekends from day labels, use single-letter abbreviations
Currently the day labels show `"Mon 3"`, `"Tue 4"`, etc. including Sat/Sun.

Change the day label generation (lines 64-71) to:
- Skip days where `getDay() === 0` (Sunday) or `getDay() === 6` (Saturday)
- Use single-letter format: M, T, W, T, F (using `format(date, 'EEEEE')`)
- Show the day number below or next to it: e.g. `"M 3"`

Since weekends are skipped in labels but the `pct()` positioning still uses calendar days, the labels will simply not appear for weekend columns. The bars still span correctly across weekends since positioning is percentage-based on total calendar days. The day-tick width stays at `100 / totalDays` per calendar day -- weekend slots just remain empty/unlabeled, giving more visual breathing room.

### 3. Alternating week background bands
Generate vertical background stripes for every other week in the timeline track area. Using the existing `weekTicks` array, render `<div>` elements with alternating `background: #f8f8f8` (light grey) and transparent, positioned absolutely behind the task bars. These go inside the grid-lines container, spanning the full height.

Build a `weekBandsHtml` string: for each week tick, calculate its left% and width% (to the next tick or 100%), and for odd-indexed weeks apply a light grey background.

### 4. CSS additions
- Add `.week-band` class: `position: absolute; top: 0; bottom: 0; z-index: 0;`
- The week bands render behind grid lines and task bars

### Summary of edits in `exportTimelinePDF.ts`:
- **Lines 64-71**: Filter out weekends, change label format to single letter + number
- **Lines 189-192**: Add week band generation alongside grid lines
- **Lines 305-306**: Add `.week-band` CSS
- **Lines 357-360**: Insert week bands HTML into the grid-lines container

