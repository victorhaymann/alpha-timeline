import { useState, useCallback, useEffect, useRef } from 'react';
import { addDays, differenceInDays, format } from 'date-fns';
import { Task, TaskSegment } from '@/types/database';

export interface DragState {
  taskId: string;
  segmentId?: string; // Optional: for segment-level drag
  type: 'move' | 'resize-start' | 'resize-end';
  startX: number;
  originalStart: Date;
  originalEnd: Date;
  originalDuration: number;
}

export interface DragPreview {
  taskId?: string;
  segmentId?: string;
  start: Date;
  end: Date;
}

interface UseDragAndResizeOptions {
  columnWidth: number;
  onTaskUpdate: (taskId: string, updates: Partial<Task>) => void;
  onSegmentUpdate?: (segmentId: string, updates: Partial<TaskSegment>, taskId: string) => void;
  readOnly?: boolean;
  /**
   * Optional working-day predicate. When provided, dragging/resizing will ignore weekends
   * (or any non-working days) and durations will be calculated in working days.
   */
  isWorkingDay?: (date: Date) => boolean;
  /**
   * When true, each column represents a week group (Project view). We'll shift by weeks
   * and then snap to a working day.
   */
  columnsAreWeeks?: boolean;
}

interface UseDragAndResizeReturn {
  dragging: DragState | null;
  dragPreview: DragPreview | null;
  justDropped: string | null;
  isDraggingAny: boolean;
  handleDragStart: (e: React.MouseEvent, task: Task, type: DragState['type'], segment?: TaskSegment) => void;
  getDragStyles: (taskId: string, segmentId?: string) => React.CSSProperties;
  getDragClasses: (taskId: string, segmentId?: string) => string;
  getResizeHandleClasses: (position: 'start' | 'end') => string;
  getDurationChange: () => { original: number; current: number; delta: number } | null;
  getGhostPosition: () => { start: Date; end: Date; segmentId?: string } | null;
  getDynamicTooltipInfo: () => {
    type: 'move' | 'resize-start' | 'resize-end';
    start: Date;
    end: Date;
    originalStart: Date;
    originalEnd: Date;
    segmentId?: string;
  } | null;
  getSegmentDragPreview: (segmentId: string) => DragPreview | null;
}

