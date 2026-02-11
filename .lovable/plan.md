

# Fix: Shift Timeline - Undo Failure and Delivery Tasks Not Shifted

## Issue 1: Undo Fails After Shift

**Root cause:** The undo logic (line 148-155 of `TimelineEditor.tsx`) re-inserts segments but omits the `segment_type` field. While the column defaults to `'work'`, any `review` segments lose their type on undo, causing data inconsistency. More critically, the undo deletes ALL segments for each task and re-inserts them, but this triggers the `sync_task_dates_on_segment_change` database trigger repeatedly during the batch operation, which can cause timeouts or race conditions -- especially for a large shift operation affecting many tasks and segments simultaneously.

**Fix:** Include `segment_type` in the segment re-insert during undo. The fix is a single line addition in the `handleUndo` function.

```text
Current insert (line 149-155):
  { id, task_id, start_date, end_date, order_index }

Fixed insert:
  { id, task_id, start_date, end_date, order_index, segment_type }
```

## Issue 2: Delivery Tasks Not Shifted

**Root cause:** When using "From date onward" scope, the filter is:
```
affectedTasks = tasks.filter(t => t.start_date >= fromStr)
```
If the selected "from date" is after the Delivery tasks' start dates (e.g., Feb 20), those tasks are excluded from the shift. This is technically correct behavior -- the filter only shifts tasks that START on or after the chosen date.

However, this is confusing UX because you'd expect tasks in later phases (like Delivery) to always move when shifting "from date onward." The fix is to also include tasks whose **end date** falls on or after the from-date, ensuring Delivery tasks at the end of the timeline are always captured.

**Fix:** Change the filter in both `ShiftTimelineDialog.tsx` (preview) and `TimelineEditor.tsx` (actual shift) from:
```
t.start_date >= fromStr
```
to:
```
t.start_date >= fromStr || t.end_date >= fromStr
```

This ensures that any task overlapping or following the chosen date is included.

## Files to Change

### 1. `src/components/timeline/TimelineEditor.tsx`
- **handleUndo** (line ~149): Add `segment_type: seg.segment_type` to the segment re-insert object
- **handleShiftTimeline** (line ~1036): Change filter from `start_date >= fromStr` to `start_date >= fromStr || end_date >= fromStr`

### 2. `src/components/timeline/ShiftTimelineDialog.tsx`
- **Preview calculation** (line ~67): Same filter change -- use `start_date >= fromStr || end_date >= fromStr` so the preview count matches actual behavior

## Summary
Two small, surgical fixes:
1. One field added to undo's segment re-insert (prevents review segments from losing their type)
2. One filter condition widened (ensures Delivery and late-phase tasks are always included when shifting "from date onward")
