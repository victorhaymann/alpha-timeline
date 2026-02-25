

# Multi-Lane Rows for Overlapping Phases and Staff Assignments

## The Problem

In both the Projects Gantt and Staff Gantt on the dashboard, when multiple phases (or assignments) overlap in time, they render on top of each other in a single fixed-height row. The head of planning cannot see concurrent work at a glance.

## The Solution

Compute **lanes** for each row. When bars overlap in time, they are stacked vertically into separate lanes within the same row. The row height grows dynamically to accommodate all lanes.

```text
BEFORE (overlapping bars hidden behind each other):
┌──────────────────────────────────────────────┐
│ Project A   ▓▓▓▓▓▓▓▓▓▓▓▓▓▓ (only 1 visible) │  44px
└──────────────────────────────────────────────┘

AFTER (stacked lanes):
┌──────────────────────────────────────────────┐
│ Project A   ▓▓▓▓ Pre-Prod ▓▓▓▓▓▓            │  lane 0
│             ▓▓▓▓▓▓▓ Production ▓▓▓           │  lane 1
└──────────────────────────────────────────────┘
```

### Lane Algorithm

A standard interval packing / greedy lane assignment:

1. Sort bars by start date
2. For each bar, find the first lane where no existing bar overlaps
3. Assign it to that lane (or create a new lane)

Row height = `BASE_ROW_H + (laneCount - 1) * LANE_H` where `LANE_H` is the height of one additional lane (~24px). Single-lane rows stay at the current height.

## Technical Changes

### File: `src/components/dashboard/ProjectsGantt.tsx`

1. **Add lane computation function** `computeLanes(bars)` that returns each bar with a `lane` index and the total `laneCount`.

2. **Per-project lane data**: In the rendering, compute lanes for each project's phases. Use `laneCount` to determine the row height dynamically.

3. **Bar positioning**: Each bar's `top` offset becomes `padding + lane * LANE_H` instead of a fixed `top-2`.

4. **Left pane sync**: The left column row heights must match the right pane. Compute a `rowHeights` map (project id -> height) and apply it to both sides.

5. **`maxHeight` calculation**: Sum all dynamic row heights instead of `filtered.length * ROW_H`.

### File: `src/components/dashboard/StaffGantt.tsx`

Same approach:

1. **Add the same `computeLanes` function** for staff assignment bars.

2. **Per-staff lane data**: Compute lanes for each staff member's assignments. Row height grows with lane count.

3. **Bar positioning**: Offset bars vertically by lane index.

4. **Left pane sync**: Apply matching dynamic heights to the left column staff rows.

5. **`maxHeight` calculation**: Sum all dynamic row heights including category headers.

### Shared Constants

- `LANE_H = 24` -- height per additional lane
- `BAR_H = 20` -- individual bar height
- `BAR_PAD = 6` -- top padding in each row
- Base row height stays at current value for single-lane rows

### No other files change

The Dashboard page (`Dashboard.tsx`) passes data unchanged. The lane computation is purely a rendering concern inside each Gantt component.

| File | Change |
|------|--------|
| `src/components/dashboard/ProjectsGantt.tsx` | Add lane computation, dynamic row heights, stacked bar positioning |
| `src/components/dashboard/StaffGantt.tsx` | Add lane computation, dynamic row heights, stacked bar positioning |

