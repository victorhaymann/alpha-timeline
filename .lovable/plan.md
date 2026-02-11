

# Fix: Shift Timeline Shows Correct Dates Then Scrambles

## Root Cause

There's a **race condition** between two competing database operations happening in `Promise.all`:

1. **Direct task updates** (lines 1088-1095): explicitly sets `tasks.start_date` and `tasks.end_date`
2. **Segment updates** (lines 1098-1105): updates `task_segments` dates, which **triggers the `sync_task_dates_on_segment_change` database trigger** that ALSO updates `tasks.start_date` and `tasks.end_date`

Since all these fire concurrently in `Promise.all`, the trigger from segment update #1 might run before segment update #2 completes, causing it to calculate task dates from a mix of **old and new segment dates** -- producing "random" intermediate values.

Then `onRefresh()` (line 1119) immediately fetches from the database, which may return these intermediate/wrong trigger-computed dates, overwriting the correct local state that was briefly visible.

### The sequence:
```
1. Local state updated (correct dates shown briefly)
2. Promise.all fires:
   - Segment A update -> trigger: task.dates = f(newA, oldB) = WRONG
   - Segment B update -> trigger: task.dates = f(newA, newB) = correct
   - Direct task update -> task.dates = correct
   (These race against each other)
3. onRefresh() fetches from DB -> may get intermediate wrong values
4. UI shows wrong dates
```

## Fix (2 changes in TimelineEditor.tsx)

### 1. Don't directly update task dates for tasks that have segments

For tasks with segments, the database trigger is the single source of truth. Directly updating task dates creates a race. Only update task dates for tasks **without** segments.

```
Change lines 1087-1095:
- Update ALL affected tasks
+ Only update tasks that have NO segments (segmentless tasks)
```

### 2. Update segments sequentially, THEN refresh

Instead of firing all segment updates concurrently in `Promise.all` (which causes trigger races), update segments first, then segmentless tasks, then refresh. Also remove the immediate `onRefresh()` since the local state is already correct -- or at minimum, add a small delay so triggers finish before refetch.

```
Change lines 1087-1119:
1. First: await all segment updates (triggers will sync task dates)
2. Then: await all segmentless task updates
3. Update local state
4. Remove onRefresh() -- local state is already correct
```

### 3. Remove duplicate filter logic

The filtering logic for "from date onward" is duplicated between `ShiftTimelineDialog.tsx` (preview, lines 66-70) and `TimelineEditor.tsx` (actual shift, lines 1033-1038). This is a maintenance risk -- if one changes the other might not. We'll extract this into a shared utility or at minimum keep them consistent.

## Summary

| Problem | Cause | Fix |
|---------|-------|-----|
| Correct dates flash then scramble | Race between direct task update and segment trigger | Don't update task dates for segmented tasks |
| Long loading | `onRefresh()` refetches everything from DB unnecessarily | Remove `onRefresh()` after shift -- local state is already correct |
| Duplicate filter code | Same filter in dialog preview and handler | Keep consistent, add comment linking them |

## Files to Change

- `src/components/timeline/TimelineEditor.tsx`: Fix the `handleShiftTimeline` function (lines 1087-1119)

