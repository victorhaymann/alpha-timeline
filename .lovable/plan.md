

# Review Notes for Client Feedback Segments

## Problem

When a review segment appears on the timeline, the client has no context on **what** they need to review. The admin/PM writes nothing, and the client sees a dashed "Review" bar with no actionable information.

## Solution

Add a `review_notes` text field to each review segment. PMs can write instructions (e.g., "Please review the 3D model textures and provide feedback on lighting"). Clients see a clickable review bar that opens a dialog with the instructions.

---

## Database Change

### Alter `task_segments` table

Add a nullable `review_notes` column:

```sql
ALTER TABLE task_segments ADD COLUMN review_notes text;
```

No RLS changes needed -- the existing policies already cover read/write access for segments.

---

## UI Changes

### 1. Admin Side -- Edit review notes inline

**File: `src/components/timeline/GanttChart.tsx`**

When a PM clicks on a **review segment** bar (not drag), open a small dialog/popover where they can type review instructions. This reuses the existing click flow (currently only opens the popover menu via the `...` button).

Add a new callback prop `onEditReviewNotes` and a new dialog component.

**File: `src/components/timeline/ReviewNotesDialog.tsx`** (NEW)

A simple dialog with:
- Title: "Review Instructions for [Task Name]"
- A `<Textarea>` for the PM to write what the client should review
- Save button that updates `task_segments.review_notes` via Supabase
- Character indicator (optional)

**File: `src/components/timeline/TaskPopoverMenu.tsx`**

Add a new menu item "Edit Review Notes..." that only appears for review segments. This triggers the new dialog.

### 2. Admin Side -- Visual indicator

When a review segment has notes written, show a small document icon or filled dot on the review badge to indicate instructions exist. This helps PMs see at a glance which reviews have instructions.

### 3. Client Side -- Click to view review notes

**File: `src/components/timeline/GanttChart.tsx`**

When `readOnly={true}` and a client clicks on a review segment bar:
- If the segment has `review_notes`, open a read-only dialog showing the instructions
- If no notes exist, show nothing (or a brief "No instructions yet" tooltip)

**File: `src/components/timeline/ReviewNotesViewDialog.tsx`** (NEW)

A read-only dialog with:
- Title: "Review Instructions"
- Task name and review period dates
- The review notes text rendered as formatted content
- A subtle "If you have questions, contact your PM" footer

This dialog is used in both `ClientProjectView.tsx` and `SharedProjectView.tsx` since both render the GanttChart with `readOnly={true}`.

### 4. Data flow

**File: `src/pages/ProjectDetail.tsx`**

Pass the segments (already fetched) to GanttChart -- no change needed since segments already include all columns.

**File: `src/pages/ClientProjectView.tsx`** and `src/pages/SharedProjectView.tsx`**

Segments are already fetched. The new `review_notes` column will automatically be included in `SELECT *` queries. No code changes needed for data fetching.

---

## Files Summary

| File | Change |
|------|--------|
| Migration SQL | Add `review_notes text` column to `task_segments` |
| `src/components/timeline/ReviewNotesDialog.tsx` | NEW -- Edit dialog for PMs |
| `src/components/timeline/ReviewNotesViewDialog.tsx` | NEW -- Read-only dialog for clients |
| `src/components/timeline/TaskPopoverMenu.tsx` | Add "Edit Review Notes..." menu item for review segments |
| `src/components/timeline/GanttChart.tsx` | Handle click on review segments to open view/edit dialog; add visual indicator for segments with notes |

