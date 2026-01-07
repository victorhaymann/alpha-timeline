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
  getDynamicTooltipInfo: () => { type: 'move' | 'resize-start' | 'resize-end'; start: Date; end: Date; originalStart: Date; originalEnd: Date } | null;
}

export function useDragAndResize({
  columnWidth,
  onTaskUpdate,
  readOnly = false,
}: UseDragAndResizeOptions): UseDragAndResizeReturn {
  const [dragging, setDragging] = useState<DragState | null>(null);
  const [dragPreview, setDragPreview] = useState<DragPreview | null>(null);
  const [justDropped, setJustDropped] = useState<string | null>(null);
  const animationFrameRef = useRef<number | null>(null);

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
    const originalDuration = differenceInDays(endDate, startDate) + 1;

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
  }, [readOnly]);

  // Handle drag move with animation frame for performance
  const handleDragMove = useCallback((e: MouseEvent) => {
    if (!dragging) return;

    // Cancel previous animation frame
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }

    animationFrameRef.current = requestAnimationFrame(() => {
      const deltaX = e.clientX - dragging.startX;
      const deltaDays = Math.round(deltaX / columnWidth);

      if (dragging.type === 'move') {
        setDragPreview({
          start: addDays(dragging.originalStart, deltaDays),
          end: addDays(dragging.originalEnd, deltaDays),
        });
      } else if (dragging.type === 'resize-end') {
        const newEnd = addDays(dragging.originalEnd, deltaDays);
        if (newEnd >= dragging.originalStart) {
          setDragPreview({
            start: dragging.originalStart,
            end: newEnd,
          });
        }
      } else if (dragging.type === 'resize-start') {
        const newStart = addDays(dragging.originalStart, deltaDays);
        if (newStart <= dragging.originalEnd) {
          setDragPreview({
            start: newStart,
            end: dragging.originalEnd,
          });
        }
      }
    });
  }, [dragging, columnWidth]);

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
    const current = differenceInDays(dragPreview.end, dragPreview.start) + 1;
    const delta = current - original;
    
    return { original, current, delta };
  }, [dragging, dragPreview]);

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
