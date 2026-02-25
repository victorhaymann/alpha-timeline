
# Gantt Timeline Interaction System — REWRITE COMPLETE

## What was done

### 1. `src/hooks/useDragAndResize.ts` — Full rewrite
- **Single callback**: `onDragComplete(result: DragResult)` replaces `onTaskUpdate` + `onSegmentUpdate`
- **DragResult type**: Contains `type` (task-move/segment-resize-end/etc), `taskId`, optional `segmentId`, `newStart`, `newEnd`
- **Ref-based pending drag**: `pendingDragRef` replaces `useState` + re-subscribing `useEffect` — fixes event listener stacking
- **Auto-edge-detection kept**: The 12px threshold on `.gantt-task-bar-base` is the real resize mechanism (CSS `pointer-events: none` on handle divs means they never fire)
- **All working-day logic preserved**: `snapToWorkingDay`, `addWorkingDays`, `shiftDateByColumns`, `countDurationDays`, `clampToProject`

### 2. `src/components/timeline/GanttChart.tsx` — Wiring simplified
- **Removed**: `handleSegmentUpdate` (vestigial passthrough wrapper)
- **Removed**: `handleTaskOrSegmentsDrag` (batch routing logic moved to TimelineEditor)
- **Removed**: `onBatchUpdateSegments` prop
- **Added**: `onDragComplete` prop passed directly to hook
- **Kept**: `onUpdateSegment` for inline date pickers (not drag operations)
- **Kept**: `onTaskUpdate` for inline name edits and date pickers

### 3. `src/components/timeline/TimelineEditor.tsx` — Unified entry point
- **Added**: `handleDragComplete(result: DragResult)` that routes based on result type:
  - `segmentId` present → `handleUpdateSegment` (single segment)
  - No segments on task → `handleTaskUpdate` (simple task)
  - Segmented task → computes deltas, builds batch array → `handleBatchUpdateSegments`
- **Kept**: `handleBatchUpdateSegments` (called by handleDragComplete for segmented tasks)
- **Kept**: `handleUpdateSegment` (used by inline date pickers and individual segment drags)

### 4. Read-only views updated
- `ClientProjectView.tsx` and `SharedProjectView.tsx` pass `onDragComplete={() => {}}` (no-op for read-only)

## Architecture after rewrite

```
User drags/resizes a bar
  → useDragAndResize (UX: preview, animation, snap)
    → onDragComplete(DragResult)
      → TimelineEditor.handleDragComplete
        ├── segment drag? → handleUpdateSegment (single DB write)
        ├── simple task? → handleTaskUpdate (single DB write)
        └── segmented task? → handleBatchUpdateSegments (batch DB writes)
```

Inline date pickers bypass the drag system entirely (correct — they're not drag operations).
