import { useState, useCallback, useEffect, useRef } from 'react';
import { addDays, differenceInDays, format } from 'date-fns';
import { Task, TaskSegment } from '@/types/database';
import { clampToProjectBounds } from '@/lib/dateValidation';

// ── Public types ──────────────────────────────────────────────────────────────

export interface DragResult {
  type:
    | 'task-move' | 'task-resize-start' | 'task-resize-end'
    | 'segment-move' | 'segment-resize-start' | 'segment-resize-end';
  taskId: string;
  segmentId?: string;
  newStart: string; // yyyy-MM-dd
  newEnd: string;   // yyyy-MM-dd
}

export interface DragState {
  taskId: string;
  segmentId?: string;
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

// ── Hook options ──────────────────────────────────────────────────────────────

interface UseDragAndResizeOptions {
  columnWidth: number;
  /** Single callback for all drag/resize completions */
  onDragComplete: (result: DragResult) => void;
  readOnly?: boolean;
  isWorkingDay?: (date: Date) => boolean;
  columnsAreWeeks?: boolean;
  projectStartDate?: Date;
  projectEndDate?: Date;
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

// ── Hook implementation ───────────────────────────────────────────────────────

export function useDragAndResize({
  columnWidth,
  onDragComplete,
  readOnly = false,
  isWorkingDay,
  columnsAreWeeks = false,
  projectStartDate,
  projectEndDate,
}: UseDragAndResizeOptions): UseDragAndResizeReturn {
  const [dragging, setDragging] = useState<DragState | null>(null);
  const [dragPreview, setDragPreview] = useState<DragPreview | null>(null);
  const [justDropped, setJustDropped] = useState<string | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  // Ref-based pending drag to avoid re-subscription issues (Problem 5 fix)
  const pendingDragRef = useRef<{
    task: Task;
    segment?: TaskSegment;
    type: DragState['type'];
    startX: number;
    startY: number;
    originalStart: Date;
    originalEnd: Date;
    originalDuration: number;
  } | null>(null);

  // ── Working-day utilities (unchanged) ─────────────────────────────────────

  const snapToWorkingDay = useCallback(
    (date: Date, direction: -1 | 1): Date => {
      if (!isWorkingDay) return date;
      let d = date;
      for (let i = 0; i < 14; i++) {
        if (isWorkingDay(d)) return d;
        d = addDays(d, direction);
      }
      return d;
    },
    [isWorkingDay]
  );

  const addWorkingDaysFn = useCallback(
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
      return addWorkingDaysFn(date, deltaColumns);
    },
    [addWorkingDaysFn, columnsAreWeeks, snapToWorkingDay]
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

  const clampToProject = useCallback(
    (date: Date): Date => {
      if (!projectStartDate || !projectEndDate) return date;
      return clampToProjectBounds(date, projectStartDate, projectEndDate);
    },
    [projectStartDate, projectEndDate]
  );

  // ── Drag start ────────────────────────────────────────────────────────────

  const handleDragStart = useCallback(
    (e: React.MouseEvent, task: Task, type: DragState['type'], segment?: TaskSegment) => {
      if (readOnly) return;

      const startDateStr = segment?.start_date || task.start_date;
      const endDateStr = segment?.end_date || task.end_date;
      if (!startDateStr || !endDateStr) return;

      // Auto-detect resize intent from click position (this IS the real mechanism;
      // CSS `pointer-events: none` on resize handle divs means they never receive events)
      const EDGE_THRESHOLD = 12;
      const barEl = (e.target as HTMLElement).closest('.gantt-task-bar-base, .gantt-segment-bar, .gantt-review-bar');
      if (barEl && type === 'move') {
        const rect = barEl.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        if (clickX <= EDGE_THRESHOLD) type = 'resize-start';
        else if (clickX >= rect.width - EDGE_THRESHOLD) type = 'resize-end';
      }

      const startDate = new Date(startDateStr);
      const endDate = new Date(endDateStr);
      const originalDuration = countDurationDays(startDate, endDate);

      // Resize: start immediately
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
          end: endDate,
        });
        return;
      }

