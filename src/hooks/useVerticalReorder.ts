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
  getDropIndicatorStyle: (phaseId: string) => React.CSSProperties | null;
  getGhostInfo: () => { phaseId: string; originalIndex: number } | null;
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
      return 'gantt-vertical-dragging';
    }
    return '';
  }, [verticalDrag]);

  const getVerticalDragStyles = useCallback((taskId: string, actualIndex: number, phaseId: string): React.CSSProperties => {
    if (!verticalDrag) return {};
    
    const isSamePhase = verticalDrag.phaseId === phaseId;
    const isTargetPhase = verticalDrag.targetPhaseId === phaseId;
    const insertionIndex = verticalDrag.currentIndex;
    const originalIndex = verticalDrag.originalIndex;
    
    // The dragged item follows cursor
    if (verticalDrag.taskId === taskId) {
      // If dragging to a different phase, show faded state
      if (verticalDrag.targetPhaseId !== verticalDrag.phaseId) {
        return {
          opacity: 0.4,
          transition: 'opacity 150ms ease-out',
          zIndex: 100,
          position: 'relative',
        };
      }
      
      // Same phase - follow cursor position
      const deltaY = (insertionIndex - originalIndex) * rowHeight;
      return {
        transform: `translateY(${deltaY}px) scale(1.02)`,
        transition: 'none',
        zIndex: 100,
        position: 'relative',
      };
    }
    
    // For cross-phase: create gap at insertion point in target phase
    if (isTargetPhase && verticalDrag.targetPhaseId !== verticalDrag.phaseId) {
      // Items at or after the insertion point shift down to create gap
      if (actualIndex >= insertionIndex) {
        return {
          transform: `translateY(${rowHeight}px)`,
          transition: 'transform 180ms cubic-bezier(0.25, 0.1, 0.25, 1)',
        };
      }
      return {
        transition: 'transform 180ms cubic-bezier(0.25, 0.1, 0.25, 1)',
      };
    }
    
    // For same-phase reordering - create visible gap
    if (isSamePhase && verticalDrag.targetPhaseId === verticalDrag.phaseId) {
      // Moving DOWN: items between original and current shift UP
      if (insertionIndex > originalIndex) {
        if (actualIndex > originalIndex && actualIndex <= insertionIndex) {
          return {
            transform: `translateY(-${rowHeight}px)`,
            transition: 'transform 180ms cubic-bezier(0.25, 0.1, 0.25, 1)',
          };
        }
      } 
      // Moving UP: items between current and original shift DOWN
      else if (insertionIndex < originalIndex) {
        if (actualIndex >= insertionIndex && actualIndex < originalIndex) {
          return {
            transform: `translateY(${rowHeight}px)`,
            transition: 'transform 180ms cubic-bezier(0.25, 0.1, 0.25, 1)',
          };
        }
      }
    }
    
    // Original phase - shift up to fill the gap when dragging to another phase
    if (isSamePhase && verticalDrag.targetPhaseId !== verticalDrag.phaseId) {
      if (actualIndex > originalIndex) {
        return {
          transform: `translateY(-${rowHeight}px)`,
          transition: 'transform 180ms cubic-bezier(0.25, 0.1, 0.25, 1)',
        };
      }
    }
    
    return {
      transition: 'transform 180ms cubic-bezier(0.25, 0.1, 0.25, 1)',
    };
  }, [verticalDrag, rowHeight]);

  const getSwapTargetClasses = useCallback((taskId: string, actualIndex: number, phaseId: string): string => {
    // Removed - we use drop indicator instead
    return '';
  }, []);

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

  // Get the drop indicator style for a specific phase
  const getDropIndicatorStyle = useCallback((phaseId: string): React.CSSProperties | null => {
    if (!verticalDrag) return null;
    
    // Only show in target phase
    if (verticalDrag.targetPhaseId !== phaseId) return null;
    
    // Don't show if at original position in same phase
    if (verticalDrag.targetPhaseId === verticalDrag.phaseId && 
        verticalDrag.currentIndex === verticalDrag.originalIndex) {
      return null;
    }
    
    const yPosition = verticalDrag.currentIndex * rowHeight;
    
    return {
      top: yPosition - 1,
      left: 16,
      right: 16,
      height: 2,
      position: 'absolute' as const,
      pointerEvents: 'none' as const,
      zIndex: 200,
    };
  }, [verticalDrag, rowHeight]);

  // Get ghost element info to show at original position
  const getGhostInfo = useCallback(() => {
    if (!verticalDrag) return null;
    
    // Only show ghost if moved from original position
    if (verticalDrag.currentIndex === verticalDrag.originalIndex &&
        verticalDrag.targetPhaseId === verticalDrag.phaseId) {
      return null;
    }
    
    return {
      phaseId: verticalDrag.phaseId,
      originalIndex: verticalDrag.originalIndex,
    };
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
    getDropIndicatorStyle,
    getGhostInfo,
  };
}
