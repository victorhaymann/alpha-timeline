

# Project Status Indicator on Dashboard

## What We're Building

Add a visible **status badge** to each project row in the Projects Gantt (left column), and a **status filter** in the header so the Head of Planning can toggle between showing "In Production" vs "Delivered" projects. The existing database enum already has `active` and `completed` -- we'll map these to user-friendly labels: **In Production** = `active`, **Delivered** = `completed`.

No database changes needed -- the `project_status` enum already supports this.

## Changes

### 1. Dashboard.tsx -- Fetch all statuses, not just active/draft

Currently filters to `['active', 'draft']`. Change to `['active', 'draft', 'completed']` so delivered projects are available when the filter is toggled.

### 2. ProjectsGantt.tsx -- Add status badge + filter

**Left column**: Add a small colored badge next to each project name:
- `active` → green "In Production" badge
- `draft` → amber "Draft" badge  
- `completed` → blue "Delivered" badge

**Header bar**: Add a status filter (segmented buttons or select) with options:
- **In Production** (default) -- shows `active` + `draft` projects
- **Delivered** -- shows `completed` projects
- **All** -- shows everything

### 3. ProjectDetail.tsx -- Add status toggle

Add a clickable status badge or dropdown on the project detail page header so PMs can mark a project as "Delivered" (sets `status = 'completed'`) or back to "In Production" (`status = 'active'`). This replaces the current read-only badge.

### Files to modify

| File | Change |
|------|--------|
| `src/pages/Dashboard.tsx` | Expand status filter in query to include `completed` |
| `src/components/dashboard/ProjectsGantt.tsx` | Add status badge per row + status filter buttons in header |
| `src/pages/ProjectDetail.tsx` | Make status badge clickable to toggle between active/completed |

