

# Plan: Show Milestones as Flags in Dashboard Projects Timeline

## Problem
In the Dashboard's Projects Timeline, milestone tasks are included in phase date-range calculations, producing a single wide bar spanning milestone dates (e.g., April 15 to May 1) instead of individual flag icons on each date.

## Root Cause
1. The Dashboard query in `Dashboard.tsx` does not fetch `task_type` for tasks, so milestones cannot be identified.
2. Phase bar date ranges in `Dashboard.tsx` include milestone tasks, inflating the span.
3. `ProjectsGantt.tsx` only renders rectangular bars — it has no concept of milestone flags.

## Changes

### 1. `src/pages/Dashboard.tsx` — Fetch `task_type` and separate milestones from phase bars

- Add `task_type` to the tasks query select: `'id, phase_id, project_id, start_date, end_date, name, task_type, is_feedback_meeting'` (already has `task_type`, but currently filters out meetings only — milestones are included in phase date calc).
- When building `phaseBars`, **exclude** milestone tasks from the date range calculation (`t.task_type !== 'milestone'`).
- Build a separate `milestones` array per project: for each milestone task, extract `{ date, color, name }` using the phase color.
- Pass `milestones` alongside `phases` in each project row.

### 2. `src/components/dashboard/ProjectsGantt.tsx` — Render milestone flags

- Update the `ProjectRow` interface to include `milestones: { name: string; date: Date; color: string }[]`.
- In the row rendering section (where phase bars are drawn), after rendering phase bars, render each milestone as a `Flag` icon (from `lucide-react`) positioned at its date column — same visual style as the project Gantt (filled flag with phase color, `w-4 h-4`).
- Each flag gets a `Tooltip` showing the milestone name and date.
- Milestones do **not** participate in lane calculations (they are point markers, not bars).

## Visual Result
- Phase bars show only the span of work tasks (excluding milestones).
- Each milestone appears as a colored flag icon at its exact date on the project row.
- Lancaster (Coty) will show two flags on April 15 and May 1 instead of one long segment.

