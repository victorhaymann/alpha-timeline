

# Plan: Add "Delete Review" to Review Segment Popover Menu

## Problem
When right-clicking/hovering a review segment on the Gantt sub-row, the popover shows "Delete Task" which deletes the entire task. PMs need a way to delete individual review segments without losing the whole task.

## Changes

### 1. `src/components/timeline/TaskPopoverMenu.tsx`
- Add new prop `onDeleteReviewSegment?: (segmentId: string) => void`
- When the hovered segment is a review segment:
  - Show "Delete Review" (with Trash2 icon, destructive styling) instead of "Delete Task"
- When NOT hovering a review segment:
  - Show "Delete Task" as before (no change)
- This ensures review popovers only allow deleting the specific review, not the parent task

### 2. `src/components/timeline/GanttChart.tsx`
- Add new prop `onDeleteReviewSegment?: (segmentId: string) => void`
- Pass it through to `TaskPopoverMenu`
- Conditionally pass: if the hovered segment is a review, pass `onDeleteReviewSegment` and omit `onDeleteTask`; otherwise pass `onDeleteTask` and omit `onDeleteReviewSegment`

### 3. `src/components/timeline/TimelineEditor.tsx`
- Create `handleDeleteReviewSegment(segmentId: string)` handler:
  - Delete the segment from `task_segments` table via Supabase
  - Refetch data to update the UI
  - Show a success toast
- Pass `onDeleteReviewSegment={handleDeleteReviewSegment}` to `GanttChart`

## Behavior Summary
- Hovering a **work segment** or **task bar**: popover shows "Delete Task"
- Hovering a **review segment**: popover shows "Edit Review Notes..." + "Add Review" + "Delete Review" (no "Delete Task")

