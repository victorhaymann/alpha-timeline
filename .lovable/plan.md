

# Plan: One-Page Horizontal PDF Timeline Export

## Goal
Create a printable, landscape-oriented, single-page PDF that visually represents the full project timeline (Day 1 to End), showing phase bars, milestones as flags, and review periods — plus a header card with the project logo, PM name, and delivery date. Below the timeline, a table lists review periods with their attached descriptions. This gives clients without platform access a complete visual overview.

## Architecture

The export will be a new function `exportTimelinePDF` inside `ExportPanel.tsx`. It generates an HTML document styled for landscape printing, opens it in a new window, and triggers `window.print()` (same pattern as the existing `exportPDF`). The HTML is self-contained with inline CSS — no external dependencies needed.

## Changes

### 1. `src/components/exports/ExportPanel.tsx` — Add segments prop + new export function

**Props update:**
- Add `segments: TaskSegment[]` to `ExportPanelProps` (review segments are needed to show review periods and their notes).

**New `exportTimelinePDF` function** that builds a landscape HTML page with:

**A) Header card** (top of page):
- Project logo (`project.client_logo_url`) on the left
- Project name (large, centered)
- PM name (`project.pm_name`) and delivery date (`project.end_date`) as small info cards on the right

**B) Visual timeline (middle, full width):**
- Horizontal bar from `project.start_date` to `project.end_date`
- Each phase rendered as a colored horizontal bar segment (using `phase.color`), stacked vertically by phase with the phase name on the left
- Each task rendered as a sub-bar within its phase row
- Milestones rendered as flag markers (▶ or similar CSS shape) at their date position
- Review segments rendered as dashed/striped bars in a distinct style (lighter color or hatched pattern)
- Date axis along the top showing months/weeks
- Today marker as a vertical red line

**C) Review periods table (bottom):**
- A compact table listing all review segments with columns: Phase, Task, Review Dates, Notes (`review_notes`)
- Only segments with `segment_type === 'review'` are shown

**Page styling:**
- `@page { size: landscape; margin: 15mm; }`
- Compact font sizes (10-12px) to fit on one page
- Phase colors used for bars
- Clean, professional, light background

**Update exports array:**
- Add a new entry: `{ id: 'timeline-pdf', title: 'Timeline PDF', description: 'One-page visual timeline for offline sharing', icon: CalendarRange, action: exportTimelinePDF }`

### 2. `src/pages/ProjectDetail.tsx` — Pass segments to ExportPanel

- If `ExportPanel` is rendered (or re-added to a tab/button), pass the `segments` state as a prop
- Currently ExportPanel is imported but not in the JSX — it may need to be wired up (e.g., behind an export button in the timeline header, or re-added as a tab)

Since ExportPanel is currently not rendered anywhere in ProjectDetail, there are two approaches:

**Option A**: Add a "Download Timeline PDF" button directly in the timeline toolbar/header that calls the export logic inline — no need for ExportPanel at all.

**Option B**: Re-add ExportPanel to a tab or dialog.

I will go with **Option A** — add a download button to the project detail page header (near the existing Share/Settings buttons) that directly triggers the timeline PDF generation. This is simpler and more discoverable. The export logic will live in a new utility function in `src/components/exports/exportTimelinePDF.ts` so it can be called from anywhere.

### Revised file plan:

**New file: `src/components/exports/exportTimelinePDF.ts`**
- Pure function: `exportTimelinePDF(project, phases, tasks, segments)` 
- Builds the full landscape HTML string and opens print dialog
- Contains all the inline CSS and layout logic for the visual timeline
- Timeline rendering: calculates day positions proportionally across the page width, draws SVG-like bars using CSS (colored divs with absolute positioning)

**Edit: `src/pages/ProjectDetail.tsx`**
- Add a "PDF" or "Download Timeline" button in the project header area (near Share/Settings)
- Import and call `exportTimelinePDF` with project, phases, tasks, segments

## Technical Details

### Timeline bar calculation
```
totalDays = differenceInDays(endDate, startDate)
taskLeftPercent = differenceInDays(taskStart, projectStart) / totalDays * 100
taskWidthPercent = differenceInDays(taskEnd, taskStart) / totalDays * 100
```

Each phase gets its own horizontal row. Tasks within a phase are rendered as colored bars. Review segments are overlaid with a striped pattern. Milestones are rendered as small flag/diamond icons at their date percentage position.

### Review notes table
Filter `segments` where `segment_type === 'review'`, join with task name and phase name, display `review_notes` content.

