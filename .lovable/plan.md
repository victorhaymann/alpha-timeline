

# Analysis: Why Segmented Tasks (with Reviews) Drag Differently

## The Two Behaviors

### Tasks WITHOUT review segments (works correctly)
1. User clicks the main bar → `handleDragStart(e, task, 'move')` is called with **no segment**
2. Hook reads `task.start_date` and `task.end_date` (line 169-170 of useDragAndResize.ts)
3. These are the same dates used to position the bar visually (line 1205-1208 of GanttChart.tsx uses task dates when no segments exist)
4. The bar follows the cursor perfectly because the **drag origin dates match the visual dates**
5. On drop, `handleDragComplete` routes to `handleTaskUpdate` (simple task path)

### Tasks WITH review segments (broken — bar moves further than cursor)
1. User clicks the main bar → `handleDragStart(e, task, 'move')` is called with **no segment**
2. Hook reads `task.start_date` and `task.end_date` (line 169-170)
3. But the bar is **visually positioned** using segment-derived dates (lines 1203-1208):
   ```
   effectiveStartStr = min(all segment start_dates)
   effectiveEndStr = max(all segment end_dates)
   ```
4. **`task.start_date` and segment-derived `effectiveStartStr` can be different** — the DB trigger syncs them, but there's a timing gap. After a drag, the task row gets updated by the trigger asynchronously. If the local `task.start_date` hasn't been refreshed yet, it's stale.
5. The hook computes `deltaColumns` from the mouse movement, then shifts `originalStart` (which is `task.start_date`) by that delta
6. But the bar's visual position is based on segment dates, not `task.start_date`
7. **If `task.start_date` ≠ `min(segment start_dates)`, the preview jumps to the wrong position**

## Concrete Example

```text
Segments:        [Feb 10 ──── Feb 20]  [Feb 25 ──── Mar 5]
Effective dates: Feb 10 → Mar 5 (used for visual bar position)
task.start_date: Feb 12 (stale — hasn't been synced by trigger yet)
task.end_date:   Mar 3  (also stale)

User drags right by 2 columns (2 days):
  Hook computes: newStart = Feb 12 + 2 = Feb 14, newEnd = Mar 3 + 2 = Mar 5
  Preview shows: bar at Feb 14 → Mar 5

But the bar was visually at Feb 10 → Mar 5
So the bar appears to jump 4 days right instead of 2
```

This is why the behavior is inconsistent — sometimes `task.start_date` matches the segment-derived dates (right after a refresh), and sometimes it doesn't (after a previous drag or when the trigger is slow).

## The Fix

The hook should use the **same dates that position the bar visually**. For tasks with segments, the main bar's `handleDragStart` should pass the segment-derived effective dates, not `task.start_date`/`task.end_date`.

### Change in `GanttChart.tsx` (line 1389)

Currently:
```typescript
onMouseDown={readOnly ? undefined : (e) => handleDragStart(e, task, 'move')}
```

The hook then reads `task.start_date` / `task.end_date` (line 169-170 of useDragAndResize.ts).

**Fix**: Create a synthetic task object with the effective dates when segments exist, so the hook's `task.start_date` matches what's visually rendered:

```typescript
// Before the bar JSX, compute the "drag task" with effective dates
const dragTask = taskSegments.length > 0 
  ? { ...task, start_date: effectiveStartStr, end_date: effectiveEndStr }
  : task;

// Then in onMouseDown:
onMouseDown={readOnly ? undefined : (e) => handleDragStart(e, dragTask, 'move')}
```

This ensures the hook's `originalStart`/`originalEnd` always match the bar's visual position. The delta calculation then produces correct pixel-to-date mapping.

The same fix applies to:
- The resize handles on the main bar (lines 1394-1397, 1419-1422) — should also use `dragTask`
- The milestone bar (line 1306) — should also use `dragTask` if milestones ever have segments

No changes needed for the review subrow bars — those already pass `seg` (the segment object) and use `seg.start_date`/`seg.end_date`, which is correct.

### Files Changed

| File | Change |
|------|--------|
| `src/components/timeline/GanttChart.tsx` | Compute `dragTask` with segment-derived effective dates. Pass `dragTask` instead of `task` to all three `handleDragStart` calls on the main task bar (move + both resize handles). ~6 lines changed. |

No changes to `useDragAndResize.ts` or `TimelineEditor.tsx` — the hook and persistence layer are correct. The bug is purely that the wrong dates are passed into the hook at drag start.

