

# Staff Categories System

## What We're Building

A `staff_categories` table to classify staff members (e.g., "3D Artist", "Compositor", "VFX"). Each staff member gets assigned a category. Categories are manageable from the Settings page, and the Staff page/assignment popover can filter by category.

## Database

### New Table: `staff_categories`

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| name | text NOT NULL UNIQUE | Category name |
| created_by | uuid NOT NULL | PM who created it |
| created_at | timestamptz | |

RLS: PMs can CRUD their own (or admin all). Same pattern as `staff_members`.

### Modify `staff_members`

Add a `category_id` column (uuid, nullable, FK to `staff_categories`).

### Seed Data

Insert all 22 categories from the screenshots:
3D Artist, 3D Asset, 3D Scan, AI Artists, Animator, Artistic Direction, Bank Assets, Color Grader, Compositing, Executive Production, Modeling & Texturing, Models, Motion Designer, Other, Photograph, Rendering, Simulation Work, Sound Designer, UI Designer Unreal, Unreal Developer, VFX, Video Editor, Web Developer

## UI Changes

### 1. Settings Page -- New "Staff Categories" Tab

Add a new tab to `SettingsPage.tsx` with a simple list of categories, each with a delete button (trash icon), and an "Add Category" input at the top. Matches the reference screenshots exactly.

### 2. Staff Dialog -- Category Dropdown

Replace the free-text "Role" input in `StaffDialog.tsx` with a `<Select>` dropdown populated from `staff_categories`. Keep the field optional.

### 3. Staff Page -- Show Category Column

Replace the "Role" column in the staff table with "Category", showing the category name from the joined data.

### 4. Staff Assignment Popover -- Group by Category

In `StaffAssignmentPopover.tsx`, group staff by their category for easier selection when assigning to phases.

## Files to Change

| File | Change |
|------|--------|
| Migration SQL | Create `staff_categories` table + add `category_id` to `staff_members` + seed 22 categories |
| `src/pages/SettingsPage.tsx` | Add "Staff Categories" tab with list + add + delete |
| `src/components/staff/StaffDialog.tsx` | Replace role text input with category select dropdown |
| `src/pages/Staff.tsx` | Join category name, show in table |
| `src/components/staff/StaffAssignmentPopover.tsx` | Group staff list by category |

