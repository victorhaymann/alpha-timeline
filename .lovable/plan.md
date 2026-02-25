

# Fix: Double Logic Causing Segment "Jump" on Drag

## Root Cause — Stale Closure Clobber

When you drag the **main task bar** of a segmented task, `handleTaskOrSegmentsDrag` in GanttChart.tsx calls `onUpdateSegment` **once per segment** in a `for` loop. Each call goes to `handleUpdateSegment` in TimelineEditor.tsx, which does:

```text
const updatedSegments = segments.map(s => s.id === segmentId ? { ...s, ...normalized } : s);
onSegmentsChange(updatedSegments);
```

The problem: `segments` is captured from a React closure. All loop iterations reference the **same stale** `segments` array. Each call overwrites the previous one:

```text
Task has 3 segments. User drags +5 days.

Call 1: segments.map → updates seg1, seg2+seg3 unchanged → onSegmentsChange([seg1', seg2, seg3])
Call 2: segments.map → updates seg2, seg1+seg3 unchanged → onSegmentsChange([seg1, seg2', seg3])  ← seg1 reverts!
Call 3: segments.map → updates seg3, seg1+seg2 unchanged → onSegmentsChange([seg1, seg2, seg3']) ← seg1+seg2 revert!
```

Only the **last** segment's move survives in local state. The DB gets all 3 correct writes, so after the next data refresh the bar jumps to the correct position — hence "going in one place and then another."

There is also a secondary issue: `handleUpdateSegment` calls `saveToUndoStack` on **every** individual segment, polluting the undo stack with N entries for a single drag operation.

## Fix Strategy

Replace the per-segment `onUpdateSegment` loop with a **batch** approach:

1. Add a new `onBatchUpdateSegments` prop to GanttChart
2. In TimelineEditor, create `handleBatchUpdateSegments` that does **one** undo save, **one** batch DB call, and **one** local state update
3. In `handleTaskOrSegmentsDrag`, compute all segment updates and pass them as a single batch

This eliminates both the stale closure clobber and the undo stack pollution.

## Technical Details

### 1. `src/components/timeline/TimelineEditor.tsx`

Add a new batch handler:

```typescript
const handleBatchUpdateSegments = useCallback(async (
  updates: { segmentId: string; changes: { start_date?: string; end_date?: string } }[]
) => {
  if (updates.length === 0) return;
  
  // Single undo save
  const firstSeg = segments.find(s => s.id === updates[0].segmentId);
  const task = firstSeg ? tasks.find(t => t.id === firstSeg.task_id) : null;
  saveToUndoStack(task ? `Move "${task.name}"` : 'Move task');
  
  try {
    // Normalize all updates
    const normalizedUpdates = updates.map(({ segmentId, changes }) => {
      const segment = segments.find(s => s.id === segmentId);
      if (!segment) return null;
      const currentStart = new Date(changes.start_date || segment.start_date);
      const currentEnd = new Date(changes.end_date || segment.end_date);
      const normalized = normalizeSegmentDates(currentStart, currentEnd, {
        projectStartDate, projectEndDate,
        workingDaysMask: project.working_days_mask ?? 31,
      });
      return { segmentId, normalized };
    }).filter(Boolean);
    
    // Batch DB writes (fire all at once)
    await Promise.all(normalizedUpdates.map(({ segmentId, normalized }) =>
      supabase.from('task_segments').update(normalized).eq('id', segmentId)
    ));
    
    // Single local state update
    let updatedSegments = [...segments];
    for (const { segmentId, normalized } of normalizedUpdates) {
      updatedSegments = updatedSegments.map(s =>
        s.id === segmentId ? { ...s, ...normalized } : s
      );
    }
    onSegmentsChange(updatedSegments);
  } catch (error) {
    console.error('Error batch updating segments:', error);
    toast({ title: 'Error', description: 'Failed to update periods.', variant: 'destructive' });
  }
}, [segments, tasks, saveToUndoStack, projectStartDate, projectEndDate, project.working_days_mask, onSegmentsChange, toast]);
```

Pass it to GanttChart:
```tsx
<GanttChart
  ...
  onBatchUpdateSegments={handleBatchUpdateSegments}
/>
```

### 2. `src/components/timeline/GanttChart.tsx`

