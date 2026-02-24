

# Production Control Center & Staff Management

## Overview

Two interconnected features: (1) a **Staff directory** with skills/software, and (2) a **Dashboard** that gives a bird's-eye view of all active projects and staff allocation across them. Staff are assigned to project phases, and the dashboard shows who is working on what, when.

---

## Data Model

### New Tables

```text
┌─────────────────────────────┐       ┌──────────────────────────────────┐
│ staff_members               │       │ phase_staff_assignments          │
├─────────────────────────────┤       ├──────────────────────────────────┤
│ id          uuid PK         │──┐    │ id           uuid PK            │
│ full_name   text NOT NULL   │  │    │ phase_id     uuid FK → phases   │
│ email       text            │  └───▶│ staff_id     uuid FK → staff    │
│ role_title  text            │       │ created_at   timestamptz        │
│ skills      text[]          │       └──────────────────────────────────┘
│ softwares   text[]          │
│ avatar_url  text            │
│ is_active   boolean = true  │
│ created_by  uuid            │
│ created_at  timestamptz     │
│ updated_at  timestamptz     │
└─────────────────────────────┘
```

**Key design decisions:**
- **Staff are NOT users** -- they don't log into the app. They're resources managed by the PM. No FK to `auth.users`.
- **Assignment is per-phase**, not per-task. A staff member assigned to the "Production" phase of Project X is implicitly working on it for the phase's full date range (derived from its tasks' segments).
- `created_by` links to the PM who created the staff record (for RLS).
- `skills` and `softwares` are text arrays (e.g. `['3D Animation', 'Compositing']`, `['After Effects', 'Nuke', 'Houdini']`).

### RLS Policies
- **staff_members**: PMs/admins can CRUD their own staff. Admins can see all.
- **phase_staff_assignments**: Same access as the parent project (reuse `has_project_access` pattern).

---

## UX Flow

### 1. Staff Management Page (`/staff`)

New top-nav item between "Clients" and "Templates".

```text
┌──────────────────────────────────────────────────────────┐
│  Staff                                    [+ Add Staff]  │
│  ┌──────────────────────────────────────────────────────┐│
│  │ Name          Role           Skills        Software  ││
│  │ ─────────────────────────────────────────────────────││
│  │ Alice M.      3D Artist      Animation     Maya, C4D ││
│  │ Bob T.        Compositor     Comp, Roto    Nuke, AE  ││
│  │ Clara S.      Editor         Editing       Premiere  ││
│  └──────────────────────────────────────────────────────┘│
└──────────────────────────────────────────────────────────┘
```

- Simple table/card view with inline edit
- Add/edit dialog: name, email, role title, skills (tag input), softwares (tag input)
- Delete with confirmation

### 2. Staff Assignment on Project Detail

On the project's **Timeline tab**, each phase row in the Gantt chart gets a subtle "assign staff" affordance. Clicking it opens a popover/dialog to select staff members for that phase.

```text
Phase: Production  [Alice M., Bob T.]  [+ Assign]
  ┌──── work ────┐  ┌─ review ─┐  ┌──── work ────┐
```

Staff avatars/initials appear as small badges next to the phase name in the Gantt left column.

### 3. Dashboard / Control Center (`/dashboard`)

New page, accessible from top-nav (first item, before "Projects").

```text
┌──────────────────────────────────────────────────────────────────┐
│  Dashboard                                   [Today: Feb 24]    │
│                                                                  │
│  ┌── Active Projects Overview ─────────────────────────────────┐│
│  │                                                              ││
│  │  ◉ Project Alpha     ██████████░░░░░░░  62%  ·  Production  ││
│  │    Staff: Alice, Bob                                         ││
│  │                                                              ││
│  │  ◉ Project Beta      ████░░░░░░░░░░░░░  28%  ·  Pre-Prod   ││
│  │    Staff: Clara                                              ││
│  │                                                              ││
│  │  ◉ Project Gamma     █████████████████  100% ·  Delivered   ││
│  │    Staff: —                                                  ││
│  └──────────────────────────────────────────────────────────────┘│
│                                                                  │
│  ┌── Staff Allocation ─────────────────────────────────────────┐│
│  │         Feb 17   Feb 24   Mar 3    Mar 10   Mar 17          ││
│  │  Alice  ═══════════════════════                              ││
│  │         Project Alpha (Production)                           ││
│  │                                                              ││
│  │  Bob    ═══════════════════════                              ││
│  │         Project Alpha (Production)                           ││
│  │                    ════════════════════                      ││
│  │                    Project Beta (Post-Prod)                  ││
│  │                                                              ││
│  │  Clara  ════════                                             ││
│  │         Project Beta (Pre-Prod)                              ││
│  │                                                              ││
│  │  ⚠ Bob has overlapping assignments Mar 3-10                 ││
│  └──────────────────────────────────────────────────────────────┘│
└──────────────────────────────────────────────────────────────────┘
```

**Two sections:**

1. **Active Projects Overview**: For each active project, show a mini progress bar, current phase (based on today's date vs phase date ranges), and assigned staff. Click → goes to project detail.

2. **Staff Allocation Timeline**: A simplified horizontal bar chart showing each staff member's assignments across all projects over the coming weeks. Color-coded by project. Highlights **conflicts** (a person assigned to overlapping phases on different projects).

---

## Technical Plan

### Database Migration
- Create `staff_members` table with RLS (PM/admin access via `created_by` or `is_admin()`)
- Create `phase_staff_assignments` table with RLS (inherit project access)
- Unique constraint on `(phase_id, staff_id)` to prevent duplicates

### New Files

| File | Purpose |
|------|---------|
| `src/pages/Staff.tsx` | Staff directory CRUD page |
| `src/pages/Dashboard.tsx` | Control center with project overview + allocation timeline |
| `src/components/staff/StaffDialog.tsx` | Add/edit staff member dialog |
| `src/components/staff/StaffAssignmentPopover.tsx` | Assign staff to a phase (used in Gantt) |
| `src/components/dashboard/ProjectOverviewCard.tsx` | Single project summary card |
| `src/components/dashboard/StaffAllocationChart.tsx` | Horizontal timeline showing staff across projects |

### Modified Files

| File | Change |
|------|--------|
| `src/components/layout/TopNav.tsx` | Add "Dashboard" and "Staff" nav items |
| `src/App.tsx` | Add `/dashboard` and `/staff` routes |
| `src/components/timeline/GanttChart.tsx` | Show assigned staff badges in phase rows |
| `src/types/database.ts` | Add `StaffMember` and `PhaseStaffAssignment` types |

### Implementation Order

1. **Database**: Migration for `staff_members` + `phase_staff_assignments` tables with RLS
2. **Staff page**: CRUD for staff directory
3. **Staff assignment**: Popover on Gantt phase rows to assign/remove staff
4. **Dashboard**: Projects overview + staff allocation timeline
5. **Navigation**: Add both new pages to TopNav and router

### Conflict Detection Logic

For the staff allocation chart, query all `phase_staff_assignments` joined with phases and tasks to get date ranges. For each staff member, check if any assignments overlap in time. Flag overlaps with a warning icon.

---

## What This Does NOT Change

- Existing project creation flow (unchanged)
- Existing Gantt chart functionality (only adds staff badges)
- No changes to the schedule engine or segment logic
- No changes to client portal or shared views

