

# Rewrite: Gantt Timeline Interaction System

## Current State Analysis

After reading all ~3,500 lines across the interaction files, here's what exists and what's broken:

### Files involved in timeline interactions:
1. **`src/hooks/useDragAndResize.ts`** (519 lines) — Horizontal drag/resize hook
2. **`src/hooks/useVerticalReorder.ts`** (330 lines) — Vertical reorder hook
3. **`src/components/timeline/useTaskPopover.ts`** (90 lines) — Hover menu logic
4. **`src/components/timeline/TaskPopoverMenu.tsx`** (61 lines) — Context menu UI
5. **`src/components/timeline/GanttChart.tsx`** (1805 lines) — Rendering + wiring
6. **`src/components/timeline/TimelineEditor.tsx`** (1180 lines) — Data persistence layer

### Identified Problems

**Problem 1: Dual update paths create confusion.**
- `useDragAndResize` calls `onTaskUpdate` for task-level drags and `onSegmentUpdate` for segment-level drags (line 364-374 of useDragAndResize.ts)
- `GanttChart` wraps `onTaskUpdate` with `handleTaskOrSegmentsDrag` (line 314-381) which re-routes to `onBatchUpdateSegments`
- `GanttChart` also wraps `onSegmentUpdate` with `handleSegmentUpdate` (line 305-309) which just passes through
- So there are effectively 3 update paths: direct task update, batch segment update, single segment update
- The hook doesn't know about segments — it just calls whichever callback it was given. The "intelligence" about segments lives in GanttChart's wrapper, creating a confusing split.

**Problem 2: The inline date pickers bypass the batch system.**
Lines 1038-1064 of GanttChart: the `InlineDatePicker` onChange handlers call `onUpdateSegment` (the single-segment path from TimelineEditor), completely bypassing `handleTaskOrSegmentsDrag`. This means inline date changes for segmented tasks work differently from drag operations.

**Problem 3: Resize handles are duplicated.**
The `useDragAndResize` hook has auto-edge-detection logic (lines 175-188) that converts a `'move'` into `'resize-start'` or `'resize-end'` based on click position. But GanttChart ALSO renders explicit resize handle divs (lines 1472-1478, 1496-1503) with their own `onMouseDown` handlers that call `handleDragStart` with explicit resize types. So there are TWO ways a resize can start — the auto-detect AND the explicit handles — creating redundant code paths.

**Problem 4: The `handleSegmentUpdate` wrapper is vestigial.**
```typescript
const handleSegmentUpdate = useCallback((segmentId: string, updates: Partial<TaskSegment>, taskId: string) => {
  if (onUpdateSegment) {
    onUpdateSegment(segmentId, updates);
  }
}, [onUpdateSegment]);
```
This wrapper does nothing — it just passes through. It's leftover from before the batch system was added.

**Problem 5: The pending-drag threshold creates a race condition.**
In `useDragAndResize`, the `pendingDrag` state (lines 78-87) is used to distinguish clicks from drags. But the `useEffect` that listens for mouse movement (lines 236-283) captures `pendingDrag` in its dependency array, meaning it re-subscribes on every render where `pendingDrag` changes. This can cause event listener stacking.

## Rewrite Strategy

Rather than a full scorched-earth rewrite of 3,500+ lines (which risks regressions in the rendering, header, scroll sync, vertical reorder, etc.), I propose a **targeted rewrite of the interaction layer** — the parts that handle horizontal drag, resize, and data persistence for both tasks and segments. The rendering (GanttChart JSX), vertical reorder, and popover menu are working correctly and should be preserved.

### What gets rewritten:

1. **`src/hooks/useDragAndResize.ts`** — Complete rewrite with cleaner architecture
2. **`GanttChart.tsx` wiring layer** (lines 304-406) — Remove all wrapper functions, simplify hook integration
3. **`TimelineEditor.tsx` update handlers** — Consolidate into a single unified update function

