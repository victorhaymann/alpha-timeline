

# Align Tabs and Action Buttons on One Row

## The Problem

The screenshot shows the TabsList (Timeline, Resources, Client Documents, Rights) and the action buttons (Regenerate Schedule, Undo, Shift Timeline) on **separate rows**. Currently:

- **Row 1** (in `ProjectDetail.tsx` line 609): TabsList + Regenerate Schedule button — these are in a `flex justify-between` wrapper.
- **Row 2** (in `TimelineEditor.tsx` lines 1212-1224): Undo + Shift Timeline — rendered inside the `TimelineEditor` component as a separate `div`.

The user wants all CTAs on the **same horizontal line** as the tabs.

## The Fix

### File: `src/components/timeline/TimelineEditor.tsx`

**Expose Undo and Shift Timeline handlers** via a new render prop (similar to how `renderRegenerateButton` works), so `ProjectDetail.tsx` can render them in the tabs row.

Add a new optional prop:
```typescript
renderActionButtons?: (props: {
  onUndo: () => void;
  undoDisabled: boolean;
  isUndoing: boolean;
  undoCount: number;
  onShiftTimeline: () => void;
}) => React.ReactNode;
```

When `renderActionButtons` is provided, skip rendering the Undo + Shift Timeline block inside `TimelineEditor` (lines 1212-1224). The caller renders them instead.

### File: `src/pages/ProjectDetail.tsx`

Move the Undo, Shift Timeline, and Regenerate Schedule buttons **into the same `flex justify-between` row** as the TabsList (line 609). Use the new `renderActionButtons` prop to capture the handlers, similar to the existing `regenerateHandler` pattern.

The row becomes:
```
[ TabsList ]                        [ Undo ] [ Shift Timeline ] [ Regenerate Schedule ]
```

All on one line via `flex items-center justify-between`.

## Technical Details

### `TimelineEditor.tsx` changes (lines 49-53, 1210-1227)

1. Add `renderActionButtons` to the props interface.
2. In the return block (line 1212), when `renderActionButtons` is provided, call it instead of rendering the buttons inline — and return `null` so nothing renders above the GanttChart.
3. Also call `renderActionButtons` similarly to `renderRegenerateButton` — store handlers via a `setTimeout` pattern on first render so `ProjectDetail` can use them.

### `ProjectDetail.tsx` changes (lines 608-641)

1. Add state for action handlers: `const [actionHandlers, setActionHandlers] = useState(...)`.
2. Pass `renderActionButtons` prop to `TimelineEditor` that captures the handlers.
3. In the tabs header row (line 609), render all three buttons in a single `div` with `flex items-center gap-2` on the right side, combining the existing Regenerate Schedule button with the new Undo and Shift Timeline buttons.

| File | Change |
|------|--------|
| `src/components/timeline/TimelineEditor.tsx` | Add `renderActionButtons` prop. Skip inline rendering when prop is provided. |
| `src/pages/ProjectDetail.tsx` | Capture action handlers. Render all buttons in the tabs header row. |

