# Plan: Refactor Drag and Drop with Enhanced Animations (COMPLETED)

## Overview
Refactor the GanttChart drag and drop functionality into a clean, maintainable custom hook with polished animations and visual feedback for moving and resizing task bars.

---

## Current State Analysis

### Existing Implementation (GanttChart.tsx)
- **Drag state**: Managed with `dragging` state object (lines 114-121)
- **Drag preview**: Tracked with `dragPreview` state (line 122)
- **Drop animation**: Uses `justDropped` state with `animate-spring-settle` (line 123)
- **Handlers**: `handleDragStart`, `handleDragMove`, `handleDragEnd` (lines 715-786)
- **Event listeners**: Attached in `useState` side effect (lines 789-798) - this is incorrect pattern

### Issues with Current Implementation
1. Event listeners attached using `useState` instead of `useEffect`
2. Drag logic is scattered throughout the component
3. Limited visual feedback during drag
4. No smooth cursor feedback
5. Missing ghost/shadow preview while dragging
6. No elastic/rubber-band effect when hitting boundaries
7. Resize handles lack visual feedback

---

## Refactoring Plan

### Part 1: Create Custom Hook `useDragAndResize`

Create a new file `src/hooks/useDragAndResize.ts` that encapsulates all drag logic:

```typescript
interface DragState {
  taskId: string;
  type: 'move' | 'resize-start' | 'resize-end';
  startX: number;
  originalStart: Date;
  originalEnd: Date;
  originalDuration: number;
}

interface DragPreview {
  start: Date;
  end: Date;
}

interface UseDragAndResizeReturn {
  dragging: DragState | null;
  dragPreview: DragPreview | null;
  justDropped: string | null;
  isDraggingAny: boolean;
  handleDragStart: (e: React.MouseEvent, task: Task, type: DragState['type']) => void;
  getDragStyles: (taskId: string) => React.CSSProperties;
  getDragClasses: (taskId: string) => string;
}
```

**Hook responsibilities:**
- Manage drag state lifecycle
- Calculate preview positions with snapping
- Handle mouse events with proper cleanup
- Provide animation states and classes
- Support boundary constraints

### Part 2: Enhanced Animation Keyframes

Add new keyframes to `tailwind.config.ts`:

```typescript
keyframes: {
  // Lift effect when starting to drag
  "drag-lift": {
    "0%": { transform: "translateY(-50%) scale(1)", boxShadow: "0 4px 12px rgba(0,0,0,0.1)" },
    "100%": { transform: "translateY(-50%) scale(1.02)", boxShadow: "0 12px 32px rgba(0,0,0,0.25)" }
  },
  
  // Drop settle with bounce
  "drop-settle": {
    "0%": { transform: "translateY(-50%) scale(1.02)" },
    "30%": { transform: "translateY(-50%) scale(0.98)" },
    "60%": { transform: "translateY(-50%) scale(1.01)" },
    "100%": { transform: "translateY(-50%) scale(1)" }
  },
  
  // Rubber band for resize boundaries
  "rubber-band": {
    "0%": { transform: "scaleX(1)" },
    "30%": { transform: "scaleX(1.05)" },
    "50%": { transform: "scaleX(0.97)" },
    "70%": { transform: "scaleX(1.02)" },
    "100%": { transform: "scaleX(1)" }
  },
  
  // Duration tooltip pop
  "tooltip-pop": {
    "0%": { transform: "translateX(-50%) scale(0.8)", opacity: "0" },
    "50%": { transform: "translateX(-50%) scale(1.05)", opacity: "1" },
    "100%": { transform: "translateX(-50%) scale(1)", opacity: "1" }
  },
  
  // Resize handle pulse
  "resize-pulse": {
    "0%, 100%": { transform: "scaleY(1)", opacity: "0.6" },
    "50%": { transform: "scaleY(1.2)", opacity: "1" }
  }
}
```

### Part 3: Visual Feedback Components

Add CSS classes to `src/index.css`:

```css
/* Drag cursor states */
.gantt-dragging-move {
  cursor: grabbing !important;
}

.gantt-dragging-resize {
  cursor: ew-resize !important;
}

/* Task bar drag states */
.gantt-task-dragging {
  z-index: 50;
  filter: brightness(1.1);
  transform-origin: center;
}

/* Ghost shadow behind dragged element */
.gantt-task-ghost {
  position: absolute;
  opacity: 0.3;
  pointer-events: none;
  filter: blur(1px);
}

/* Resize handle hover effect */
.gantt-resize-handle {
  transition: all 0.15s ease-out;
}

.gantt-resize-handle:hover {
  background: rgba(255, 255, 255, 0.3);
  transform: scaleY(1.1);
}

.gantt-resize-handle:active {
  background: rgba(255, 255, 255, 0.4);
}

/* Duration change indicator */
.gantt-duration-indicator {
  animation: tooltip-pop 0.2s ease-out forwards;
}

/* Snap line indicator */
.gantt-snap-line {
  position: absolute;
  width: 2px;
  background: hsl(var(--primary));
  opacity: 0;
  transition: opacity 0.15s ease-out;
}

.gantt-snap-line.active {
  opacity: 0.6;
}
```

