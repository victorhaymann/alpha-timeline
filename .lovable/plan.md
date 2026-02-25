

# Gantt Chart Simplification: One Row Per Task (Remove Phase Headers)

## The Problem

Currently each phase renders as **two visual rows**:
1. A **phase header row** (36px) -- collapsible chevron, colored dot, phase name, task count badge, staff assignment icon, add button
2. One or more **task rows** (40px each) -- grip handle, task name, duration badge, date pickers, and the actual bar on the timeline

When a phase has a single task (which is the common case -- e.g. "Pre-Production" phase contains a "Pre-Production" task), this produces a redundant double line where the same name appears twice. It looks heavy and complicated for no reason.

## The Proposal: Flat Task List with Phase Color Indicators

Remove the dedicated phase header row entirely. Each task becomes a single self-contained row that carries its phase identity via a **colored left border or dot**.

```text
BEFORE (current):
┌─────────────────────────────────────────────────────────┐
│ ▼ ● Pre-Production    1  👥  +                          │  ← phase header (36px)
│     Pre-Production   4d  Feb 24 → Feb 27  ▓▓▓▓▓▓▓▓▓   │  ← task row (40px)
│ ▼ ● Production        2  👥  +                          │  ← phase header
│     Modeling         6d  Mar 3 → Mar 10   ▓▓▓▓▓▓▓▓▓   │  ← task row
│     Texturing        4d  Mar 11 → Mar 14  ▓▓▓▓▓▓▓      │  ← task row
└─────────────────────────────────────────────────────────┘

AFTER (proposed):
┌─────────────────────────────────────────────────────────┐
│ ● Pre-Production   4d  Feb 24 → Feb 27   ▓▓▓▓▓▓▓▓▓   │  ← single row
│ ● Modeling         6d  Mar 3 → Mar 10    ▓▓▓▓▓▓▓▓▓   │  ← single row
│ ● Texturing        4d  Mar 11 → Mar 14   ▓▓▓▓▓▓▓      │  ← single row
│ ● Milestone        —   Mar 14            🚩            │  ← single row
└─────────────────────────────────────────────────────────┘
```

### What Happens to Phase-Level Features

| Feature | Current Location | New Location |
|---------|-----------------|--------------|
| Phase color dot | Phase header | Left of each task name (inherits phase color) |
| Task count badge | Phase header | Removed (visible by counting rows) |
| Staff assignment (👥) | Phase header | Moved to a subtle icon on task row hover, or accessible via right-click/popover |
| Add task (+) | Phase header | Moved to a "+" button that appears at the bottom of each phase group on hover, or in the task popover menu |
| Collapse/expand | Phase header chevron | Removed -- all tasks always visible (the chart is cleaner without nesting) |
| Grip/reorder | Task row | Stays on task row |
| Delete task | Task row | Stays on task row |

### Phase Grouping (Subtle Visual Separator)

To maintain phase awareness without a full header row, add a **thin horizontal divider line** with a small phase label between phase groups:

```text
┌─────────────────────────────────────────────────────────┐
│  PRE-PRODUCTION                                         │  ← subtle label (16px)
│ ● Pre-Production   4d  Feb 24 → Feb 27   ▓▓▓▓▓▓▓▓▓   │
│ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─   │
│  PRODUCTION                                             │  ← subtle label (16px)
│ ● Modeling         6d  Mar 3 → Mar 10    ▓▓▓▓▓▓▓▓▓   │
│ ● Texturing        4d  Mar 11 → Mar 14   ▓▓▓▓▓▓▓      │
└─────────────────────────────────────────────────────────┘
```

This label row is ~16-20px (half the old header), non-interactive, and purely decorative. It also carries the staff assignment icon and add-task button on hover.

---

## Technical Changes

### File: `src/components/timeline/GanttChart.tsx`

**Left pane changes:**
- Replace the current two-level rendering (phase header → task rows) with a flat list
- Add a **phase separator row** (~20px) between phase groups: shows uppercase phase name in muted text, colored left accent, and on-hover actions (staff assignment, add task)
- Each task row keeps: colored dot (phase color), task name (editable), duration badge, inline date pickers, grip handle, delete button
- Remove `collapsedSections` state and `toggleSectionCollapse` -- no more collapsing
- Remove `PHASE_HEADER_HEIGHT` usage from height calculations

**Right pane (timeline) changes:**
- The phase separator row on the right side is just an empty thin row with the grid lines continuing through it
- Task bar rows remain unchanged in rendering logic
- Total height calculation simplifies: `HEADER_HEIGHT + (separatorCount * 20) + (taskCount * ROW_HEIGHT) + weeklyCallHeight`

**Height calculation update:**
- Old: `HEADER_HEIGHT + sections * (PHASE_HEADER_HEIGHT + tasks.length * ROW_HEIGHT)`
- New: `HEADER_HEIGHT + phases.length * PHASE_SEPARATOR_HEIGHT + totalTasks * ROW_HEIGHT`

### File: `src/components/timeline/ganttTypes.ts`

- Add `PHASE_SEPARATOR_HEIGHT = 20` constant
- Keep `PHASE_HEADER_HEIGHT` for backward compat but it won't be used in GanttChart

### No other file changes needed

The data flow, props, segments, drag/resize, popover menu, review notes -- all stay the same. This is purely a rendering restructure within GanttChart.tsx.

---

## Files Summary

| File | Change |
|------|--------|
| `src/components/timeline/GanttChart.tsx` | Flatten phase header + task rows into single rows with phase separator labels. Remove collapse logic. |
| `src/components/timeline/ganttTypes.ts` | Add `PHASE_SEPARATOR_HEIGHT` constant |