      // Move: arm pending drag (ref-based to avoid re-subscription)
      pendingDragRef.current = {
        task,
        segment,
        type,
        startX: e.clientX,
        startY: e.clientY,
        originalStart: startDate,
        originalEnd: endDate,
        originalDuration,
      };
    },
    [readOnly, countDurationDays]
  );

  // ── Pending drag → real drag (ref-based, single effect) ───────────────────

  useEffect(() => {
    const MOVE_THRESHOLD = 5;

    const onMove = (e: MouseEvent) => {
      const pd = pendingDragRef.current;
      if (!pd) return;

      const dx = Math.abs(e.clientX - pd.startX);
      const dy = Math.abs(e.clientY - pd.startY);
      if (dx < MOVE_THRESHOLD && dy < MOVE_THRESHOLD) return;

      e.preventDefault();
      document.body.classList.add('gantt-dragging-move');

      setDragging({
        taskId: pd.task.id,
        segmentId: pd.segment?.id,
        type: 'move',
        startX: pd.startX,
        originalStart: pd.originalStart,
        originalEnd: pd.originalEnd,
        originalDuration: pd.originalDuration,
      });
      setDragPreview({
        taskId: pd.task.id,
        segmentId: pd.segment?.id,
        start: pd.originalStart,
        end: pd.originalEnd,
      });
      pendingDragRef.current = null;
    };

    const onUp = () => {
      pendingDragRef.current = null;
    };

    window.addEventListener('mousemove', onMove, { passive: false });
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, []); // Empty deps — uses ref, never re-subscribes

  // ── Drag move (requestAnimationFrame throttled) ───────────────────────────

  const handleDragMove = useCallback(
    (e: MouseEvent) => {
      if (!dragging) return;

      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);

      animationFrameRef.current = requestAnimationFrame(() => {
        const deltaX = e.clientX - dragging.startX;
        const deltaColumns = Math.round(deltaX / columnWidth);

        if (dragging.type === 'move') {
          let newStart = shiftDateByColumns(dragging.originalStart, deltaColumns);
          let newEnd = shiftDateByColumns(dragging.originalEnd, deltaColumns);
          newStart = clampToProject(newStart);
          newEnd = clampToProject(newEnd);
          setDragPreview({ taskId: dragging.taskId, segmentId: dragging.segmentId, start: newStart, end: newEnd });
        } else if (dragging.type === 'resize-end') {
          let newEnd = shiftDateByColumns(dragging.originalEnd, deltaColumns);
          newEnd = clampToProject(newEnd);
          if (newEnd >= dragging.originalStart) {
            setDragPreview({ taskId: dragging.taskId, segmentId: dragging.segmentId, start: dragging.originalStart, end: newEnd });
          }
        } else if (dragging.type === 'resize-start') {
          let newStart = shiftDateByColumns(dragging.originalStart, deltaColumns);
          newStart = clampToProject(newStart);
          if (newStart <= dragging.originalEnd) {
            setDragPreview({ taskId: dragging.taskId, segmentId: dragging.segmentId, start: newStart, end: dragging.originalEnd });
          }
        }
      });
    },
    [dragging, columnWidth, shiftDateByColumns, clampToProject]
  );

  // ── Drag end — build DragResult and call onDragComplete ───────────────────

  const handleDragEnd = useCallback(() => {
    document.body.classList.remove('gantt-dragging-move', 'gantt-dragging-resize');

    if (dragging && dragPreview) {
      const dropId = dragging.segmentId || dragging.taskId;
      setJustDropped(dropId);
      setTimeout(() => setJustDropped(null), 500);

      const startChanged = format(dragPreview.start, 'yyyy-MM-dd') !== format(dragging.originalStart, 'yyyy-MM-dd');
      const endChanged = format(dragPreview.end, 'yyyy-MM-dd') !== format(dragging.originalEnd, 'yyyy-MM-dd');

      if (startChanged || endChanged) {
        // Build a unified DragResult
        const isSegment = !!dragging.segmentId;
        const prefix = isSegment ? 'segment' : 'task';
        const resultType = `${prefix}-${dragging.type}` as DragResult['type'];

        onDragComplete({
          type: resultType,
          taskId: dragging.taskId,
          segmentId: dragging.segmentId,
          newStart: format(dragPreview.start, 'yyyy-MM-dd'),
          newEnd: format(dragPreview.end, 'yyyy-MM-dd'),
        });
      }
    }

    setDragging(null);
    setDragPreview(null);
  }, [dragging, dragPreview, onDragComplete]);

  // ── Global mouse listeners while dragging ─────────────────────────────────

  useEffect(() => {
    if (dragging) {
      window.addEventListener('mousemove', handleDragMove);
      window.addEventListener('mouseup', handleDragEnd);
      return () => {
        window.removeEventListener('mousemove', handleDragMove);
        window.removeEventListener('mouseup', handleDragEnd);
        if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      };
    }
  }, [dragging, handleDragMove, handleDragEnd]);

  // ── Style / class helpers (unchanged) ─────────────────────────────────────

  const getDragStyles = useCallback((taskId: string, segmentId?: string): React.CSSProperties => {
    const isBeingDragged = segmentId
      ? dragging?.segmentId === segmentId
      : (dragging?.taskId === taskId && !dragging?.segmentId);
    const wasJustDropped = segmentId ? justDropped === segmentId : justDropped === taskId;

    if (isBeingDragged) return { zIndex: 100, transition: 'none' };
    if (wasJustDropped) return { zIndex: 50, transition: 'transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.35s ease-out' };
    return { transition: 'transform 0.15s ease-out, box-shadow 0.15s ease-out' };
  }, [dragging, justDropped]);

  const getDragClasses = useCallback((taskId: string, segmentId?: string): string => {
    const isBeingDragged = segmentId
      ? dragging?.segmentId === segmentId
      : (dragging?.taskId === taskId && !dragging?.segmentId);
    const wasJustDropped = segmentId ? justDropped === segmentId : justDropped === taskId;
    const classes: string[] = [];
    if (isBeingDragged) {
      classes.push('gantt-task-dragging');
      if (dragging?.type === 'move') classes.push('animate-drag-lift');
    }
    if (wasJustDropped) classes.push('animate-drop-settle');
    return classes.join(' ');
  }, [dragging, justDropped]);

  const getResizeHandleClasses = useCallback((position: 'start' | 'end'): string => {
    const isResizing = dragging?.type === `resize-${position}`;
    const classes = ['gantt-resize-handle', `gantt-resize-handle-${position}`];
    if (isResizing) classes.push('gantt-resize-handle-active');
    return classes.join(' ');
  }, [dragging]);

  const getGhostPosition = useCallback(() => {
    if (!dragging) return null;
    return { start: dragging.originalStart, end: dragging.originalEnd, segmentId: dragging.segmentId };
  }, [dragging]);

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

  const getDurationChange = useCallback(() => {
    if (!dragging || !dragPreview) return null;
    const original = dragging.originalDuration;
    const current = countDurationDays(dragPreview.start, dragPreview.end);
    const delta = current - original;
    return { original, current, delta };
  }, [dragging, dragPreview, countDurationDays]);

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
