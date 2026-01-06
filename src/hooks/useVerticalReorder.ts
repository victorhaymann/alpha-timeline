import { useState, useCallback, useEffect, useRef } from 'react';

export interface VerticalDragState {
  taskId: string;
  phaseId: string;
  originalIndex: number;
  currentIndex: number;
  startY: number;
  rowHeight: number;
}

interface UseVerticalReorderOptions {
  rowHeight: number;
  onReorder: (phaseId: string, taskId: string, newIndex: number) => void;
  readOnly?: boolean;
}

interface UseVerticalReorderReturn {
  verticalDrag: VerticalDragState | null;
  isVerticalDragging: boolean;
  handleVerticalDragStart: (
    e: React.MouseEvent,
    taskId: string,
    phaseId: string,
    currentIndex: number
  ) => void;
  getVerticalDragClasses: (taskId: string) => string;
  getVerticalDragStyles: (taskId: string, actualIndex: number) => React.CSSProperties;
  getSwapTargetClasses: (taskId: string, actualIndex: number) => string;
  getDropIndicatorIndex: () => number | null;
}

export function useVerticalReorder({
  rowHeight,
  onReorder,
  readOnly = false,
}: UseVerticalReorderOptions): UseVerticalReorderReturn {
  const [verticalDrag, setVerticalDrag] = useState<VerticalDragState | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  const handleVerticalDragStart = useCallback((
    e: React.MouseEvent,
    taskId: string,
    phaseId: string,
    currentIndex: number
  ) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (readOnly) return;

    document.body.classList.add('gantt-dragging-vertical');

    setVerticalDrag({
      taskId,
      phaseId,
      originalIndex: currentIndex,
      currentIndex,
      startY: e.clientY,
      rowHeight,
    });
  }, [readOnly, rowHeight]);

  const handleVerticalDragMove = useCallback((e: MouseEvent) => {
    if (!verticalDrag) return;

    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }

    animationFrameRef.current = requestAnimationFrame(() => {
      const deltaY = e.clientY - verticalDrag.startY;
      const indexDelta = Math.round(deltaY / verticalDrag.rowHeight);
      const newIndex = Math.max(0, verticalDrag.originalIndex + indexDelta);

      if (newIndex !== verticalDrag.currentIndex) {
        setVerticalDrag(prev => prev ? { ...prev, currentIndex: newIndex } : null);
      }
    });
  }, [verticalDrag]);

  const handleVerticalDragEnd = useCallback(() => {
    document.body.classList.remove('gantt-dragging-vertical');

    if (verticalDrag && verticalDrag.currentIndex !== verticalDrag.originalIndex) {
      onReorder(verticalDrag.phaseId, verticalDrag.taskId, verticalDrag.currentIndex);
    }

    setVerticalDrag(null);
  }, [verticalDrag, onReorder]);

  useEffect(() => {
    if (verticalDrag) {
      window.addEventListener('mousemove', handleVerticalDragMove);
      window.addEventListener('mouseup', handleVerticalDragEnd);
      
      return () => {
        window.removeEventListener('mousemove', handleVerticalDragMove);
        window.removeEventListener('mouseup', handleVerticalDragEnd);
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
        }
      };
    }
  }, [verticalDrag, handleVerticalDragMove, handleVerticalDragEnd]);

  const getVerticalDragClasses = useCallback((taskId: string): string => {
    if (verticalDrag?.taskId === taskId) {
      return 'gantt-vertical-dragging z-50 shadow-lg';
    }
    return '';
  }, [verticalDrag]);

  const getVerticalDragStyles = useCallback((taskId: string, actualIndex: number): React.CSSProperties => {
    if (!verticalDrag) return {};
    
    if (verticalDrag.taskId === taskId) {
      // The dragged item follows the cursor
      const deltaY = (verticalDrag.currentIndex - verticalDrag.originalIndex) * rowHeight;
      return {
        transform: `translateY(${deltaY}px)`,
        transition: 'none',
        zIndex: 100,
        position: 'relative',
      };
    }
    
    // SWAP-ONLY: Only the item at the current drop position swaps
    const draggedOriginalIndex = verticalDrag.originalIndex;
    const draggedCurrentIndex = verticalDrag.currentIndex;
    
    // Only affect the single item being swapped with
    if (actualIndex === draggedCurrentIndex && draggedCurrentIndex !== draggedOriginalIndex) {
      // This item moves to where the dragged item started
      const distance = (draggedOriginalIndex - draggedCurrentIndex) * rowHeight;
      return {
        transform: `translateY(${distance}px)`,
        transition: 'transform 200ms cubic-bezier(0.2, 0, 0, 1)',
      };
    }
    
    return {
      transition: 'transform 200ms cubic-bezier(0.2, 0, 0, 1)',
    };
  }, [verticalDrag, rowHeight]);

  const getSwapTargetClasses = useCallback((taskId: string, actualIndex: number): string => {
    if (!verticalDrag) return '';
    
    // Highlight the item that will be swapped (not the dragged item itself)
    if (actualIndex === verticalDrag.currentIndex && 
        verticalDrag.currentIndex !== verticalDrag.originalIndex &&
        verticalDrag.taskId !== taskId) {
      return 'gantt-swap-target';
    }
    return '';
  }, [verticalDrag]);

  const getDropIndicatorIndex = useCallback((): number | null => {
    if (!verticalDrag) return null;
    return verticalDrag.currentIndex;
  }, [verticalDrag]);

  return {
    verticalDrag,
    isVerticalDragging: !!verticalDrag,
    handleVerticalDragStart,
    getVerticalDragClasses,
    getVerticalDragStyles,
    getSwapTargetClasses,
    getDropIndicatorIndex,
  };
}
