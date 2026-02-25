

# Visual Alignment: Project Gantt → Dashboard Gantt Style

## Reference Analysis

The dashboard Gantt (ProjectsGantt.tsx) has a clean, light, elegant aesthetic:
- White card background (`bg-card`)
- Very subtle grid lines (`border-border/10`)
- Minimal 2-row header (week date + single day letter)
- Flat-colored bars with `opacity: 0.9`, `rounded-sm`, small `shadow-sm`
- Simple today marker (`w-0.5 bg-destructive/70`, no animation)
- Light left-column header (`bg-muted/30`)
- Understated hover states (`hover:bg-muted/20`)
- `text-[10px]` and `text-[9px]` font sizes for header labels
- No alternating week shading
- `rounded-lg` container

The project Gantt (GanttChart.tsx) currently uses:
- Grey muted background (`bg-muted`)
- Heavy grid lines (`border-border/60`)
- 3-row header with bold uppercase text (Month/Week/Day — 84px total)
- Gradient bars with heavy shadows (`boxShadow: 0 4px 12px`)
- Animated pulsing today marker with indicator dot
- Dark left column (`bg-muted`)
- Stronger hover states (`hover:bg-muted/40`)
- `text-xs font-bold uppercase tracking-wider` header text
- Alternating week shading (`bg-black/[0.04]`)
- `rounded-xl` container

## Changes (UI only — no logic changes)

### File: `src/components/timeline/GanttChart.tsx`

**1. Main container (line 748)**
- FROM: `rounded-xl bg-muted border border-border shadow-sm`
- TO: `rounded-lg border border-border bg-card overflow-hidden`

**2. Left pane background (line 751)**
- FROM: `bg-muted border-r border-border`
- TO: `bg-card border-r border-border`

**3. Left pane header (line 753-758)**
- FROM: `bg-muted/50 font-semibold text-xs md:text-sm tracking-wide uppercase`
- TO: `bg-muted/30` with `text-[10px] font-medium text-muted-foreground uppercase tracking-wider` (matching dashboard's "PROJECT" header)

**4. Timeline header background (line 1036)**
- FROM: `bg-muted/50`
- TO: `bg-muted/30`

**5. Month row (line 1040-1049)**
- FROM: `text-xs font-bold uppercase tracking-wider text-foreground`
- TO: `text-[10px] font-medium text-muted-foreground` — subtler, matching dashboard week headers

**6. Week row (line 1053-1068)**
- FROM: `text-xs font-bold uppercase tracking-wider text-foreground`
- TO: `text-[10px] font-medium text-muted-foreground`
- Remove alternating week background (`isAlternateWeek && "bg-black/[0.04]"`)

**7. Day row (line 1072-1091)**
- FROM: 36px height, number + letter, `font-bold text-foreground` + `text-muted-foreground text-[10px]`
- TO: Single line day letter only (like dashboard: `format(d, 'EEE').charAt(0)`), `text-[9px] text-muted-foreground`, reduce height
- Remove alternating week background

**8. Grid column borders throughout (all `border-r border-border/60`)**
- FROM: `border-border/60`
- TO: `border-border/10` (very subtle, like dashboard)

**9. Alternating week shading — remove all instances**
- Remove `isAlternateWeek && "bg-black/[0.04]"` from grid backgrounds in:
  - Phase separator grid
  - Weekly call grid
  - Task row grid
  - Review sub-row grid

**10. Task bar styling (line 1376-1391)**
- FROM: `h-7 rounded-md` with `linear-gradient` and `boxShadow: 0 4px 12px ${color}66`
- TO: `h-5 rounded-sm` with flat color and `shadow-sm`, `opacity: 0.9` (matching dashboard bars)

**11. Review segment bar styling (line 1526-1538)**
- Reduce height from `h-5` to `h-4`
- Lighten shadow

**12. Today marker (line 1650-1677)**
- FROM: Animated pulse with top indicator dot and heavy glow shadow
- TO: Simple `w-0.5 bg-destructive/70 z-10` line (no animation, no dot)

**13. Row hover states**
- FROM: `hover:bg-muted/40`
- TO: `hover:bg-muted/20`

**14. Phase separator row styling (line 1119-1135)**
- FROM: `bg-muted/20`
- TO: transparent (let card background show through)

**15. Ghost bar during drag (line 1340-1347)**
- Reduce height from `h-7` to `h-5` to match new bar height

**16. Tooltip bar hover effects (line 1378)**
- FROM: `hover:shadow-xl hover:ring-2 hover:ring-white/40`
- TO: `hover:shadow-md` (subtler)

### File: `src/components/timeline/ganttTypes.ts`

**17. Reduce DAY_ROW_HEIGHT**
- FROM: `DAY_ROW_HEIGHT = 36`
- TO: `DAY_ROW_HEIGHT = 24` (matching dashboard day row)
- This changes `HEADER_HEIGHT` from 84 to 72

### Summary of visual effect

The project Gantt will shift from a heavy, dark, industrial look to the same clean, white-card, subtle-grid, flat-bar aesthetic as the dashboard. The 3-tier header (Month/Week/Day) is preserved for navigation but with lighter typography. All interactive functionality (drag, resize, reorder, popovers) remains untouched.

| Area | Current | After |
|------|---------|-------|
| Container | Grey muted, rounded-xl | White card, rounded-lg |
| Grid lines | Heavy (60% opacity) | Subtle (10% opacity) |
| Header text | Bold, black, uppercase | Light, muted, smaller |
| Task bars | 28px, gradient, heavy shadow | 20px, flat color, subtle shadow |
| Today marker | Animated pulse + dot | Simple thin line |
| Week shading | Alternating grey bands | None |
| Hover states | Strong (40%) | Subtle (20%) |

