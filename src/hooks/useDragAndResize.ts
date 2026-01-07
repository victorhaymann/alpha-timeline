import { useState, useCallback, useEffect, useRef } from 'react';
import { addDays, differenceInDays, format } from 'date-fns';
import { Task } from '@/types/database';

export interface DragState {
  taskId: string;
  type: 'move' | 'resize-start' | 'resize-end';
  startX: number;
  originalStart: Date;
  originalEnd: Date;
  originalDuration: number;
}

export interface DragPreview {
  start: Date;
  end: Date;
}

interface UseDragAndResizeOptions {
  columnWidth: number;
  onTaskUpdate: (taskId: string, updates: Partial<Task>) => void;
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
  handleDragStart: (e: React.MouseEvent, task: Task, type: DragState['type']) => void;
  getDragStyles: (taskId: string) => React.CSSProperties;
  getDragClasses: (taskId: string) => string;
  getResizeHandleClasses: (position: 'start' | 'end') => string;
  getDurationChange: () => { original: number; current: number; delta: number } | null;
  getGhostPosition: () => { start: Date; end: Date } | null;
  getDynamicTooltipInfo: () => {
    type: 'move' | 'resize-start' | 'resize-end';
    start: Date;
    end: Date;
    originalStart: Date;
    originalEnd: Date;
  } | null;
}

export function useDragAndResize({
  columnWidth,
  onTaskUpdate,
  readOnly = false,
  isWorkingDay,
  columnsAreWeeks = false,
}: UseDragAndResizeOptions): UseDragAndResizeReturn {
  const [dragging, setDragging] = useState<DragState | null>(null);
  const [dragPreview, setDragPreview] = useState<DragPreview | null>(null);
  const [justDropped, setJustDropped] = useState<string | null>(null);
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
  const handleDragStart = useCallback((
    e: React.MouseEvent,
    task: Task,
    type: DragState['type']
  ) => {
    e.preventDefault();
    e.stopPropagation();

    if (readOnly) return;
    if (!task.start_date || !task.end_date) return;

    // Auto-detect resize intent based on click position relative to task bar edges
    const EDGE_THRESHOLD = 12; // pixels from edge to trigger resize
    const taskBarElement = (e.target as HTMLElement).closest('.gantt-task-bar-base');

    if (taskBarElement && type === 'move') {
      const rect = taskBarElement.getBoundingClientRect();
      const clickX = e.clientX - rect.left;

      if (clickX <= EDGE_THRESHOLD) {
        type = 'resize-start';
      } else if (clickX >= rect.width - EDGE_THRESHOLD) {
        type = 'resize-end';
      }
    }

    const startDate = new Date(task.start_date);
    const endDate = new Date(task.end_date);
    const originalDuration = countDurationDays(startDate, endDate);

    // Add dragging class to body for cursor
    document.body.classList.add(type === 'move' ? 'gantt-dragging-move' : 'gantt-dragging-resize');

    setDragging({
      taskId: task.id,
      type,
      startX: e.clientX,
      originalStart: startDate,
      originalEnd: endDate,
      originalDuration,
    });
    setDragPreview({
      start: startDate,
      end: endDate,
    });
  }, [readOnly, countDurationDays]);

  // Handle drag move with animation frame for performance
  const handleDragMove = useCallback((e: MouseEvent) => {
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
          start: shiftDateByColumns(dragging.originalStart, deltaColumns),
          end: shiftDateByColumns(dragging.originalEnd, deltaColumns),
        });
      } else if (dragging.type === 'resize-end') {
        const newEnd = shiftDateByColumns(dragging.originalEnd, deltaColumns);
        if (newEnd >= dragging.originalStart) {
          setDragPreview({
            start: dragging.originalStart,
            end: newEnd,
          });
        }
      } else if (dragging.type === 'resize-start') {
        const newStart = shiftDateByColumns(dragging.originalStart, deltaColumns);
        if (newStart <= dragging.originalEnd) {
          setDragPreview({
            start: newStart,
            end: dragging.originalEnd,
          });
        }
      }
    });
  }, [dragging, columnWidth, shiftDateByColumns]);

  // Handle drag end
  const handleDragEnd = useCallback(() => {
    // Remove cursor classes from body
    document.body.classList.remove('gantt-dragging-move', 'gantt-dragging-resize');

    if (dragging && dragPreview) {
      // Trigger drop settle animation
      setJustDropped(dragging.taskId);
      setTimeout(() => setJustDropped(null), 500);

      // Only update if position changed
      const startChanged = format(dragPreview.start, 'yyyy-MM-dd') !== format(dragging.originalStart, 'yyyy-MM-dd');
      const endChanged = format(dragPreview.end, 'yyyy-MM-dd') !== format(dragging.originalEnd, 'yyyy-MM-dd');

      if (startChanged || endChanged) {
        onTaskUpdate(dragging.taskId, {
          start_date: format(dragPreview.start, 'yyyy-MM-dd'),
          end_date: format(dragPreview.end, 'yyyy-MM-dd'),
        });
      }
    }

    setDragging(null);
    setDragPreview(null);
  }, [dragging, dragPreview, onTaskUpdate]);

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

  // Get animation styles for a task
  const getDragStyles = useCallback((taskId: string): React.CSSProperties => {
    const isBeingDragged = dragging?.taskId === taskId;
    const wasJustDropped = justDropped === taskId;

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
    };
  }, [dragging, dragPreview]);

  // Get animation classes for a task
  const getDragClasses = useCallback((taskId: string): string => {
    const isBeingDragged = dragging?.taskId === taskId;
    const wasJustDropped = justDropped === taskId;
    const classes: string[] = [];

    if (isBeingDragged) {
      classes.push('gantt-task-dragging');
      if (dragging.type === 'move') {
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
  };
}
