

# Fix: Resize and Move for Segmented Tasks

## Root Cause

The `handleTaskOrSegmentsDrag` wrapper (lines 312-335 of GanttChart.tsx) was written **only for the move case** but is called for **all three drag types** (move, resize-start, resize-end). This causes two distinct failures:

### Bug 1: Resize-end silently does nothing
When you resize the right edge of a segmented task bar:
- `handleDragEnd` in the hook calls `onTaskUpdate(taskId, { start_date, end_date })` with the **same** start_date but a **new** end_date
- `handleTaskOrSegmentsDrag` computes `daysDelta = differenceInDays(newStart, oldStart)` — which is **0** because start didn't change
- It hits `if (daysDelta === 0) return;` and **exits without doing anything**
- The bar visually extended during drag, but no DB update happens → snap-back on refresh

### Bug 2: Resize-start shifts everything instead of extending
When you resize the left edge:
- `daysDelta` is non-zero (e.g. -2 if you extended left by 2 days)
- The code shifts **all segments** by that delta — moving everything left/right
- But a resize-start should only change the **first segment's start_date**, not move everything

### Why tasks without reviews work fine
Tasks without segments bypass the wrapper entirely (the `if (taskSegs.length > 0)` check fails) and call `onTaskUpdate` directly, which writes to the `tasks` table. Since there's no trigger override for segment-less tasks, the dates stick.

## Fix Strategy

Replace the move-only logic with a handler that detects the drag type from the date changes:

1. **Move** (both start and end shifted by the same delta): shift all segments uniformly — current logic, works correctly
2. **Resize-end** (start unchanged, end changed): adjust only the **last segment's** `end_date` by the delta
3. **Resize-start** (start changed, end unchanged): adjust only the **first segment's** `start_date` by the delta

The DB trigger will then recalculate parent task dates from the updated segments.

## Changes

### `src/components/timeline/GanttChart.tsx` — lines 309-335

Replace `handleTaskOrSegmentsDrag` with logic that differentiates between move and resize:

```typescript
const handleTaskOrSegmentsDrag = useCallback((taskId: string, updates: Partial<Task>) => {
  const taskSegs = segments.filter(s => s.task_id === taskId);
  if (taskSegs.length > 0 && onUpdateSegment && updates.start_date && updates.end_date) {
    // Derive current effective boundaries from segments (source of truth)
    const segStarts = taskSegs.map(s => new Date(s.start_date).getTime());
    const segEnds = taskSegs.map(s => new Date(s.end_date).getTime());
    const oldStart = new Date(Math.min(...segStarts));
    const oldEnd = new Date(Math.max(...segEnds));
    const newStart = new Date(updates.start_date as string);
    const newEnd = new Date(updates.end_date as string);

    const startDelta = differenceInDays(newStart, oldStart);
    const endDelta = differenceInDays(newEnd, oldEnd);

    if (startDelta === 0 && endDelta === 0) return; // no change

    // Sort segments by order_index for first/last identification
    const sorted = [...taskSegs].sort((a, b) => a.order_index - b.order_index);

    if (startDelta === endDelta) {
      // MOVE: uniform shift — shift every segment
      for (const seg of taskSegs) {
        onUpdateSegment(seg.id, {
          start_date: format(addDays(new Date(seg.start_date), startDelta), 'yyyy-MM-dd'),
          end_date: format(addDays(new Date(seg.end_date), startDelta), 'yyyy-MM-dd'),
        });
      }
    } else if (startDelta === 0 && endDelta !== 0) {
      // RESIZE-END: only adjust last segment's end_date
      const lastSeg = sorted[sorted.length - 1];
      onUpdateSegment(lastSeg.id, {
        end_date: format(addDays(new Date(lastSeg.end_date), endDelta), 'yyyy-MM-dd'),
      });
    } else if (endDelta === 0 && startDelta !== 0) {
      // RESIZE-START: only adjust first segment's start_date
      const firstSeg = sorted[0];
      onUpdateSegment(firstSeg.id, {
        start_date: format(addDays(new Date(firstSeg.start_date), startDelta), 'yyyy-MM-dd'),
      });
    } else {
      // Mixed change (shouldn't happen normally) — shift all segments by start delta,
      // then adjust last segment end to match
      for (const seg of taskSegs) {
        onUpdateSegment(seg.id, {
          start_date: format(addDays(new Date(seg.start_date), startDelta), 'yyyy-MM-dd'),
          end_date: format(addDays(new Date(seg.end_date), startDelta), 'yyyy-MM-dd'),
        });
      }
      const lastSeg = sorted[sorted.length - 1];
      const extraEndDelta = endDelta - startDelta;
      onUpdateSegment(lastSeg.id, {
        end_date: format(addDays(new Date(lastSeg.end_date), startDelta + extraEndDelta), 'yyyy-MM-dd'),
      });
    }
  } else {
    onTaskUpdate(taskId, updates);
  }
}, [segments, onUpdateSegment, onTaskUpdate]);
```

No other files need changes. The hook, segment update handler, and DB trigger all work correctly — the bug is entirely in how this wrapper interprets the drag type.

## Summary

| File | Change |
|------|--------|
| `src/components/timeline/GanttChart.tsx` (lines 309-335) | Replace move-only wrapper with logic that detects move vs resize-start vs resize-end from date deltas. Move shifts all segments; resize-end adjusts last segment's end; resize-start adjusts first segment's start. |

