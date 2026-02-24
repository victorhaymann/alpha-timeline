

# Dashboard Overhaul: Dual Gantt Planning View

## Vision

Replace the current card-based dashboard with a proper **Head of Planning** command center featuring two full-width Gantt charts:

1. **Projects Gantt** -- Every active project as a row, with phase bars showing real-time progress
2. **Staff Gantt** -- Every staff member as a row (grouped by category), showing their assignments across projects, with an **availability checker** to find who's free on a given date

Both Gantts share the same timeline scale and have search/filter controls.

---

## UX Design

```text
┌──────────────────────────────────────────────────────────────────────┐
│  Dashboard                                        Mon, Feb 24 2026  │
│                                                                      │
│  ┌── Projects Timeline ─────────────────────────────────────────────┐│
│  │ [Search project...]  [Category: All ▾]                           ││
│  │        Feb 17   Feb 24   Mar 3    Mar 10   Mar 17   Mar 24      ││
│  │  ──────────────────────────────────────────────────────────      ││
│  │  Project Alpha                                                   ││
│  │   ▓▓▓▓Pre▓▓▓▓  ▓▓▓▓▓▓Production▓▓▓▓▓▓  ▓▓Post▓▓  ▓Del▓       ││
│  │                                                                  ││
│  │  Project Beta                                                    ││
│  │           ▓▓Pre▓▓  ▓▓▓▓▓▓▓Production▓▓▓▓▓▓▓  ▓Post▓            ││
│  └──────────────────────────────────────────────────────────────────┘│
│                                                                      │
│  ┌── Staff Allocation ──────────────────────────────────────────────┐│
│  │ [Search name...]  [Category: All ▾]  [📅 Check availability]    ││
│  │        Feb 17   Feb 24   Mar 3    Mar 10   Mar 17   Mar 24      ││
│  │                                                                  ││
│  │  ── 3D Artist ──────────────────────────────────────────────     ││
│  │  Alice M.    ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓                                   ││
│  │              Project Alpha (Production)                          ││
│  │                                                                  ││
│  │  ── Compositor ─────────────────────────────────────────────     ││
│  │  Bob T.      ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓                                   ││
│  │              ⚠ Overlap                ▓▓▓▓▓▓▓▓▓▓               ││
│  │                                                                  ││
│  │  ── Editor ─────────────────────────────────────────────────     ││
│  │  Clara S.    ✅ Available on Mar 10                              ││
│  └──────────────────────────────────────────────────────────────────┘│
└──────────────────────────────────────────────────────────────────────┘
```

### Availability Checker
- A date picker button opens a calendar. Select a date.
- Staff members available on that date get a green "Available" badge.
- Staff with assignments on that date show the project name.
- The list auto-sorts: available staff first.

---

## Technical Plan

### New Components

| File | Purpose |
|------|---------|
| `src/components/dashboard/ProjectsGantt.tsx` | Full-width Gantt with one row per project, phase bars color-coded, today marker, week headers, search input, status filter |
| `src/components/dashboard/StaffGantt.tsx` | Full-width Gantt with staff rows grouped by category, project assignment bars, search, category filter, availability date picker |

### Modified Files

| File | Change |
|------|---------|
| `src/pages/Dashboard.tsx` | Replace card grid + basic allocation chart with the two new Gantt components. Keep data fetching but add `staff_categories` query and pass `category_id` with staff data. |

### Removed Components (no longer needed on dashboard)
- `ProjectOverviewCard` -- no longer rendered (keep file, might be useful elsewhere)
- `StaffAllocationChart` -- replaced by `StaffGantt` (keep file)

### Data Flow

**Dashboard.tsx** fetches:
- `projects` (active/draft) -- already done
- `phases` per project -- already done
- `tasks` with dates -- already done
- `task_segments` -- NEW, needed to show work/review within phases
- `phase_staff_assignments` -- already done
- `staff_members` with `category_id` -- extend existing query
- `staff_categories` -- NEW query

Passes pre-processed data to each Gantt component.

### ProjectsGantt Component

**Props**: projects array with their phases and date ranges

**Features**:
- Search input filters projects by name (case-insensitive)
- Each project = 1 row, with colored phase bars (Pre-Prod, Production, Post-Prod, Delivery)
- Phase bars show segment-level detail (work vs review using dashed pattern for review)
- Today marker (red vertical line)
- Week column headers
- Click on a project row navigates to `/projects/:id`
- Horizontal scroll for timeline, frozen left column with project names
- Timeline range: 2 weeks back to 10 weeks ahead (adjustable)

### StaffGantt Component

**Props**: staff members with their assignments, categories

**Features**:
- Search input filters by staff name
- Category dropdown filters by job category
- Staff rows grouped under category headers (collapsible)
- Each assignment = colored bar (color per project, same palette as ProjectsGantt)
- Tooltip on hover: project name, phase, date range
- Conflict detection (overlapping bars get warning icon)
- **Availability checker**: date picker button. When a date is selected:
  - Each staff row shows a badge: "Available" (green) or the project name (muted)
  - Available staff sort to the top within their category group
  - A summary count appears: "X staff available on [date]"

### Timeline Rendering (shared logic)

Both Gantts use the same time axis:
- Fixed left column (~180px) for names
- Scrollable right area with day columns
- Week header labels (Mon dates)
- Today marker
- Working days only (Mon-Fri) -- reuse `workingDays.ts`

### No Database Changes

All data already exists. We just query `staff_categories` and join `category_id` from `staff_members`, both of which are already in the schema.

