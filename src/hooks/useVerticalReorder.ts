import { useState, useCallback, useEffect, useRef } from 'react';

export interface VerticalDragState {
  taskId: string;
  phaseId: string;
  targetPhaseId: string;
  originalIndex: number;
  currentIndex: number;
  startY: number;
  rowHeight: number;
}

interface UseVerticalReorderOptions {
  rowHeight: number;
  onReorder: (sourcePhaseId: string, targetPhaseId: string, taskId: string, newIndex: number) => void;
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
  handlePhaseHover: (phaseId: string, index: number) => void;
  getVerticalDragClasses: (taskId: string) => string;
  getVerticalDragStyles: (taskId: string, actualIndex: number, phaseId: string) => React.CSSProperties;
  getSwapTargetClasses: (taskId: string, actualIndex: number, phaseId: string) => string;
  getDropTargetPhaseClasses: (phaseId: string) => string;
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
      targetPhaseId: phaseId,
      originalIndex: currentIndex,
      currentIndex,
      startY: e.clientY,
      rowHeight,
    });
  }, [readOnly, rowHeight]);

  // Called when hovering over a different phase during drag
  const handlePhaseHover = useCallback((phaseId: string, index: number) => {
    if (!verticalDrag) return;
    
    setVerticalDrag(prev => prev ? {
      ...prev,
      targetPhaseId: phaseId,
      currentIndex: Math.max(0, index),
    } : null);
  }, [verticalDrag]);

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

    if (verticalDrag) {
      const isCrossPhase = verticalDrag.targetPhaseId !== verticalDrag.phaseId;
      const hasReordered = verticalDrag.currentIndex !== verticalDrag.originalIndex;
      
      if (isCrossPhase || hasReordered) {
        onReorder(verticalDrag.phaseId, verticalDrag.targetPhaseId, verticalDrag.taskId, verticalDrag.currentIndex);
      }
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

  const getVerticalDragStyles = useCallback((taskId: string, actualIndex: number, phaseId: string): React.CSSProperties => {
    if (!verticalDrag) return {};
    
    const isSamePhase = verticalDrag.phaseId === phaseId;
    const isTargetPhase = verticalDrag.targetPhaseId === phaseId;
    
    // The dragged item
    if (verticalDrag.taskId === taskId) {
      // If dragging to a different phase, just lift the item (visual feedback only)
      if (verticalDrag.targetPhaseId !== verticalDrag.phaseId) {
        return {
          opacity: 0.5,
          transition: 'opacity 200ms ease-out',
          zIndex: 100,
          position: 'relative',
        };
      }
      
      // Same phase - follow cursor position
      const deltaY = (verticalDrag.currentIndex - verticalDrag.originalIndex) * rowHeight;
      return {
        transform: `translateY(${deltaY}px)`,
        transition: 'none',
        zIndex: 100,
        position: 'relative',
      };
    }
    
    // For cross-phase: shift items in target phase to make room
    if (isTargetPhase && verticalDrag.targetPhaseId !== verticalDrag.phaseId) {
      // Items at or after the insertion point shift down
      if (actualIndex >= verticalDrag.currentIndex) {
        return {
          transform: `translateY(${rowHeight}px)`,
          transition: 'transform 200ms cubic-bezier(0.2, 0, 0, 1)',
        };
      }
      return {
        transition: 'transform 200ms cubic-bezier(0.2, 0, 0, 1)',
      };
    }
    
    // For same-phase reordering
    if (isSamePhase && verticalDrag.targetPhaseId === verticalDrag.phaseId) {
      const draggedOriginalIndex = verticalDrag.originalIndex;
      const draggedCurrentIndex = verticalDrag.currentIndex;
      
      if (draggedCurrentIndex > draggedOriginalIndex) {
        if (actualIndex > draggedOriginalIndex && actualIndex <= draggedCurrentIndex) {
          return {
            transform: `translateY(-${rowHeight}px)`,
            transition: 'transform 200ms cubic-bezier(0.2, 0, 0, 1)',
          };
        }
      } else if (draggedCurrentIndex < draggedOriginalIndex) {
        if (actualIndex >= draggedCurrentIndex && actualIndex < draggedOriginalIndex) {
          return {
            transform: `translateY(${rowHeight}px)`,
            transition: 'transform 200ms cubic-bezier(0.2, 0, 0, 1)',
          };
        }
      }
    }
    
    // Original phase - shift up to fill the gap when dragging to another phase
    if (isSamePhase && verticalDrag.targetPhaseId !== verticalDrag.phaseId) {
      if (actualIndex > verticalDrag.originalIndex) {
        return {
          transform: `translateY(-${rowHeight}px)`,
          transition: 'transform 200ms cubic-bezier(0.2, 0, 0, 1)',
        };
      }
    }
    
    return {
      transition: 'transform 200ms cubic-bezier(0.2, 0, 0, 1)',
    };
  }, [verticalDrag, rowHeight]);

  const getSwapTargetClasses = useCallback((taskId: string, actualIndex: number, phaseId: string): string => {
    if (!verticalDrag) return '';
    
    const isSamePhase = verticalDrag.phaseId === phaseId;
    const isTargetPhase = verticalDrag.targetPhaseId === phaseId;
    
    // Cross-phase: highlight insertion point in target phase
    if (isTargetPhase && verticalDrag.targetPhaseId !== verticalDrag.phaseId) {
      if (actualIndex === verticalDrag.currentIndex && verticalDrag.taskId !== taskId) {
        return 'gantt-swap-target';
      }
      return '';
    }
    
    // Same phase reordering
    if (isSamePhase && verticalDrag.targetPhaseId === verticalDrag.phaseId) {
      const draggedOriginalIndex = verticalDrag.originalIndex;
      const draggedCurrentIndex = verticalDrag.currentIndex;
      
      if (draggedCurrentIndex > draggedOriginalIndex) {
        if (actualIndex > draggedOriginalIndex && actualIndex <= draggedCurrentIndex && verticalDrag.taskId !== taskId) {
          return 'gantt-swap-target';
        }
      } else if (draggedCurrentIndex < draggedOriginalIndex) {
        if (actualIndex >= draggedCurrentIndex && actualIndex < draggedOriginalIndex && verticalDrag.taskId !== taskId) {
          return 'gantt-swap-target';
        }
      }
    }
    return '';
  }, [verticalDrag]);

  const getDropTargetPhaseClasses = useCallback((phaseId: string): string => {
    if (!verticalDrag) return '';
    
    // Highlight the target phase when dragging to a different phase
    if (verticalDrag.targetPhaseId === phaseId && verticalDrag.targetPhaseId !== verticalDrag.phaseId) {
      return 'gantt-drop-target-phase';
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
    handlePhaseHover,
    getVerticalDragClasses,
    getVerticalDragStyles,
    getSwapTargetClasses,
    getDropTargetPhaseClasses,
    getDropIndicatorIndex,
  };
}