export function useDragAndResize({
  columnWidth,
  onTaskUpdate,
  onSegmentUpdate,
  readOnly = false,
  isWorkingDay,
  columnsAreWeeks = false,
}: UseDragAndResizeOptions): UseDragAndResizeReturn {
  const [dragging, setDragging] = useState<DragState | null>(null);
  const [pendingDrag, setPendingDrag] = useState<{
    task: Task;
    segment?: TaskSegment;
    type: DragState['type'];
    startX: number;
    startY: number;
    originalStart: Date;
    originalEnd: Date;
    originalDuration: number;
  } | null>(null);
  const [dragPreview, setDragPreview] = useState<DragPreview | null>(null);
  const [justDropped, setJustDropped] = useState<string | null>(null); // Can be taskId or segmentId
  const animationFrameRef = useRef<number | null>(null);

  const snapToWorkingDay = useCallback(
    (date: Date, direction: -1 | 1): Date => {
      if (!isWorkingDay) return date;
      let d = date;
      // Avoid infinite loops: cap at 14 iterations (2 weeks)
      for (let i = 0; i < 14; i++) {
        if (isWorkingDay(d)) return d;
        d = addDays(d, direction);
      }
      return d;
    },
    [isWorkingDay]
  );

  const addWorkingDays = useCallback(
    (date: Date, deltaWorkingDays: number): Date => {
      if (!isWorkingDay || deltaWorkingDays === 0) return addDays(date, deltaWorkingDays);
      const direction: -1 | 1 = deltaWorkingDays < 0 ? -1 : 1;
      let remaining = Math.abs(deltaWorkingDays);
      let d = date;

      while (remaining > 0) {
        d = addDays(d, direction);
        if (isWorkingDay(d)) remaining--;
      }

      return d;
    },
    [isWorkingDay]
  );

  const shiftDateByColumns = useCallback(
    (date: Date, deltaColumns: number): Date => {
      if (deltaColumns === 0) return date;

      if (columnsAreWeeks) {
        const direction: -1 | 1 = deltaColumns < 0 ? -1 : 1;
        const shifted = addDays(date, deltaColumns * 7);
        return snapToWorkingDay(shifted, direction);
      }

      // Day-based views: each column == 1 working day
      return addWorkingDays(date, deltaColumns);
    },
    [addWorkingDays, columnsAreWeeks, snapToWorkingDay]
  );

  const countDurationDays = useCallback(
    (start: Date, end: Date): number => {
      if (!isWorkingDay) return differenceInDays(end, start) + 1;
      let count = 0;
      let d = start;
      while (d <= end) {
        if (isWorkingDay(d)) count++;
        d = addDays(d, 1);
      }
      return Math.max(1, count);
    },
    [isWorkingDay]
  );

  // Handle drag start with automatic edge detection
  // - resize-start / resize-end: start immediately
  // - move: wait for a small movement threshold so clicks can be used for menus
  // - segment: optional TaskSegment for segment-level dragging
  const handleDragStart = useCallback(
    (e: React.MouseEvent, task: Task, type: DragState['type'], segment?: TaskSegment) => {
      if (readOnly) return;
      
      // Use segment dates if provided, otherwise use task dates
      const startDateStr = segment?.start_date || task.start_date;
      const endDateStr = segment?.end_date || task.end_date;
      if (!startDateStr || !endDateStr) return;

      // Auto-detect resize intent based on click position relative to task bar edges
      const EDGE_THRESHOLD = 12; // pixels from edge to trigger resize
      const taskBarElement = (e.target as HTMLElement).closest('.gantt-task-bar-base, .gantt-segment-bar');

      if (taskBarElement && type === 'move') {
        const rect = taskBarElement.getBoundingClientRect();
        const clickX = e.clientX - rect.left;

        if (clickX <= EDGE_THRESHOLD) {
          type = 'resize-start';
        } else if (clickX >= rect.width - EDGE_THRESHOLD) {
          type = 'resize-end';
        }
      }

      const startDate = new Date(startDateStr);
      const endDate = new Date(endDateStr);
      const originalDuration = countDurationDays(startDate, endDate);

      // Resizes should behave exactly as before (immediate drag start)
      if (type !== 'move') {
        e.preventDefault();
        e.stopPropagation();

        document.body.classList.add('gantt-dragging-resize');

        setDragging({
          taskId: task.id,
          segmentId: segment?.id,
          type,
          startX: e.clientX,
          originalStart: startDate,
          originalEnd: endDate,
          originalDuration,
        });
        setDragPreview({ 
          taskId: task.id,
          segmentId: segment?.id,
          start: startDate, 
          end: endDate 
        });
        return;
      }

      // Move: arm a pending drag, but do NOT preventDefault so a click can still open menus
      setPendingDrag({
        task,
        segment,
        type,
        startX: e.clientX,
        startY: e.clientY,
        originalStart: startDate,
        originalEnd: endDate,
        originalDuration,
      });
    },
    [readOnly, countDurationDays]
  );

  // If the user moves enough after mousedown, convert pendingDrag -> dragging.
  // If they release without moving, it's treated as a click.
  useEffect(() => {
    if (!pendingDrag) return;

    const MOVE_THRESHOLD = 5; // px

    const onMove = (e: MouseEvent) => {
      if (!pendingDrag) return;
      if (dragging) return;

      const dx = Math.abs(e.clientX - pendingDrag.startX);
      const dy = Math.abs(e.clientY - pendingDrag.startY);
      if (dx < MOVE_THRESHOLD && dy < MOVE_THRESHOLD) return;

      // Start the real drag
      e.preventDefault();

      document.body.classList.add('gantt-dragging-move');
      setDragging({
        taskId: pendingDrag.task.id,
        segmentId: pendingDrag.segment?.id,
        type: 'move',
        startX: pendingDrag.startX,
        originalStart: pendingDrag.originalStart,
        originalEnd: pendingDrag.originalEnd,
        originalDuration: pendingDrag.originalDuration,
      });
      setDragPreview({ 
        taskId: pendingDrag.task.id,
        segmentId: pendingDrag.segment?.id,
        start: pendingDrag.originalStart, 
        end: pendingDrag.originalEnd 
      });
      setPendingDrag(null);
    };

    const onUp = () => {
      // Click (no movement) ends here
      setPendingDrag(null);
    };

    window.addEventListener('mousemove', onMove, { passive: false });
    window.addEventListener('mouseup', onUp);

    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [pendingDrag, dragging]);

  // Handle drag move with animation frame for performance
  const handleDragMove = useCallback(
    (e: MouseEvent) => {
      if (!dragging) return;

      // Cancel previous animation frame
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }

      animationFrameRef.current = requestAnimationFrame(() => {
        const deltaX = e.clientX - dragging.startX;
        const deltaColumns = Math.round(deltaX / columnWidth);

        if (dragging.type === 'move') {
          setDragPreview({
            taskId: dragging.taskId,
            segmentId: dragging.segmentId,
            start: shiftDateByColumns(dragging.originalStart, deltaColumns),
            end: shiftDateByColumns(dragging.originalEnd, deltaColumns),
          });
        } else if (dragging.type === 'resize-end') {
          const newEnd = shiftDateByColumns(dragging.originalEnd, deltaColumns);
          if (newEnd >= dragging.originalStart) {
            setDragPreview({
              taskId: dragging.taskId,
              segmentId: dragging.segmentId,
              start: dragging.originalStart,
              end: newEnd,
            });
          }
        } else if (dragging.type === 'resize-start') {
          const newStart = shiftDateByColumns(dragging.originalStart, deltaColumns);
          if (newStart <= dragging.originalEnd) {
            setDragPreview({
              taskId: dragging.taskId,
              segmentId: dragging.segmentId,
              start: newStart,
              end: dragging.originalEnd,
            });
          }
        }
      });
    },
    [dragging, columnWidth, shiftDateByColumns]
  );

  // Handle drag end
  const handleDragEnd = useCallback(() => {
    // Remove cursor classes from body
    document.body.classList.remove('gantt-dragging-move', 'gantt-dragging-resize');

    if (dragging && dragPreview) {
      // Trigger drop settle animation - use segmentId if available, otherwise taskId
      const dropId = dragging.segmentId || dragging.taskId;
      setJustDropped(dropId);
      setTimeout(() => setJustDropped(null), 500);

      // Only update if position changed
      const startChanged =
        format(dragPreview.start, 'yyyy-MM-dd') !== format(dragging.originalStart, 'yyyy-MM-dd');
      const endChanged =
        format(dragPreview.end, 'yyyy-MM-dd') !== format(dragging.originalEnd, 'yyyy-MM-dd');

      if (startChanged || endChanged) {
        // If dragging a segment, update segment; otherwise update task
        if (dragging.segmentId && onSegmentUpdate) {
          onSegmentUpdate(dragging.segmentId, {
            start_date: format(dragPreview.start, 'yyyy-MM-dd'),
            end_date: format(dragPreview.end, 'yyyy-MM-dd'),
          }, dragging.taskId);
        } else {
          onTaskUpdate(dragging.taskId, {
            start_date: format(dragPreview.start, 'yyyy-MM-dd'),
            end_date: format(dragPreview.end, 'yyyy-MM-dd'),
          });
        }
      }
    }

    setDragging(null);
    setDragPreview(null);
  }, [dragging, dragPreview, onTaskUpdate, onSegmentUpdate]);

  // Attach global mouse listeners when dragging
  useEffect(() => {
    if (dragging) {
      window.addEventListener('mousemove', handleDragMove);
      window.addEventListener('mouseup', handleDragEnd);

      return () => {
        window.removeEventListener('mousemove', handleDragMove);
        window.removeEventListener('mouseup', handleDragEnd);
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
        }
      };
    }
  }, [dragging, handleDragMove, handleDragEnd]);


  // Get animation styles for a task or segment
  const getDragStyles = useCallback((taskId: string, segmentId?: string): React.CSSProperties => {
    const isBeingDragged = segmentId 
      ? dragging?.segmentId === segmentId 
      : (dragging?.taskId === taskId && !dragging?.segmentId);
    const wasJustDropped = segmentId 
      ? justDropped === segmentId 
      : justDropped === taskId;

    if (isBeingDragged) {
      return {
        zIndex: 100,
        transition: 'none',
      };
    }

    if (wasJustDropped) {
      return {
        zIndex: 50,
        // Smooth magnetic settle transition
        transition: 'transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.35s ease-out',
      };
    }

    // Default smooth transition for non-dragged items
    return {
      transition: 'transform 0.15s ease-out, box-shadow 0.15s ease-out',
    };
  }, [dragging, justDropped]);

  // Get ghost element position (original position during drag)
  const getGhostPosition = useCallback(() => {
    if (!dragging) return null;
    return {
      start: dragging.originalStart,
      end: dragging.originalEnd,
      segmentId: dragging.segmentId,
    };
  }, [dragging]);

  // Get dynamic tooltip information during drag
  const getDynamicTooltipInfo = useCallback(() => {
    if (!dragging || !dragPreview) return null;
    return {
      type: dragging.type,
      start: dragPreview.start,
      end: dragPreview.end,
      originalStart: dragging.originalStart,
      originalEnd: dragging.originalEnd,
      segmentId: dragging.segmentId,
    };
  }, [dragging, dragPreview]);

  // Get animation classes for a task or segment
  const getDragClasses = useCallback((taskId: string, segmentId?: string): string => {
    const isBeingDragged = segmentId 
      ? dragging?.segmentId === segmentId 
      : (dragging?.taskId === taskId && !dragging?.segmentId);
    const wasJustDropped = segmentId 
      ? justDropped === segmentId 
      : justDropped === taskId;
    const classes: string[] = [];

    if (isBeingDragged) {
      classes.push('gantt-task-dragging');
      if (dragging?.type === 'move') {
        classes.push('animate-drag-lift');
      }
    }

    if (wasJustDropped) {
      classes.push('animate-drop-settle');
    }

    return classes.join(' ');
  }, [dragging, justDropped]);

  // Get resize handle classes
  const getResizeHandleClasses = useCallback((position: 'start' | 'end'): string => {
    const isResizing = dragging?.type === `resize-${position}`;
    const classes = ['gantt-resize-handle', `gantt-resize-handle-${position}`];
    
    if (isResizing) {
      classes.push('gantt-resize-handle-active');
    }
    
    return classes.join(' ');
  }, [dragging]);

  // Get duration change info for tooltip
  const getDurationChange = useCallback(() => {
    if (!dragging || !dragPreview) return null;

    const original = dragging.originalDuration;
    const current = countDurationDays(dragPreview.start, dragPreview.end);
    const delta = current - original;

    return { original, current, delta };
  }, [dragging, dragPreview, countDurationDays]);

  // Get segment drag preview for a specific segment
  const getSegmentDragPreview = useCallback((segmentId: string): DragPreview | null => {
    if (!dragPreview || dragPreview.segmentId !== segmentId) return null;
    return dragPreview;
  }, [dragPreview]);

  return {
    dragging,
    dragPreview,
    justDropped,
    isDraggingAny: !!dragging,
    handleDragStart,
    getDragStyles,
    getDragClasses,
    getResizeHandleClasses,
    getDurationChange,
    getGhostPosition,
    getDynamicTooltipInfo,
    getSegmentDragPreview,
  };
}
