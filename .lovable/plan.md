

# Fix: Drag-and-Drop Snap-Back for Tasks with Segments

## Root Cause

There are two drag paths, and one is broken for tasks that have segments:

1. **Main task bar** (continuous work bar) → calls `onTaskUpdate` → updates `tasks.start_date` and `tasks.end_date` directly in the database
2. **Review segment bar** (sub-row) → calls `onSegmentUpdate` → updates the segment in `task_segments` table

The problem: a database trigger (`sync_task_dates_on_segment_change`) automatically recalculates `tasks.start_date/end_date` from segments whenever segments change. So for tasks that have segments, the **segments are the source of truth**, not the task row.

When you drag the main bar of a segmented task, `onTaskUpdate` writes new dates to `tasks`, but the segments remain unchanged. On the next data refresh, the trigger's segment-derived dates overwrite your changes — the bar "snaps back."

Tasks without segments work fine because there's no trigger override.

## Fix Strategy

When dragging/resizing the **main bar** of a task that has segments, we should **shift all segments** by the same delta instead of updating the task row directly. The trigger will then automatically sync the parent task dates.

## Changes

### 1. `src/components/timeline/GanttChart.tsx`

**In the `useDragAndResize` hook initialization (~line 322):**
- Replace the current `onTaskUpdate` callback with a new handler that checks whether the task has segments.
- If the task has segments: compute the day delta from old→new dates, then call `onUpdateSegment` for **every** segment of that task, shifting each by the same delta.
- If the task has no segments: call `onTaskUpdate` as before.

Concretely, create a new wrapper function `handleTaskOrSegmentsDrag` that:
```
(taskId, { start_date, end_date }) => {
  const taskSegments = segments.filter(s => s.task_id === taskId);
  if (taskSegments.length > 0 && onUpdateSegment) {
    // Shift all segments by the same delta
    const task = tasks.find(t => t.id === taskId);
    const oldStart = new Date(effectiveStartDate);  // segment-derived
    const newStart = new Date(start_date);
    const daysDelta = differenceInDays(newStart, oldStart);
    for (const seg of taskSegments) {
      onUpdateSegment(seg.id, {
        start_date: format(addDays(new Date(seg.start_date), daysDelta), 'yyyy-MM-dd'),
        end_date: format(addDays(new Date(seg.end_date), daysDelta), 'yyyy-MM-dd'),
      });
    }
  } else {
    onTaskUpdate(taskId, { start_date, end_date });
  }
}
```

Pass this as `onTaskUpdate` to `useDragAndResize` instead of the raw `onTaskUpdate`.

### 2. `src/components/timeline/TimelineEditor.tsx`

No changes needed — `handleUpdateSegment` already handles individual segment updates correctly, and the DB trigger will sync parent task dates.

### 3. `src/hooks/useDragAndResize.ts`

No changes needed — the hook correctly calls `onTaskUpdate` for task-level drags and `onSegmentUpdate` for segment-level drags. The fix is entirely in how GanttChart wires the `onTaskUpdate` callback.

## Summary

| File | Change |
|------|--------|
| `src/components/timeline/GanttChart.tsx` | Create a wrapper around `onTaskUpdate` that shifts all segments when dragging a segmented task, instead of writing to the task row directly. Pass this wrapper to `useDragAndResize`. |

