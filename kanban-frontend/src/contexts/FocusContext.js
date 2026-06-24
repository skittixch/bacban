import { createContext, useContext, useState, useCallback, useEffect } from 'react';

const FocusContext = createContext(null);

/**
 * Focus stack entry shape:
 * {
 *   boardId, columnId, taskId,
 *   subtaskPath: [{ colId, subtaskId }],  // empty for top-level tasks
 *   sourceRect: { top, left, width, height },
 * }
 */
export function FocusProvider({ children }) {
  const [stack, setStack] = useState([]);

  const openTask = useCallback((taskInfo, sourceRect) => {
    setStack(prev => [...prev, {
      ...taskInfo,
      subtaskPath: taskInfo.subtaskPath || [],
      sourceRect,
    }]);
  }, []);

  const goBack = useCallback(() => {
    setStack(prev => prev.length > 0 ? prev.slice(0, -1) : prev);
  }, []);

  const closeAll = useCallback(() => {
    setStack([]);
  }, []);

  // Escape key closes the top overlay
  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === 'Escape' && stack.length > 0) {
        e.preventDefault();
        e.stopPropagation();
        goBack();
      }
    };
    if (stack.length > 0) {
      window.addEventListener('keydown', handleKey, true);
      return () => window.removeEventListener('keydown', handleKey, true);
    }
  }, [stack.length, goBack]);

  return (
    <FocusContext.Provider value={{ stack, openTask, goBack, closeAll }}>
      {children}
    </FocusContext.Provider>
  );
}

export function useFocus() {
  const ctx = useContext(FocusContext);
  if (!ctx) throw new Error('useFocus must be used inside FocusProvider');
  return ctx;
}