**Props**: Add `onBatchUpdateSegments` to `GanttChartProps`.

**`handleTaskOrSegmentsDrag`**: Replace the per-segment `onUpdateSegment` loop with a single `onBatchUpdateSegments` call:

```typescript
const handleTaskOrSegmentsDrag = useCallback((taskId: string, updates: Partial<Task>) => {
  const taskSegs = segments.filter(s => s.task_id === taskId);
  if (taskSegs.length > 0 && onBatchUpdateSegments && updates.start_date && updates.end_date) {
    const segStarts = taskSegs.map(s => new Date(s.start_date).getTime());
    const segEnds = taskSegs.map(s => new Date(s.end_date).getTime());
    const oldStart = new Date(Math.min(...segStarts));
    const oldEnd = new Date(Math.max(...segEnds));
    const newStart = new Date(updates.start_date as string);
    const newEnd = new Date(updates.end_date as string);
    const startDelta = differenceInDays(newStart, oldStart);
    const endDelta = differenceInDays(newEnd, oldEnd);
    if (startDelta === 0 && endDelta === 0) return;

    const sorted = [...taskSegs].sort((a, b) => a.order_index - b.order_index);
    const batchUpdates: { segmentId: string; changes: { start_date?: string; end_date?: string } }[] = [];

    if (startDelta === endDelta) {
      // MOVE: shift all segments
      for (const seg of taskSegs) {
        batchUpdates.push({
          segmentId: seg.id,
          changes: {
            start_date: format(addDays(new Date(seg.start_date), startDelta), 'yyyy-MM-dd'),
            end_date: format(addDays(new Date(seg.end_date), startDelta), 'yyyy-MM-dd'),
          },
        });
      }
    } else if (startDelta === 0) {
      // RESIZE-END: last segment only
      const lastSeg = sorted[sorted.length - 1];
      batchUpdates.push({
        segmentId: lastSeg.id,
        changes: { end_date: format(addDays(new Date(lastSeg.end_date), endDelta), 'yyyy-MM-dd') },
      });
    } else if (endDelta === 0) {
      // RESIZE-START: first segment only
      const firstSeg = sorted[0];
      batchUpdates.push({
        segmentId: firstSeg.id,
        changes: { start_date: format(addDays(new Date(firstSeg.start_date), startDelta), 'yyyy-MM-dd') },
      });
    } else {
      // Mixed: shift all + adjust last end
      for (const seg of taskSegs) {
        batchUpdates.push({
          segmentId: seg.id,
          changes: {
            start_date: format(addDays(new Date(seg.start_date), startDelta), 'yyyy-MM-dd'),
            end_date: format(addDays(new Date(seg.end_date), startDelta), 'yyyy-MM-dd'),
          },
        });
      }
      const lastSeg = sorted[sorted.length - 1];
      // Override last segment's end_date with the correct end delta
      const lastIdx = batchUpdates.findIndex(u => u.segmentId === lastSeg.id);
      if (lastIdx >= 0) {
        batchUpdates[lastIdx].changes.end_date = format(addDays(new Date(lastSeg.end_date), endDelta), 'yyyy-MM-dd');
      }
    }

    onBatchUpdateSegments(batchUpdates);
  } else {
    onTaskUpdate(taskId, updates);
  }
}, [segments, onBatchUpdateSegments, onTaskUpdate]);
```

**Remove**: The `handleSegmentUpdate` wrapper (lines 302-307) is no longer needed for task-bar drags. Keep `onUpdateSegment` for individual **review segment** drags on the sub-row (those drag one segment at a time, no stale closure issue).

### 3. No other files change

The `useDragAndResize` hook, DB trigger, and `normalizeSegmentDates` utility all remain unchanged.

## Summary

| File | Change |
|------|--------|
| `src/components/timeline/TimelineEditor.tsx` | Add `handleBatchUpdateSegments` — single undo save, batch DB writes via `Promise.all`, single local state update. Pass as new prop to GanttChart. |
| `src/components/timeline/GanttChart.tsx` | Add `onBatchUpdateSegments` prop. Rewrite `handleTaskOrSegmentsDrag` to build a batch array and call `onBatchUpdateSegments` once instead of looping `onUpdateSegment`. |

