

# Plan: Polish Timeline PDF Export

## Changes to `src/components/exports/exportTimelinePDF.ts`

### 1. Center the project title
The header currently uses a left-aligned layout with `header-left` and `header-right`. Change it to a three-column layout: client logo on the left, project name centered in the middle, and info cards on the right.

### 2. Remove the red "today" vertical line
Remove the `showToday` logic and the entire today-line/dot/label HTML block from the output. Also remove the red progress bar row entirely (the `progress-row` section with the red fill).

### 3. Sort tasks chronologically within each phase
Currently tasks are sorted by `order_index`. Change the sort to use `start_date` (chronological) so milestones and tasks appear in date order within each phase group.

### 4. Add The New Face logo
The logo asset is at `src/assets/tnf-logo-purple.png`. Since the PDF HTML is self-contained and rendered in an iframe, we need to convert the logo to a base64 data URL or use the absolute deployed URL. The approach will be to:
- Accept an optional `tnfLogoUrl` parameter (a base64 data URL generated before calling the function), OR
- Pre-convert the imported asset path to an absolute URL at call time.

The simpler approach: since Vite resolves `import tnfLogo from '@/assets/tnf-logo-purple.png'` to a URL path, we can pass it as an absolute URL (`window.location.origin + tnfLogo`). Add the TNF logo in the top-right corner of the header (or bottom-right of the page as a watermark), matching the shared view branding pattern.

Implementation: Add a `tnfLogoUrl?: string` parameter to the function. In `ProjectDetail.tsx`, import the logo and pass `window.location.origin + tnfLogo` when calling the function.

### 5. Remove browser-injected small text (date stamp, URL)
These are the default browser print headers/footers (date, URL, page number). They cannot be removed via HTML/CSS directly — they are controlled by the browser's print dialog settings. However, we can suppress them with additional `@page` rules and a print-specific approach:
- Add `@page { margin: 0; }` to eliminate the browser header/footer area entirely
- Then use `body { padding: 10mm; }` to create our own margins within the content area
- This is the standard technique to remove "date", "URL", and "page 1/1" from printed pages

### Summary of all edits

**`src/components/exports/exportTimelinePDF.ts`:**
- Update function signature to accept `tnfLogoUrl?: string`
- Change `@page { margin: 10mm }` to `@page { size: landscape; margin: 0; }` and add `body { padding: 10mm; }`
- Restructure header to three columns: client logo left, title centered, info cards right
- Add TNF logo next to info cards (small, top-right area)
- Remove the entire `progress-row` div (red progress bar + date labels)
- Remove the `showToday` / `today-line` / `today-dot` / `today-label` HTML block
- Change task sort from `a.order_index - b.order_index` to chronological: `new Date(a.start_date).getTime() - new Date(b.start_date).getTime()`
- Remove unused CSS for `.today-line`, `.today-dot`, `.today-label`, `.progress-*`

**`src/pages/ProjectDetail.tsx`:**
- Import `tnfLogo from '@/assets/tnf-logo-purple.png'`
- Update the `exportTimelinePDF` call to pass `window.location.origin + tnfLogo` as the 5th argument

