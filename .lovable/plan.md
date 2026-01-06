# Plan: Improve Vertical Drag Reordering - Swap-Only Behavior

## Problem Analysis

The current vertical drag implementation shifts ALL items between the original and target positions, which creates the sensation that the entire task list is moving. This feels disorienting and imprecise.

### Current Behavior (Undesirable)
When dragging a task from index 2 to index 5:
- Task at index 3 shifts up
- Task at index 4 shifts up  
- Task at index 5 shifts up
- **Result**: 3 items moving simultaneously - feels like whole list is moving

### Desired Behavior (Swap-Only)
When dragging a task from index 2 to index 5:
- Only the task at index 5 shifts to swap positions
- **Result**: 1 item moving - feels localized, precise, and intuitive

---

## Visual Diagram

```
CURRENT (All items shift):
Before:  [A] [B] [C] [D] [E]
Drag B→D: [A] [ ] [C↑][D↑][B] [E]  ← C and D both move up

PROPOSED (Swap only):
Before:  [A] [B] [C] [D] [E]  
Drag B→D: [A] [D↓][ ] [ ] [B] [E]  ← Only D moves to B's spot
```

---

## Implementation Plan

### Step 1: Modify `useVerticalReorder.ts` - Swap-Only Logic

**File:** `src/hooks/useVerticalReorder.ts`

Update `getVerticalDragStyles` function (lines 113-152) to only affect the single item being swapped:

**Current logic:**
```typescript
// Shifts ALL items between positions
if (draggedCurrentIndex > draggedOriginalIndex) {
  if (actualIndex > draggedOriginalIndex && actualIndex <= draggedCurrentIndex) {
    return { transform: `translateY(-${rowHeight}px)` };
  }
}
```

**New swap-only logic:**
```typescript
// Only the item at the current drop target swaps with original position
if (actualIndex === draggedCurrentIndex && draggedCurrentIndex !== draggedOriginalIndex) {
  // Calculate how far this item needs to move to take the dragged item's original spot
  const distance = (draggedOriginalIndex - draggedCurrentIndex) * rowHeight;
  return {
    transform: `translateY(${distance}px)`,
    transition: 'transform 200ms cubic-bezier(0.2, 0, 0, 1)',
  };
}
```

### Step 2: Add `getSwapTargetClasses` Function

**File:** `src/hooks/useVerticalReorder.ts`

Add a new function to identify and highlight the swap target:

```typescript
const getSwapTargetClasses = useCallback((taskId: string, actualIndex: number): string => {
  if (!verticalDrag) return '';
  
  // Highlight the item that will be swapped
  if (actualIndex === verticalDrag.currentIndex && 
      verticalDrag.currentIndex !== verticalDrag.originalIndex &&
      verticalDrag.taskId !== taskId) {
    return 'gantt-swap-target';
  }
  return '';
}, [verticalDrag]);
```

Update the return type and return statement to include this new function.

### Step 3: Add CSS Classes for Visual Feedback

**File:** `src/index.css`

Add new classes for the swap interaction:

```css
/* Swap target highlight */
.gantt-swap-target {
  background-color: hsl(var(--primary) / 0.08);
  border-left: 2px solid hsl(var(--primary) / 0.4);
  transition: all 200ms cubic-bezier(0.2, 0, 0, 1);
}

/* Enhanced dragging item */
.gantt-vertical-dragging {
  background: hsl(var(--card));
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15), 0 2px 8px rgba(0, 0, 0, 0.1);
  transform-origin: center;
  z-index: 100;
  border-radius: 6px;
}

/* Drop position indicator line */
.gantt-drop-line {
  position: absolute;
  left: 0;
  right: 0;
  height: 2px;
  background: hsl(var(--primary));
  opacity: 0;
  transition: opacity 150ms ease-out;
  pointer-events: none;
  box-shadow: 0 0 8px hsl(var(--primary) / 0.5);
}

.gantt-drop-line.active {
  opacity: 1;
}
```

### Step 4: Apply New Classes in GanttChart

**File:** `src/components/timeline/GanttChart.tsx`

Update task row rendering to use the new `getSwapTargetClasses`:

For review cycles (around line 1025):
```tsx
<div 
  key={cycle.id}
  className={cn(
    getVerticalDragClasses(cycle.baseTask.id),
    getSwapTargetClasses(cycle.baseTask.id, cycleIndex)
  )}
  style={getVerticalDragStyles(cycle.baseTask.id, cycleIndex)}
>
```

For ungrouped tasks (around line 1111):
```tsx
<div 
  key={task.id}
  className={cn(
    "flex items-center gap-2 px-3 group hover:bg-muted/30 transition-colors",
    getVerticalDragClasses(task.id),
    getSwapTargetClasses(task.id, overallIndex),
    isBeingDragged && "bg-card"
  )}
  style={{ 
    height: ROW_HEIGHT,
    ...getVerticalDragStyles(task.id, overallIndex)
  }}
>
```

### Step 5: Add Optional Drop Position Indicator

Add a thin colored line showing exactly where the task will land after drop:

**In hook:** Add `getDropLinePosition` that returns the Y offset for the indicator
**In component:** Render a positioned div that appears at the drop location

---

## Animation Timing Summary

| Element | Animation | Duration | Easing |
|---------|-----------|----------|--------|
| Dragged item | Follow cursor | Immediate | none |
| Swap target | Slide to original spot | 200ms | cubic-bezier(0.2, 0, 0, 1) |
| Swap target highlight | Fade in | 200ms | ease-out |
| Drop line | Fade in/out | 150ms | ease-out |

---

## Files to Modify

### Critical Files for Implementation

- `src/hooks/useVerticalReorder.ts` - Core swap logic, add getSwapTargetClasses function
- `src/index.css` - Add .gantt-swap-target and .gantt-drop-line CSS classes  
- `src/components/timeline/GanttChart.tsx` - Apply new classes to task rows
