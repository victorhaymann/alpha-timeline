

# Add "Add Review" to Task Popover Menu

## What This Does

When hovering over a task bar, the popover menu will show a new "Add Review" option. Clicking it creates a 1-working-day review segment appended after the task's last segment in the reviews sub-row.

## Changes

### 1. `src/components/timeline/TaskPopoverMenu.tsx`
- Add `onAddReview?: (taskId: string) => void` prop
- Add a new menu button "Add Review" with a `Plus` icon, shown when hovering the main bar (not a review segment)
- Placed before the delete separator

### 2. `src/components/timeline/GanttChart.tsx`
- Add `onAddReviewSegment?: (taskId: string) => void` to `GanttChartProps`
- Pass it to `TaskPopoverMenu` as `onAddReview={onAddReviewSegment}`

### 3. `src/components/timeline/TimelineEditor.tsx`
- Implement `handleAddReviewSegment(taskId: string)`:
  1. Save undo state
  2. Find existing segments for this task
  3. If no segments exist: create a "work" segment covering the task's current dates, then a 1-working-day "review" segment starting the next working day after the work segment
  4. If segments exist: find the last segment's `end_date`, create a 1-working-day "review" segment starting the next working day after that
  5. Insert via `supabase.from('task_segments').insert()`
  6. Update local segments state
  7. The DB trigger auto-syncs parent task dates
- Pass `handleAddReviewSegment` to `<GanttChart>` as `onAddReviewSegment`

### Technical Details
- Default review duration: 1 working day (start = end = next working day after last segment)
- Uses `nextWorkingDay` and `addWorkingDays` from `workingDays.ts`
- Uses `normalizeSegmentDates` for project bounds clamping
- `order_index` set to `max(existing) + 1`
- `segment_type: 'review'`
- Undo system captures state before insertion so it can be reverted

