

# Shift All Tasks by X Days

## The Problem
When a client delays feedback, the entire timeline needs to slide forward. Currently, you'd have to manually drag each task one by one -- tedious and error-prone.

## Proposed UX: "Shift Timeline" Dialog

A single dialog accessible from the timeline toolbar (next to Undo / Regenerate) that shifts all tasks and segments forward or backward by a specified number of working days.

### How it works

1. **Trigger**: A new "Shift Timeline" button in the toolbar (with a calendar/arrow icon)
2. **Dialog**: Opens with:
   - A numeric input for "Number of days" (working days)
   - Direction toggle: "Forward" (default) or "Backward"
   - A scope selector: "All tasks" or "From a specific date onward" (with a date picker)
   - A preview summary: "This will move 12 tasks and 8 segments forward by 5 working days"
   - A warning if the shift would push tasks beyond the project end date, with an option to auto-extend the deadline
3. **Confirmation**: "Shift Timeline" button applies the change
4. **Undo**: The entire shift is saved as a single undo step ("Shift timeline +5 days")

### Scope Options

| Scope | Use Case |
|-------|----------|
| **All tasks** | The whole project slipped -- move everything |
| **From date onward** | Only the remaining tasks need to shift (e.g., client was late on Phase 2 feedback, but Phase 1 is already done) |

### What gets shifted
- All task start/end dates (or only those matching the scope)
- All task segments (preserving their relative positions)
- Weekly call / meeting dates
- Dates are snapped to working days after shifting (skipping weekends)
- Dates are clamped to project boundaries (or the project end date is auto-extended)

### Edge Cases Handled
- Tasks already completed or in the past: optionally skip them
- Project end date overflow: warn and offer to extend
- Single undo step for the entire batch operation

---

## Technical Approach

### New Component
- `src/components/timeline/ShiftTimelineDialog.tsx` -- the dialog UI

### Changes to TimelineEditor
- Add a "Shift Timeline" button to the toolbar
- Add a `handleShiftTimeline` function that:
  1. Saves current state to undo stack
  2. Calculates new dates for all affected tasks/segments using `addWorkingDays` from `workingDays.ts`
  3. Batch-updates tasks and segments in the database
  4. Updates local state
  5. Shows a success toast

### Database
- No schema changes needed -- we're just updating existing `start_date` / `end_date` fields on `tasks` and `task_segments` tables

### Working Days
- Uses the existing `addWorkingDays()` utility from `src/lib/workingDays.ts` to skip weekends
- Uses `snapTaskToWorkingDays()` to ensure all resulting dates land on working days
- Respects the project's `working_days_mask`

### Undo Support
- The entire shift operation is saved as a single undo entry
- Ctrl+Z / Cmd+Z reverts all tasks back to their pre-shift positions