### What stays unchanged:
- `useVerticalReorder.ts` — Works correctly
- `useTaskPopover.ts` — Works correctly
- `TaskPopoverMenu.tsx` — Works correctly
- `useGanttCalculations.ts` — Works correctly
- All rendering JSX in GanttChart (grid, bars, tooltips, etc.)
- CSS animations and styles

## Detailed Changes

### 1. Rewrite `src/hooks/useDragAndResize.ts`

The new hook will be aware of segments from the start, eliminating the need for wrapper functions in GanttChart.

Key design changes:
- **Single callback**: `onDragComplete(result: DragResult)` instead of separate `onTaskUpdate` + `onSegmentUpdate`. The result object contains everything the consumer needs: what was dragged, whether it's a task or segment, the drag type (move/resize-start/resize-end), and the new dates.
- **Remove auto-edge-detection**: Since GanttChart already renders explicit resize handles with explicit types, the auto-detection at the bar level is unnecessary and creates confusion. The `handleDragStart` will only accept the type it's told.
- **Use refs for pending drag**: Replace the `useEffect` + state approach for pending drag with a ref-based approach to avoid re-subscription issues.
- **Keep all working-day logic**: `snapToWorkingDay`, `addWorkingDays`, `shiftDateByColumns`, `countDurationDays`, `clampToProject` — all remain unchanged.

```text
New DragResult type:
{
  type: 'task-move' | 'task-resize-start' | 'task-resize-end' 
      | 'segment-move' | 'segment-resize-start' | 'segment-resize-end';
  taskId: string;
  segmentId?: string;
  newStart: string;  // yyyy-MM-dd
  newEnd: string;    // yyyy-MM-dd
}
```

### 2. Simplify GanttChart wiring (lines 304-406)

**Remove entirely:**
- `handleSegmentUpdate` wrapper (lines 305-309) — vestigial passthrough
- `handleTaskOrSegmentsDrag` wrapper (lines 314-381) — batch logic moves to TimelineEditor

**Replace with a single `handleDragComplete` callback** passed to the new hook:
```typescript
const handleDragComplete = useCallback((result: DragResult) => {
  onDragComplete(result);  // Passed down from TimelineEditor
}, [onDragComplete]);
```

**Props change:**
- Remove: `onTaskUpdate`, `onUpdateSegment`, `onBatchUpdateSegments`
- Add: `onDragComplete` (single callback for all drag/resize operations)
- Keep: `onTaskUpdate` only for non-drag updates (inline name edit, inline date picker)

### 3. Consolidate TimelineEditor update handlers

**Add a single `handleDragComplete` function** that contains ALL the intelligence about how to persist a drag result:

```typescript
const handleDragComplete = useCallback(async (result: DragResult) => {
  const { type, taskId, segmentId, newStart, newEnd } = result;
  
  if (segmentId) {
    // Individual segment drag/resize — use handleUpdateSegment (single segment)
    handleUpdateSegment(segmentId, { start_date: newStart, end_date: newEnd });
    return;
  }
  
  // Task-level drag/resize
  const taskSegs = segments.filter(s => s.task_id === taskId);
  
  if (taskSegs.length === 0) {
    // Simple task — update task directly
    handleTaskUpdate(taskId, { start_date: newStart, end_date: newEnd });
    return;
  }
  
  // Segmented task — compute deltas and batch update segments
  // (current handleTaskOrSegmentsDrag logic moves here)
  const segStarts = taskSegs.map(s => new Date(s.start_date).getTime());
  const segEnds = taskSegs.map(s => new Date(s.end_date).getTime());
  const oldStart = new Date(Math.min(...segStarts));
  const oldEnd = new Date(Math.max(...segEnds));
  const startDelta = differenceInDays(new Date(newStart), oldStart);
  const endDelta = differenceInDays(new Date(newEnd), oldEnd);
  
  if (startDelta === 0 && endDelta === 0) return;
  
  const sorted = [...taskSegs].sort((a, b) => a.order_index - b.order_index);
  const batchUpdates = [];
  
  if (startDelta === endDelta) {
    // MOVE
    for (const seg of taskSegs) { /* shift all */ }
  } else if (startDelta === 0) {
    // RESIZE-END — last segment only
  } else if (endDelta === 0) {
    // RESIZE-START — first segment only
  }
  
  handleBatchUpdateSegments(batchUpdates);
}, [segments, handleTaskUpdate, handleUpdateSegment, handleBatchUpdateSegments]);
```