### Part 4: Refactor GanttChart Component

**Step 4.1: Import the custom hook**
```typescript
import { useDragAndResize } from '@/hooks/useDragAndResize';
```

**Step 4.2: Replace inline drag state with hook**
Remove lines 114-123 (dragging, dragPreview, justDropped states) and replace with hook call.

**Step 4.3: Replace drag handlers**
Remove lines 715-798 (handleDragStart, handleDragMove, handleDragEnd, and useState effect).

**Step 4.4: Update task bar rendering**
Modify task bar divs to use hook-provided classes and styles:

```tsx
<div
  className={cn(
    "absolute top-1/2 -translate-y-1/2 h-7 rounded-md",
    getDragClasses(task.id),
    !readOnly && "cursor-grab hover:cursor-grab"
  )}
  style={{
    ...baseStyles,
    ...getDragStyles(task.id)
  }}
  onMouseDown={readOnly ? undefined : (e) => handleDragStart(e, task, 'move')}
>
  {/* Resize handles with new classes */}
  {!readOnly && (
    <>
      <div className="gantt-resize-handle absolute left-0 top-0 bottom-0 w-2 cursor-ew-resize rounded-l-md" />
      <div className="gantt-resize-handle absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize rounded-r-md" />
    </>
  )}
</div>
```

**Step 4.5: Add body cursor class during drag**
Apply cursor class to container during drag:

```tsx
<div 
  ref={rightBodyRef}
  className={cn(
    "flex-1 overflow-auto relative",
    isDraggingAny && dragging?.type === 'move' && "gantt-dragging-move",
    isDraggingAny && dragging?.type?.startsWith('resize') && "gantt-dragging-resize"
  )}
>
```

### Part 5: Enhanced Duration Indicator

Update the duration change tooltip with new animation:

```tsx
{durationChanged && (
  <div className="gantt-duration-indicator absolute -top-12 left-1/2 bg-card text-foreground px-4 py-2 rounded-xl shadow-2xl text-sm font-semibold whitespace-nowrap z-50 border border-border">
    <div className="flex items-center gap-3">
      <span className="text-muted-foreground line-through opacity-70 text-xs">{originalDuration}d</span>
      <ChevronRight className="w-3 h-3 text-muted-foreground" />
      <span className={cn(
        "font-bold text-base",
        currentDuration! > originalDuration! ? "text-success" : "text-amber-500"
      )}>
        {currentDuration}d
      </span>
      <Badge variant="outline" className={cn(
        "text-[10px] px-1.5",
        currentDuration! > originalDuration! ? "border-success text-success" : "border-amber-500 text-amber-500"
      )}>
        {currentDuration! > originalDuration! ? '+' : ''}{currentDuration! - originalDuration!}
      </Badge>
    </div>
    {/* Tooltip arrow */}
    <div className="absolute top-full left-1/2 -translate-x-1/2 border-8 border-transparent border-t-card" />
  </div>
)}
```

### Part 6: Ghost Shadow Effect

Add a ghost element that stays at the original position while dragging:

```tsx
{isCurrentlyDragging && (
  <div
    className="gantt-task-ghost"
    style={{
      left: originalLeft + 2,
      width: originalWidth - 4,
      height: 28,
      top: '50%',
      transform: 'translateY(-50%)',
      background: `linear-gradient(135deg, ${sectionColor}40 0%, ${sectionColor}20 100%)`,
      borderRadius: '0.375rem',
    }}
  />
)}
```

---

## Implementation Order

1. **Create `src/hooks/useDragAndResize.ts`** - New custom hook file
2. **Update `tailwind.config.ts`** - Add new animation keyframes
3. **Update `src/index.css`** - Add new CSS classes for drag states
4. **Refactor `src/components/timeline/GanttChart.tsx`**:
   - Import and use the new hook
   - Remove old drag state and handlers
   - Update task bar rendering with new classes
   - Add ghost shadow effect
   - Enhance duration indicator

---

## Animation Summary

| Interaction | Animation | Duration |
|-------------|-----------|----------|
| Drag start | Lift + scale up + shadow increase | 150ms |
| Dragging | Smooth follow with slight scale | Continuous |
| Drag end (drop) | Bounce settle + shadow decrease | 400ms |
| Resize start | Handle pulse + cursor change | 150ms |
| Resizing | Smooth width change + duration pop | Continuous |
| Resize at boundary | Rubber band effect | 300ms |
| Duration change | Tooltip pop with badge | 200ms |

---

## Files to Create/Modify

### New Files
- `src/hooks/useDragAndResize.ts` - Custom hook for drag logic

### Modified Files
- `tailwind.config.ts` - New animation keyframes
- `src/index.css` - New CSS classes
- `src/components/timeline/GanttChart.tsx` - Refactored drag implementation

---

## Critical Files for Implementation

- `src/components/timeline/GanttChart.tsx` - Main component to refactor (lines 114-123, 715-798, 1433-1530, 1611-1664, 1733-1820)
- `src/hooks/useDragAndResize.ts` - New custom hook to create
- `tailwind.config.ts` - Animation keyframes configuration
- `src/index.css` - CSS utility classes for visual feedback
