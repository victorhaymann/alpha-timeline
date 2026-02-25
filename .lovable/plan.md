

# Separate Review Sub-Rows from Task Bars

## The Problem

Currently, each task displays work and review segments **on the same row** as alternating bars connected by dashed lines. This makes the Gantt chart visually complex. The user wants:

1. **Main task row**: One solid, continuous bar for the full phase duration (work only)
2. **Review sub-row**: A second row below each task that has review segments, showing only the review periods

This also simplifies the popover menu by removing "Add Period Before/After", "Convert to Review", and "Edit Periods" options — reviews are set at project creation time via the feedback rounds config.

## Current Architecture

- `task_segments` table stores alternating `work` / `review` segments per task
- `GanttChart.tsx` renders all segments on **one row** with connecting dashed lines
- `TaskPopoverMenu.tsx` has options: Add Period Before/After, Edit Periods, Convert to Review/Work, Delete Period
- `TimelineEditor.tsx` has handlers: `handleAddSegment`, `handleConvertSegmentType`, `handleDeleteSegment`, `handleEditSegments` (opens `TaskSegmentDialog`)
- `NewProject.tsx` already creates work/review segments correctly during project creation

## Proposed Changes

### 1. `src/components/timeline/ganttTypes.ts`
- Add a new constant `REVIEW_SUB_ROW_HEIGHT = 28` (slightly shorter than `ROW_HEIGHT`)

### 2. `src/components/timeline/GanttChart.tsx` — Major changes

**Height calculation** (lines 581-601):
- For each phase task that has review segments, add `REVIEW_SUB_ROW_HEIGHT` to the total height

**Left pane — task rows** (lines 876-1011):
- After each task row that has review segments, render a sub-row (height `REVIEW_SUB_ROW_HEIGHT`) with:
  - Indented label like "↳ Reviews" or just blank with a review icon
  - No grip handle, no inline date pickers (review dates are derived)

**Right pane — task bars** (lines 1184-1568):
- **Main task row**: Render a single continuous filled bar from the task's overall `start_date` to `end_date` (ignoring segment boundaries). Only work segments' color, no dashed borders. Remove all the multi-segment rendering logic (connecting SVG lines, per-segment bars).
- **Review sub-row**: For tasks with review segments, render a new row below showing only review-type segments as dashed-border bars (same styling as current review segments). These are view-only — draggable but not convertible.

**Remove from the multi-segment rendering**:
- The SVG connecting dashed lines between segments
- The per-segment drag/resize for work segments (main bar uses task-level drag instead)
- Review segments keep segment-level drag/resize on the sub-row

### 3. `src/components/timeline/TaskPopoverMenu.tsx` — Simplify

Remove these options:
- "Add Period Before" / "Add Period After" (`onAddSegment`)
- "Edit Periods..." (`onEditSegments`)
- "Convert to Review/Work" (`onConvertSegmentType`)
- "Delete Period" (`onDeleteSegment`)

Keep:
- "Delete Task" (`onDeleteTask`)
- "Edit Review Notes" (`onEditReviewNotes`) — accessible from review sub-row

The component becomes much simpler: just Delete Task + Edit Review Notes.

### 4. `src/components/timeline/TimelineEditor.tsx` — Remove unused handlers

Remove or stop passing:
- `handleAddSegment` 
- `handleConvertSegmentType`
- `handleDeleteSegment`
- `handleEditSegments` / `segmentDialogOpen` / `selectedTaskForSegments`
- Remove `TaskSegmentDialog` import and rendering

Keep:
- `handleUpdateSegment` (still needed for dragging review segments on sub-row)
- Undo system (unchanged)

### 5. `src/components/timeline/GanttChart.tsx` — Props cleanup

Remove from `GanttChartProps`:
- `onAddSegment`
- `onEditSegments`
- `onConvertSegmentType`
- `onDeleteSegment`

Keep:
- `onUpdateSegment` (for review segment drag/resize)
- `segments` (still needed to identify review periods)

### 6. No database changes needed

The `task_segments` table and trigger are unchanged. Segments are still created at project creation time via `NewProject.tsx`. The only difference is how they're **rendered** — work segments are visually merged into one continuous bar, review segments get their own sub-row.

### 7. Files that can be deleted

- `src/components/timeline/TaskSegmentDialog.tsx` — no longer needed (segment editing via dialog removed)

## Summary of file changes

| File | Change |
|------|--------|
| `src/components/timeline/ganttTypes.ts` | Add `REVIEW_SUB_ROW_HEIGHT = 28` |
| `src/components/timeline/GanttChart.tsx` | Render continuous work bar + review sub-row. Remove multi-segment rendering, SVG connectors, segment-level popover options. Remove `onAddSegment`, `onEditSegments`, `onConvertSegmentType`, `onDeleteSegment` props. |
| `src/components/timeline/TaskPopoverMenu.tsx` | Simplify to Delete Task + Edit Review Notes only |
| `src/components/timeline/TimelineEditor.tsx` | Remove `handleAddSegment`, `handleConvertSegmentType`, `handleDeleteSegment`, segment dialog state. Stop passing removed props to GanttChart. |
| `src/components/timeline/TaskSegmentDialog.tsx` | Delete file |