### 4. Fix inline date pickers

The `InlineDatePicker` handlers in GanttChart (lines 1036-1073) currently call `onUpdateSegment` for segmented tasks and `onTaskUpdate` for simple tasks. After the rewrite, these continue to work the same way — they're NOT drag operations, so they don't go through `handleDragComplete`. They correctly update a single segment's start or end date. No change needed here.

### 5. Remove redundant resize handle `onMouseDown` handlers

Currently, GanttChart renders both:
- Explicit resize handle divs with `onMouseDown={(e) => handleDragStart(e, task, 'resize-start')}` (lines 1472-1478)
- The main bar with `onMouseDown={(e) => handleDragStart(e, task, 'move')}` which auto-detects resize from edge proximity

After the rewrite, the **explicit handles** remain the only way to start a resize. The auto-detection in the hook is removed. The main bar `onMouseDown` always starts a move. This makes the intent explicit and eliminates the 12px threshold ambiguity.

But wait — the explicit resize handle divs have `pointer-events: none` in CSS (line 412 of index.css). They rely on the auto-detection! Let me re-check...

Actually, looking at the CSS:
```css
.gantt-resize-handle {
  @apply ... pointer-events-none;
}
```

The handles are `pointer-events: none`, meaning they NEVER receive mouse events. All resize detection goes through the auto-detection on the main bar. The explicit `onMouseDown` handlers on the resize handle divs (lines 1472-1478, 1496-1503) are **dead code** — they never fire because the CSS prevents it.

This means:
- The auto-detection in `useDragAndResize` (lines 175-188) IS the real resize mechanism
- The explicit `onMouseDown` on resize handles are dead code but harmless
- Both should be cleaned up: keep auto-detection (it works), remove dead `onMouseDown` from handle divs, and change handles to `pointer-events: auto` with explicit handlers as the primary mechanism

**Decision**: Keep auto-detection for now (it works and users are used to it), but remove the dead `onMouseDown` handlers from the resize handle divs to eliminate confusion.

## File-by-File Summary

| File | Action | Lines Changed |
|------|--------|--------------|
| `src/hooks/useDragAndResize.ts` | **Rewrite** — New `onDragComplete` callback, ref-based pending drag, remove auto-edge-detection ambiguity | ~519 → ~400 |
| `src/components/timeline/GanttChart.tsx` | **Simplify wiring** — Remove `handleSegmentUpdate`, `handleTaskOrSegmentsDrag`, dead resize `onMouseDown` handlers. Add `onDragComplete` prop, pass to hook. Remove `onBatchUpdateSegments` prop | ~80 lines changed |
| `src/components/timeline/TimelineEditor.tsx` | **Add `handleDragComplete`** — Single entry point that routes to task update, single segment update, or batch segment update. Pass to GanttChart | ~50 lines added |

## What This Fixes

1. **No more dual update paths** — All drag/resize operations go through `onDragComplete` → `handleDragComplete` → appropriate persistence method
2. **No more stale closure issues** — Batch updates already fixed this; the rewrite ensures no regression
3. **No more dead code** — Remove vestigial wrappers and unreachable handlers
4. **Clear separation of concerns** — Hook handles UX (dragging, preview, animation). GanttChart handles rendering. TimelineEditor handles persistence.
5. **Inline date pickers remain independent** — They update individual segments/tasks directly, not through the drag system. This is correct behavior.

