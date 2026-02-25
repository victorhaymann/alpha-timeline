

# Redesign Project Stats Cards

## Current State
Three equal-width cards (`md:grid-cols-3`): Duration, Buffer, Project Manager. The PM card grows taller when email/phone are present, causing uneven heights.

## Changes to `src/pages/ProjectDetail.tsx`

### 1. Replace "Duration" with "Delivery Date"
- Change label from "Duration" / `{totalDays} days` to "Delivery Date" / formatted `project.end_date` (e.g. "Mar 28, 2026").
- No new data needed — `project.end_date` is already available.

### 2. Make PM card wider, fix height consistency
- Change grid from `md:grid-cols-3` to a custom layout: `grid-cols-[1fr_1fr_1.5fr]` so the PM card is 50% wider.
- Set a fixed height on all cards (`h-[88px]`) so the PM card with email+phone doesn't push the row taller.
- Inside the PM card, lay out name/email/phone in a compact single-row or two-row layout that fits the fixed height:
  - Name on one line, email and phone inline on the second line (icons only, values beside them, separated by a gap).

### 3. Visual polish
- Reduce internal padding slightly (`pt-5 pb-4` instead of `pt-6`) for a tighter feel.
- Ensure all three cards vertically center their content for visual alignment.

### Summary of file changes

| File | Change |
|------|--------|
| `src/pages/ProjectDetail.tsx` (lines 502-567) | Replace Duration with Delivery Date. Change grid to `1fr 1fr 1.5fr`. Add fixed height. Compact PM card layout with inline email+phone. |

