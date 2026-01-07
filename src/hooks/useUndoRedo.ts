import { useState, useCallback, useEffect } from 'react';

export interface HistoryEntry<T> {
  state: T;
  description: string;
  timestamp: number;
}

interface UseUndoRedoOptions<T> {
  maxHistoryLength?: number;
  onUndo?: (previousState: T, currentState: T) => void;
  onRedo?: (nextState: T, currentState: T) => void;
}

interface UseUndoRedoReturn<T> {
  canUndo: boolean;
  canRedo: boolean;
  undoDescription: string | null;
  redoDescription: string | null;
  undo: () => T | null;
  redo: () => T | null;
  pushState: (state: T, description: string) => void;
  clear: () => void;
  historyLength: number;
  currentIndex: number;
}

export function useUndoRedo<T>(
  initialState: T,
  options: UseUndoRedoOptions<T> = {}
): UseUndoRedoReturn<T> {
  const { maxHistoryLength = 50, onUndo, onRedo } = options;
  
  // History stack with current position
  const [history, setHistory] = useState<HistoryEntry<T>[]>([
    { state: initialState, description: 'Initial state', timestamp: Date.now() }
  ]);
  const [currentIndex, setCurrentIndex] = useState(0);

  const canUndo = currentIndex > 0;
  const canRedo = currentIndex < history.length - 1;

  const undoDescription = canUndo ? history[currentIndex].description : null;
  const redoDescription = canRedo ? history[currentIndex + 1].description : null;

  // Push a new state onto the history stack
  const pushState = useCallback((state: T, description: string) => {
    setHistory(prev => {
      // Remove any redo history (everything after current index)
      const newHistory = prev.slice(0, currentIndex + 1);
      
      // Add new entry
      newHistory.push({
        state,
        description,
        timestamp: Date.now(),
      });
      
      // Trim to max length
      if (newHistory.length > maxHistoryLength) {
        newHistory.shift();
        return newHistory;
      }
      
      return newHistory;
    });
    
    setCurrentIndex(prev => {
      const newIndex = Math.min(prev + 1, maxHistoryLength - 1);
      return newIndex;
    });
  }, [currentIndex, maxHistoryLength]);

  // Undo - go back one step
  const undo = useCallback((): T | null => {
    if (!canUndo) return null;
    
    const previousEntry = history[currentIndex - 1];
    const currentEntry = history[currentIndex];
    
    setCurrentIndex(prev => prev - 1);
    
    onUndo?.(previousEntry.state, currentEntry.state);
    
    return previousEntry.state;
  }, [canUndo, currentIndex, history, onUndo]);

  // Redo - go forward one step
  const redo = useCallback((): T | null => {
    if (!canRedo) return null;
    
    const nextEntry = history[currentIndex + 1];
    const currentEntry = history[currentIndex];
    
    setCurrentIndex(prev => prev + 1);
    
    onRedo?.(nextEntry.state, currentEntry.state);
    
    return nextEntry.state;
  }, [canRedo, currentIndex, history, onRedo]);

  // Clear history
  const clear = useCallback(() => {
    const currentState = history[currentIndex]?.state;
    if (currentState) {
      setHistory([{ state: currentState, description: 'Initial state', timestamp: Date.now() }]);
      setCurrentIndex(0);
    }
  }, [history, currentIndex]);

  // Keyboard shortcuts (Ctrl/Cmd + Z for undo, Ctrl/Cmd + Shift + Z or Ctrl/Cmd + Y for redo)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in an input
      const activeElement = document.activeElement;
      const isInputFocused = activeElement?.tagName === 'INPUT' || 
                            activeElement?.tagName === 'TEXTAREA' ||
                            activeElement?.getAttribute('contenteditable') === 'true';
      
      if (isInputFocused) return;

      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const cmdKey = isMac ? e.metaKey : e.ctrlKey;

      if (cmdKey && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if (cmdKey && e.key === 'z' && e.shiftKey) {
        e.preventDefault();
        redo();
      } else if (cmdKey && e.key === 'y') {
        e.preventDefault();
        redo();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo]);

  return {
    canUndo,
    canRedo,
    undoDescription,
    redoDescription,
    undo,
    redo,
    pushState,
    clear,
    historyLength: history.length,
    currentIndex,
  };
}
