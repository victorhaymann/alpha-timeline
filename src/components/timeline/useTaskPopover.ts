import { useState, useRef, useCallback } from 'react';

interface UseTaskPopoverOptions {
  readOnly: boolean;
  isDraggingAny: boolean;
}

interface UseTaskPopoverReturn {
  openTaskMenuId: string | null;
  hoveredSegmentId: string | null;
  taskMenuPos: { x: number; y: number } | null;
  setOpenTaskMenuId: React.Dispatch<React.SetStateAction<string | null>>;
  setHoveredSegmentId: React.Dispatch<React.SetStateAction<string | null>>;
  handleTaskBarMouseEnter: (e: React.MouseEvent, taskId: string, segmentId?: string) => void;
  handleTaskBarMouseLeave: (taskId: string) => void;
  handlePopoverMouseEnter: () => void;
  handlePopoverMouseLeave: (taskId: string) => void;
  handleMenuButtonClick: (e: React.MouseEvent, taskId: string, segmentId?: string) => void;
  closeMenu: () => void;
}

export function useTaskPopover({ readOnly, isDraggingAny }: UseTaskPopoverOptions): UseTaskPopoverReturn {
  const [openTaskMenuId, setOpenTaskMenuId] = useState<string | null>(null);
  const [hoveredSegmentId, setHoveredSegmentId] = useState<string | null>(null);
  const [taskMenuPos, setTaskMenuPos] = useState<{ x: number; y: number } | null>(null);
  const closeTaskMenuTimeoutRef = useRef<number | null>(null);

  const clearCloseTimeout = useCallback(() => {
    if (closeTaskMenuTimeoutRef.current) {
      window.clearTimeout(closeTaskMenuTimeoutRef.current);
      closeTaskMenuTimeoutRef.current = null;
    }
  }, []);

  const scheduleClose = useCallback((taskId: string) => {
    clearCloseTimeout();
    closeTaskMenuTimeoutRef.current = window.setTimeout(() => {
      setOpenTaskMenuId((current) => (current === taskId ? null : current));
      setTaskMenuPos(null);
    }, 120);
  }, [clearCloseTimeout]);

  const handleTaskBarMouseEnter = useCallback((e: React.MouseEvent, taskId: string, segmentId?: string) => {
    if (readOnly || isDraggingAny) return;
    clearCloseTimeout();
    setTaskMenuPos({ x: e.clientX, y: e.clientY });
    setOpenTaskMenuId(taskId);
    if (segmentId) setHoveredSegmentId(segmentId);
  }, [readOnly, isDraggingAny, clearCloseTimeout]);

  const handleTaskBarMouseLeave = useCallback((taskId: string) => {
    if (readOnly) return;
    scheduleClose(taskId);
  }, [readOnly, scheduleClose]);

  const handlePopoverMouseEnter = useCallback(() => {
    clearCloseTimeout();
  }, [clearCloseTimeout]);

  const handlePopoverMouseLeave = useCallback((taskId: string) => {
    scheduleClose(taskId);
  }, [scheduleClose]);

  const handleMenuButtonClick = useCallback((e: React.MouseEvent, taskId: string, segmentId?: string) => {
    e.stopPropagation();
    setTaskMenuPos({ x: e.clientX, y: e.clientY });
    setOpenTaskMenuId(taskId);
    if (segmentId) setHoveredSegmentId(segmentId);
  }, []);

  const closeMenu = useCallback(() => {
    setOpenTaskMenuId(null);
    setTaskMenuPos(null);
    setHoveredSegmentId(null);
  }, []);

  return {
    openTaskMenuId,
    hoveredSegmentId,
    taskMenuPos,
    setOpenTaskMenuId,
    setHoveredSegmentId,
    handleTaskBarMouseEnter,
    handleTaskBarMouseLeave,
    handlePopoverMouseEnter,
    handlePopoverMouseLeave,
    handleMenuButtonClick,
    closeMenu,
  };
}
