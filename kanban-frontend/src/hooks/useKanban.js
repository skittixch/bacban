import { useState, useEffect, useRef, useCallback } from 'react';

const getApiUrl = () => {
  const envUrl = process.env.REACT_APP_API_URL;
  // If a custom production URL is provided and it's not localhost, use it
  if (envUrl && !envUrl.includes('localhost')) {
    return envUrl;
  }
  // Otherwise, use the current hostname (works for localhost, Tailscale IPs, etc.)
  return `${window.location.protocol}//${window.location.hostname}:3001`;
};

const API_URL = getApiUrl();
const REMOTE_REFRESH_INTERVAL_MS = 5000;

const generateId = () => Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
const nowIso = () => new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
const isCompletionColumnTitle = (title = '') => /done|complete/i.test(title);

const parseTimestamp = (value) => {
  if (!value) return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? null : parsed;
};

const createDefaultBoard = (title = 'New Board') => ({
  title,
  tasks: { todo: [], inprogress: [], done: [] },
  columnOrder: ['todo', 'inprogress', 'done'],
  columnTitles: { todo: 'To Do', inprogress: 'In Progress', done: 'Done' },
  collapsed: false,
});

const DEFAULT_SUBTASK_COLUMNS = ['todo', 'doing', 'done'];
const DEFAULT_SUBTASK_TITLES = { todo: 'To Do', doing: 'Doing', done: 'Done' };

/** Create an empty subtask scaffold for a task */
const initSubtasks = () => ({
  columns: [...DEFAULT_SUBTASK_COLUMNS],
  columnTitles: { ...DEFAULT_SUBTASK_TITLES },
  items: { todo: [], doing: [], done: [] },
});

/** Calculate progress for a task's subtasks */
const getTaskProgress = (task) => {
  if (!task.subtasks || !task.subtasks.items) return null;
  const items = task.subtasks.items;
  const total = Object.values(items).flat().length;
  if (total === 0) return null;
  const doneCol = task.subtasks.columns[task.subtasks.columns.length - 1]; // last col = done
  const done = (items[doneCol] || []).length;
  return { done, total };
};

const updateTaskInState = (boards, boardId, columnId, taskId, subtaskPath, updater) => {
  const newBoards = JSON.parse(JSON.stringify(boards));
  const board = newBoards[boardId];
  if (!board) return boards;
  const tasks = board.tasks[columnId];
  if (!tasks) return boards;

  let target = tasks.find(t => t.id === taskId);
  if (!target) return boards;

  if (subtaskPath && subtaskPath.length > 0) {
    for (const step of subtaskPath) {
      if (target && target.subtasks && target.subtasks.items) {
        const subCol = target.subtasks.items[step.colId];
        if (subCol) {
          target = subCol.find(s => s.id === step.subtaskId);
        }
      }
    }
  }

  if (target) {
    updater(target);
    return newBoards;
  }
  return boards;
};

const DEFAULT_PROJECT_COLORS = {
  '#ef4444': 'Project Red',
  '#f97316': 'Project Orange',
  '#f59e0b': 'Project Yellow',
  '#22c55e': 'Project Green',
  '#3b82f6': 'Project Blue',
  '#8b5cf6': 'Project Purple',
  '#ec4899': 'Project Pink',
};

const prepareLoadedData = (data) => {
  const next = JSON.parse(JSON.stringify(data));
  if (next.boards) {
    for (const boardId in next.boards) {
      const board = next.boards[boardId];
      if (board.tasks) {
        for (const columnId in board.tasks) {
          board.tasks[columnId] = board.tasks[columnId].filter(t => {
            const doneAt = parseTimestamp(t.doneAt);
            return !doneAt || (Date.now() - doneAt) / (1000 * 60 * 60 * 24) < 3;
          });
        }
      }
    }
  }
  return next;
};

const getDataSnapshot = (data) => JSON.stringify({
  boards: data.boards,
  theme: data.theme || 'blue',
  darkMode: data.darkMode || false,
  boardOrder: data.boardOrder || Object.keys(data.boards || {}),
  projectColors: data.projectColors || DEFAULT_PROJECT_COLORS,
});

export default function useKanban() {
  const [boards, setBoards] = useState({
    work: createDefaultBoard('Work'),
    life: {
      ...createDefaultBoard('Life'),
      columnTitles: { todo: 'Personal', inprogress: 'Doing', done: 'Completed' },
    },
  });

  const [isDarkMode, setIsDarkMode] = useState(false);
  const [currentTheme, setCurrentTheme] = useState('blue');
  const [boardOrder, setBoardOrder] = useState(['work', 'life']);
  const [projectColors, setProjectColors] = useState(DEFAULT_PROJECT_COLORS);
  const [isLoading, setIsLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState('saved');

  // Drag state — individual vars to match original patterns
  const [draggedTask, setDraggedTask] = useState(null);
  const [draggedFrom, setDraggedFrom] = useState(null);
  const [draggedBoard, setDraggedBoard] = useState(null);
  const [draggedColumn, setDraggedColumn] = useState(null);
  const [draggedColumnIndex, setDraggedColumnIndex] = useState(null);
  const [draggedBoardId, setDraggedBoardId] = useState(null);
  const [draggedTaskIndex, setDraggedTaskIndex] = useState(null);
  const [dragOverTaskIndex, setDragOverTaskIndex] = useState(null);
  const [dragOverTarget, setDragOverTarget] = useState(null); // { boardId, columnId } for cross-column drops

  // Undo delete
  const [deletedTask, setDeletedTask] = useState(null);
  const [deletedSubtask, setDeletedSubtask] = useState(null);
  const undoTimeoutRef = useRef(null);
  const saveTimeoutRef = useRef(null);
  const initialLoadDone = useRef(false);
  const applyingRemoteDataRef = useRef(false);
  const pendingLocalSaveRef = useRef(false);
  const skipNextHistoryPushRef = useRef(false);
  const lastRemoteSnapshotRef = useRef(null);
  const currentBoardSnapshotRef = useRef(null);

  // ---- Undo/Redo History ----
  const historyRef = useRef([]);
  const historyIndexRef = useRef(-1);
  const isUndoRedoRef = useRef(false);
  const [, setHistoryVersion] = useState(0); // triggers re-render for canUndo/canRedo
  const MAX_HISTORY = 50;

  // ---- Data persistence ----

  const applyRemoteData = useCallback((data, { resetHistory = false } = {}) => {
    const preparedData = prepareLoadedData(data);
    const boardOrderToApply = preparedData.boardOrder || Object.keys(preparedData.boards);
    const nextBoardSnapshot = JSON.stringify({ boards: preparedData.boards, boardOrder: boardOrderToApply });

    applyingRemoteDataRef.current = true;
    if (resetHistory && nextBoardSnapshot !== currentBoardSnapshotRef.current) {
      skipNextHistoryPushRef.current = true;
    }
    lastRemoteSnapshotRef.current = getDataSnapshot(preparedData);

    setBoards(preparedData.boards);
    setCurrentTheme(preparedData.theme || 'blue');
    setIsDarkMode(preparedData.darkMode || false);
    setBoardOrder(boardOrderToApply);
    setProjectColors(preparedData.projectColors || DEFAULT_PROJECT_COLORS);
  }, []);

  const loadData = useCallback(async ({ quiet = false, initial = false } = {}) => {
    try {
      const response = await fetch(`${API_URL}/api/data`);
      if (response.ok) {
        const data = await response.json();
        const remoteSnapshot = getDataSnapshot(prepareLoadedData(data));

        if (initial || remoteSnapshot !== lastRemoteSnapshotRef.current) {
          if (!initial && pendingLocalSaveRef.current) return;
          applyRemoteData(data, { resetHistory: !initial });
        }
      }
    } catch (error) {
      console.error('Failed to load data:', error);
      if (!quiet) setSaveStatus('error');
    } finally {
      setIsLoading(false);
      initialLoadDone.current = true;
    }
  }, [applyRemoteData]);

  const saveData = useCallback((dataToSave) => {
    setSaveStatus('saving');
    pendingLocalSaveRef.current = true;
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);

    saveTimeoutRef.current = setTimeout(async () => {
      saveTimeoutRef.current = null;
      try {
        const response = await fetch(`${API_URL}/api/data`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(dataToSave),
        });
        if (response.ok) {
          lastRemoteSnapshotRef.current = getDataSnapshot(dataToSave);
        }
        setSaveStatus(response.ok ? 'saved' : 'error');
      } catch (error) {
        console.error('Failed to save:', error);
        setSaveStatus('error');
      } finally {
        pendingLocalSaveRef.current = false;
      }
    }, 500);
  }, []);

  useEffect(() => { loadData({ initial: true }); }, [loadData]);

  useEffect(() => {
    const refreshFromServer = () => {
      if (!initialLoadDone.current || document.hidden || pendingLocalSaveRef.current) return;
      loadData({ quiet: true });
    };

    const interval = setInterval(refreshFromServer, REMOTE_REFRESH_INTERVAL_MS);
    const handleVisibilityChange = () => {
      if (!document.hidden) refreshFromServer();
    };
    const handleFocus = () => refreshFromServer();

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
    };
  }, [loadData]);

  useEffect(() => {
    if (initialLoadDone.current) {
      if (applyingRemoteDataRef.current) {
        applyingRemoteDataRef.current = false;
        setSaveStatus('saved');
        return;
      }
      saveData({ boards, theme: currentTheme, darkMode: isDarkMode, boardOrder, projectColors });
    }
  }, [boards, currentTheme, isDarkMode, boardOrder, projectColors, saveData]);

  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      if (undoTimeoutRef.current) clearTimeout(undoTimeoutRef.current);
    };
  }, []);

  // ---- Periodic cleanup of old completed tasks ----
  useEffect(() => {
    if (!initialLoadDone.current) return;
    const interval = setInterval(() => {
      setBoards(prev => {
        let hasChanges = false;
        const newBoards = JSON.parse(JSON.stringify(prev));
        for (const boardId in newBoards) {
          const board = newBoards[boardId];
          for (const columnId in board.tasks) {
            const originalLength = board.tasks[columnId].length;
            board.tasks[columnId] = board.tasks[columnId].filter(task => {
              if (task.doneAt) {
                const doneAt = parseTimestamp(task.doneAt);
                const daysOld = doneAt ? (Date.now() - doneAt) / (1000 * 60 * 60 * 24) : 0;
                return daysOld < 3.0;
              }
              return true;
            });
            if (board.tasks[columnId].length !== originalLength) hasChanges = true;
          }
        }
        return hasChanges ? newBoards : prev;
      });
    }, 60000); // Check every minute
    return () => clearInterval(interval);
  }, []);

  // ---- History tracking ----
  useEffect(() => {
    if (!initialLoadDone.current) return;

    const snapshot = JSON.stringify({ boards, boardOrder });
    currentBoardSnapshotRef.current = snapshot;

    if (skipNextHistoryPushRef.current) {
      historyRef.current = [snapshot];
      historyIndexRef.current = 0;
      skipNextHistoryPushRef.current = false;
      setHistoryVersion(v => v + 1);
      return;
    }

    // Skip pushes caused by undo/redo restoring state
    if (isUndoRedoRef.current) {
      isUndoRedoRef.current = false;
      return;
    }

    const currentSnapshot = historyRef.current[historyIndexRef.current];
    if (snapshot === currentSnapshot) return; // no actual change

    // Truncate any future history (user made a new action after undoing)
    historyRef.current = historyRef.current.slice(0, historyIndexRef.current + 1);
    historyRef.current.push(snapshot);

    // Cap history size
    if (historyRef.current.length > MAX_HISTORY) {
      historyRef.current.shift();
    }
    historyIndexRef.current = historyRef.current.length - 1;
    setHistoryVersion(v => v + 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boards, boardOrder]);

  const canUndo = historyIndexRef.current > 0;
  const canRedo = historyIndexRef.current < historyRef.current.length - 1;

  const undo = useCallback(() => {
    if (historyIndexRef.current <= 0) return false;
    historyIndexRef.current -= 1;
    const snapshot = JSON.parse(historyRef.current[historyIndexRef.current]);
    isUndoRedoRef.current = true;
    setBoards(snapshot.boards);
    setBoardOrder(snapshot.boardOrder);
    // Clear delete toast so it doesn't conflict
    setDeletedTask(null);
    if (undoTimeoutRef.current) clearTimeout(undoTimeoutRef.current);
    setHistoryVersion(v => v + 1);
    return true;
  }, []);

  const redo = useCallback(() => {
    if (historyIndexRef.current >= historyRef.current.length - 1) return false;
    historyIndexRef.current += 1;
    const snapshot = JSON.parse(historyRef.current[historyIndexRef.current]);
    isUndoRedoRef.current = true;
    setBoards(snapshot.boards);
    setBoardOrder(snapshot.boardOrder);
    setHistoryVersion(v => v + 1);
    return true;
  }, []);

  // ---- CRUD ----

  const addTask = useCallback((boardId, columnId, text) => {
    if (!text.trim()) return;
    const newTask = {
      id: Date.now(),
      text: text.trim(),
      createdAt: new Date().toLocaleDateString(),
      updatedAt: nowIso(),
    };
    setBoards(prev => ({
      ...prev,
      [boardId]: {
        ...prev[boardId],
        tasks: {
          ...prev[boardId].tasks,
          [columnId]: [...prev[boardId].tasks[columnId], newTask],
        },
      },
    }));
  }, []);

  const deleteTask = useCallback((boardId, columnId, taskId) => {
    setBoards(prev => {
      const task = prev[boardId].tasks[columnId].find(t => t.id === taskId);
      if (task) {
        setDeletedTask({ task, boardId, columnId });
        if (undoTimeoutRef.current) clearTimeout(undoTimeoutRef.current);
        undoTimeoutRef.current = setTimeout(() => setDeletedTask(null), 5000);
      }
      return {
        ...prev,
        [boardId]: {
          ...prev[boardId],
          tasks: {
            ...prev[boardId].tasks,
            [columnId]: prev[boardId].tasks[columnId].filter(t => t.id !== taskId),
          },
        },
      };
    });
  }, []);

  const duplicateTask = useCallback((boardId, columnId, taskId) => {
    setBoards(prev => {
      const board = prev[boardId];
      if (!board) return prev;
      const tasks = board.tasks[columnId];
      if (!tasks) return prev;
      const taskIndex = tasks.findIndex(t => t.id === taskId);
      if (taskIndex === -1) return prev;

      const originalTask = tasks[taskIndex];
      const duplicatedTask = {
        ...JSON.parse(JSON.stringify(originalTask)),
        id: Date.now(),
        text: originalTask.text + ' (Copy)',
        createdAt: new Date().toLocaleDateString(),
        updatedAt: nowIso(),
      };
      delete duplicatedTask.doneAt;

      const newTasks = [...tasks];
      newTasks.splice(taskIndex + 1, 0, duplicatedTask);

      return {
        ...prev,
        [boardId]: {
          ...board,
          tasks: {
            ...board.tasks,
            [columnId]: newTasks,
          },
        },
      };
    });
  }, []);

  const undoDelete = useCallback(() => {
    if (!deletedTask) return;
    const { task, boardId, columnId } = deletedTask;
    setBoards(prev => {
      // Check that board/column still exists
      if (!prev[boardId] || !prev[boardId].tasks[columnId]) return prev;
      return {
        ...prev,
        [boardId]: {
          ...prev[boardId],
          tasks: {
            ...prev[boardId].tasks,
            [columnId]: [...prev[boardId].tasks[columnId], task],
          },
        },
      };
    });
    setDeletedTask(null);
    if (undoTimeoutRef.current) clearTimeout(undoTimeoutRef.current);
  }, [deletedTask]);

  const updateTask = useCallback((boardId, columnId, taskId, newText, subtaskPath) => {
    if (!newText.trim()) return;
    setBoards(prev => updateTaskInState(prev, boardId, columnId, taskId, subtaskPath, (t) => {
      t.text = newText.trim();
      t.updatedAt = nowIso();
    }));
  }, []);

  const updateTaskPriority = useCallback((boardId, columnId, taskId, priority, subtaskPath) => {
    setBoards(prev => updateTaskInState(prev, boardId, columnId, taskId, subtaskPath, (t) => {
      t.priority = priority;
      t.updatedAt = nowIso();
    }));
  }, []);

  const updateTaskColor = useCallback((boardId, columnId, taskId, color, subtaskPath) => {
    setBoards(prev => updateTaskInState(prev, boardId, columnId, taskId, subtaskPath, (t) => {
      t.color = color;
      t.updatedAt = nowIso();
    }));
  }, []);

  const updateTaskReferences = useCallback((boardId, columnId, taskId, references, subtaskPath) => {
    setBoards(prev => updateTaskInState(prev, boardId, columnId, taskId, subtaskPath, (t) => {
      t.references = references;
      t.updatedAt = nowIso();
    }));
  }, []);

  const updateTaskWaitingOn = useCallback((boardId, columnId, taskId, waitingOn, subtaskPath) => {
    setBoards(prev => updateTaskInState(prev, boardId, columnId, taskId, subtaskPath, (t) => {
      t.waitingOn = waitingOn ? waitingOn.trim() : undefined;
      t.updatedAt = nowIso();
    }));
  }, []);

  const updateTaskDueDate = useCallback((boardId, columnId, taskId, dueDate, subtaskPath) => {
    setBoards(prev => updateTaskInState(prev, boardId, columnId, taskId, subtaskPath, (t) => {
      t.dueDate = dueDate || undefined;
      t.updatedAt = nowIso();
    }));
  }, []);

  const updateProjectColorName = useCallback((hex, newName) => {
    setProjectColors(prev => ({
      ...prev,
      [hex]: newName
    }));
  }, []);

  // ---- Subtask CRUD ----

  const addSubtask = useCallback((boardId, columnId, taskId, subtaskColId, text, subtaskPath) => {
    if (!text.trim()) return;
    const newSub = {
      id: 'st_' + generateId(),
      text: text.trim(),
      createdAt: new Date().toLocaleDateString(),
    };
    setBoards(prev => updateTaskInState(prev, boardId, columnId, taskId, subtaskPath, (target) => {
      if (!target.subtasks || !target.subtasks.items) {
        target.subtasks = initSubtasks();
      }
      target.subtasks.items[subtaskColId] = [
        ...(target.subtasks.items[subtaskColId] || []),
        newSub
      ];
    }));
  }, []);

  const deleteSubtask = useCallback((boardId, columnId, taskId, subtaskColId, subtaskId, subtaskPath) => {
    setBoards(prev => updateTaskInState(prev, boardId, columnId, taskId, subtaskPath, (target) => {
      if (target.subtasks && target.subtasks.items && target.subtasks.items[subtaskColId]) {
        const subtask = target.subtasks.items[subtaskColId].find(s => s.id === subtaskId);
        if (subtask) {
          setDeletedSubtask({ subtask, boardId, columnId, taskId, subtaskColId, subtaskPath });
          if (undoTimeoutRef.current) clearTimeout(undoTimeoutRef.current);
          undoTimeoutRef.current = setTimeout(() => setDeletedSubtask(null), 5000);
        }
        target.subtasks.items[subtaskColId] = target.subtasks.items[subtaskColId].filter(s => s.id !== subtaskId);
      }
    }));
  }, []);

  const undoDeleteSubtask = useCallback(() => {
    if (!deletedSubtask) return;
    const { subtask, boardId, columnId, taskId, subtaskColId, subtaskPath } = deletedSubtask;
    setBoards(prev => updateTaskInState(prev, boardId, columnId, taskId, subtaskPath, (target) => {
      if (target.subtasks && target.subtasks.items) {
        target.subtasks.items[subtaskColId] = [...(target.subtasks.items[subtaskColId] || []), subtask];
      }
    }));
    setDeletedSubtask(null);
    if (undoTimeoutRef.current) clearTimeout(undoTimeoutRef.current);
  }, [deletedSubtask]);

  const updateSubtask = useCallback((boardId, columnId, taskId, subtaskColId, subtaskId, newText, subtaskPath) => {
    if (!newText.trim()) return;
    setBoards(prev => updateTaskInState(prev, boardId, columnId, taskId, subtaskPath, (target) => {
      if (target.subtasks && target.subtasks.items && target.subtasks.items[subtaskColId]) {
        target.subtasks.items[subtaskColId] = target.subtasks.items[subtaskColId].map(s =>
          s.id === subtaskId ? { ...s, text: newText.trim() } : s
        );
      }
    }));
  }, []);

  const moveSubtask = useCallback((boardId, columnId, taskId, fromSubCol, toSubCol, subtaskId, targetIndex, subtaskPath) => {
    setBoards(prev => updateTaskInState(prev, boardId, columnId, taskId, subtaskPath, (target) => {
      if (target.subtasks && target.subtasks.items) {
        const items = target.subtasks.items;
        const fromList = items[fromSubCol] || [];
        const subIdx = fromList.findIndex(s => s.id === subtaskId);
        if (subIdx === -1) return;
        const [moved] = fromList.splice(subIdx, 1);
        const toList = items[toSubCol] || [];
        const insertAt = targetIndex !== undefined ? targetIndex : toList.length;
        toList.splice(insertAt, 0, moved);
        items[fromSubCol] = fromList;
        items[toSubCol] = toList;
      }
    }));
  }, []);

  const reorderSubtask = useCallback((boardId, columnId, taskId, subtaskColId, fromIndex, toIndex, subtaskPath) => {
    if (fromIndex === toIndex) return;
    setBoards(prev => updateTaskInState(prev, boardId, columnId, taskId, subtaskPath, (target) => {
      if (target.subtasks && target.subtasks.items) {
        const list = target.subtasks.items[subtaskColId] || [];
        const [moved] = list.splice(fromIndex, 1);
        list.splice(toIndex, 0, moved);
        target.subtasks.items[subtaskColId] = list;
      }
    }));
  }, []);

  const updateColumnTitle = useCallback((boardId, columnId, newTitle) => {
    if (!newTitle.trim()) return;
    setBoards(prev => ({
      ...prev,
      [boardId]: {
        ...prev[boardId],
        columnTitles: {
          ...prev[boardId].columnTitles,
          [columnId]: newTitle.trim(),
        },
      },
    }));
  }, []);

  const updateBoardTitle = useCallback((boardId, newTitle) => {
    if (!newTitle.trim()) return;
    setBoards(prev => ({
      ...prev,
      [boardId]: {
        ...prev[boardId],
        title: newTitle.trim(),
      },
    }));
  }, []);

  const toggleBoardCollapsed = useCallback((boardId) => {
    setBoards(prev => ({
      ...prev,
      [boardId]: {
        ...prev[boardId],
        collapsed: !prev[boardId].collapsed,
      },
    }));
  }, []);

  // ---- Board / Column management ----

  const addBoard = useCallback((title = 'New Board') => {
    const id = 'board_' + generateId();
    setBoards(prev => ({ ...prev, [id]: createDefaultBoard(title) }));
    setBoardOrder(prev => [...prev, id]);
  }, []);

  const deleteBoard = useCallback((boardId) => {
    setBoards(prev => {
      const next = { ...prev };
      delete next[boardId];
      return next;
    });
    setBoardOrder(prev => prev.filter(id => id !== boardId));
  }, []);

  const addColumn = useCallback((boardId, title = 'New Column') => {
    const colId = 'col_' + generateId();
    setBoards(prev => ({
      ...prev,
      [boardId]: {
        ...prev[boardId],
        tasks: { ...prev[boardId].tasks, [colId]: [] },
        columnOrder: [...prev[boardId].columnOrder, colId],
        columnTitles: { ...prev[boardId].columnTitles, [colId]: title },
      },
    }));
  }, []);

  const deleteColumn = useCallback((boardId, columnId) => {
    setBoards(prev => {
      const board = prev[boardId];
      if (board.columnOrder.length <= 1) return prev; // don't delete last column
      const newTasks = { ...board.tasks };
      delete newTasks[columnId];
      const newTitles = { ...board.columnTitles };
      delete newTitles[columnId];
      return {
        ...prev,
        [boardId]: {
          ...board,
          tasks: newTasks,
          columnOrder: board.columnOrder.filter(id => id !== columnId),
          columnTitles: newTitles,
        },
      };
    });
  }, []);

  // ---- Column drag handlers ----

  const handleColumnDragStart = useCallback((e, columnId, boardId, index) => {
    e.stopPropagation();
    setDraggedColumn(columnId);
    setDraggedColumnIndex(index);
    setDraggedBoard(boardId);
    e.dataTransfer.effectAllowed = 'move';
  }, []);

  const handleColumnDragOver = useCallback((e, targetIndex, boardId) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';

    if (draggedColumnIndex === null || draggedColumnIndex === targetIndex || draggedBoard !== boardId) return;

    setBoards(prev => {
      const newOrder = [...prev[boardId].columnOrder];
      const draggedItem = newOrder[draggedColumnIndex];
      newOrder.splice(draggedColumnIndex, 1);
      newOrder.splice(targetIndex, 0, draggedItem);
      return {
        ...prev,
        [boardId]: { ...prev[boardId], columnOrder: newOrder },
      };
    });

    setDraggedColumnIndex(targetIndex);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draggedColumnIndex, draggedBoard]);

  const handleColumnDragEnd = useCallback(() => {
    setDraggedColumn(null);
    setDraggedColumnIndex(null);
    setDraggedBoard(null);
  }, []);

  // ---- Board drag handlers ----

  const handleBoardDragStart = useCallback((e, boardId) => {
    setDraggedBoardId(boardId);
    e.dataTransfer.effectAllowed = 'move';
  }, []);

  const handleBoardDragOver = useCallback((e, targetBoardId) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (!draggedBoardId || draggedBoardId === targetBoardId) return;

    setBoardOrder(prev => {
      const currentIndex = prev.indexOf(draggedBoardId);
      const targetIndex = prev.indexOf(targetBoardId);
      const newOrder = [...prev];
      newOrder.splice(currentIndex, 1);
      newOrder.splice(targetIndex, 0, draggedBoardId);
      return newOrder;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draggedBoardId]);

  const handleBoardDragEnd = useCallback(() => {
    setDraggedBoardId(null);
  }, []);

  // ---- Task drag handlers ----

  const handleDragStart = useCallback((e, task, boardId, columnId, taskIndex) => {
    e.stopPropagation();
    setDraggedTask(task);
    setDraggedFrom({ boardId, columnId });
    setDraggedBoard(boardId);
    setDraggedTaskIndex(taskIndex);
    e.dataTransfer.effectAllowed = 'move';
  }, []);

  const handleTaskDragOver = useCallback((e, targetIndex, targetBoardId, targetColumnId) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';

    if (!draggedTask || !draggedFrom) return;

    // Track the hover target for cross-column positioning
    setDragOverTaskIndex(targetIndex);
    setDragOverTarget({ boardId: targetBoardId, columnId: targetColumnId });

    // Same-column reorder (live swap)
    if (draggedFrom.boardId === targetBoardId &&
        draggedFrom.columnId === targetColumnId &&
        draggedTaskIndex !== targetIndex) {

      setBoards(prev => {
        const newTasks = [...prev[targetBoardId].tasks[targetColumnId]];
        const draggedItem = newTasks[draggedTaskIndex];
        if (!draggedItem) return prev;
        newTasks.splice(draggedTaskIndex, 1);
        newTasks.splice(targetIndex, 0, draggedItem);
        return {
          ...prev,
          [targetBoardId]: {
            ...prev[targetBoardId],
            tasks: {
              ...prev[targetBoardId].tasks,
              [targetColumnId]: newTasks,
            },
          },
        };
      });

      setDraggedTaskIndex(targetIndex);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draggedTask, draggedFrom, draggedTaskIndex]);

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }, []);

  const handleDrop = useCallback((e, targetBoardId, targetColumnId) => {
    e.preventDefault();
    e.stopPropagation();

    if (!draggedTask || !draggedFrom) return;

    if (draggedFrom.boardId === targetBoardId && draggedFrom.columnId === targetColumnId) {
      // Same column — just reset drag state (reorder already happened in dragOver)
      setDraggedTask(null);
      setDraggedFrom(null);
      setDraggedBoard(null);
      setDraggedTaskIndex(null);
      setDragOverTaskIndex(null);
      setDragOverTarget(null);
      return;
    }

    // Move to different column/board
    const dropX = e.clientX;
    const dropY = e.clientY;

    // Determine insertion index: use tracked hover position if available
    const insertIndex = (dragOverTarget &&
      dragOverTarget.boardId === targetBoardId &&
      dragOverTarget.columnId === targetColumnId &&
      dragOverTaskIndex != null)
      ? dragOverTaskIndex
      : null; // null = append to end

    setBoards(prev => {
      const newBoards = JSON.parse(JSON.stringify(prev)); // deep clone
      newBoards[draggedFrom.boardId].tasks[draggedFrom.columnId] =
        newBoards[draggedFrom.boardId].tasks[draggedFrom.columnId].filter(t => t.id !== draggedTask.id);
      
      const movedTask = { ...draggedTask, updatedAt: nowIso() };
      const targetColumnTitle = (newBoards[targetBoardId]?.columnTitles?.[targetColumnId] || '').toLowerCase();
      const isDoneColumn = isCompletionColumnTitle(targetColumnTitle);

      if (isDoneColumn) {
        if (!movedTask.doneAt) {
          movedTask.doneAt = nowIso();
          setTimeout(() => {
            window.dispatchEvent(new CustomEvent('taskDroppedToDone', { detail: { x: dropX, y: dropY } }));
          }, 50);
        }
      } else {
        delete movedTask.doneAt;
      }

      const targetList = newBoards[targetBoardId].tasks[targetColumnId];
      if (insertIndex != null && insertIndex < targetList.length) {
        targetList.splice(insertIndex, 0, movedTask);
      } else {
        targetList.push(movedTask);
      }

      return newBoards;
    });

    setDraggedTask(null);
    setDraggedFrom(null);
    setDraggedBoard(null);
    setDraggedTaskIndex(null);
    setDragOverTaskIndex(null);
    setDragOverTarget(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draggedTask, draggedFrom, dragOverTaskIndex, dragOverTarget]);

  const moveTaskToAdjacentColumn = useCallback((boardId, columnId, taskId, direction, point = {}) => {
    const step = direction === 'next' || direction === 1 ? 1 : direction === 'previous' || direction === -1 ? -1 : 0;
    if (!step) return;

    setBoards(prev => {
      const board = prev[boardId];
      if (!board) return prev;

      const fromColumnIndex = board.columnOrder.indexOf(columnId);
      const targetColumnId = board.columnOrder[fromColumnIndex + step];
      if (fromColumnIndex === -1 || !targetColumnId) return prev;

      const sourceTasks = board.tasks[columnId] || [];
      const taskIndex = sourceTasks.findIndex(task => task.id === taskId);
      if (taskIndex === -1) return prev;

      const targetTasks = board.tasks[targetColumnId] || [];
      const movedTask = { ...sourceTasks[taskIndex], updatedAt: nowIso() };
      const targetColumnTitle = board.columnTitles?.[targetColumnId] || '';

      if (isCompletionColumnTitle(targetColumnTitle)) {
        if (!movedTask.doneAt) {
          movedTask.doneAt = nowIso();
          setTimeout(() => {
            window.dispatchEvent(new CustomEvent('taskDroppedToDone', {
              detail: { x: point.x || window.innerWidth / 2, y: point.y || window.innerHeight / 2 },
            }));
          }, 50);
        }
      } else {
        delete movedTask.doneAt;
      }

      return {
        ...prev,
        [boardId]: {
          ...board,
          tasks: {
            ...board.tasks,
            [columnId]: sourceTasks.filter(task => task.id !== taskId),
            [targetColumnId]: [...targetTasks, movedTask],
          },
        },
      };
    });
  }, []);

  const handleDragEnd = useCallback(() => {
    setDraggedTask(null);
    setDraggedFrom(null);
    setDraggedBoard(null);
    setDraggedTaskIndex(null);
    setDragOverTaskIndex(null);
    setDragOverTarget(null);
  }, []);

  // Computed drag state object for consumers
  const dragState = {
    task: draggedTask,
    from: draggedFrom,
    board: draggedBoard,
    column: draggedColumn,
    columnIndex: draggedColumnIndex,
    boardId: draggedBoardId,
    taskIndex: draggedTaskIndex,
    overTaskIndex: dragOverTaskIndex,
    overTarget: dragOverTarget,
  };

  return {
    boards, boardOrder, isDarkMode, currentTheme, isLoading, saveStatus, projectColors,
    setIsDarkMode, setCurrentTheme, updateProjectColorName,
    addTask, deleteTask, duplicateTask, updateTask, updateTaskPriority, updateTaskColor, updateTaskReferences, updateTaskWaitingOn, updateTaskDueDate,
    moveTaskToAdjacentColumn,
    undoDelete, deletedTask, undoDeleteSubtask, deletedSubtask,
    updateColumnTitle, updateBoardTitle, toggleBoardCollapsed,
    addBoard, deleteBoard, addColumn, deleteColumn,
    // Subtask operations
    addSubtask, deleteSubtask, updateSubtask, moveSubtask, reorderSubtask,
    getTaskProgress,
    undo, redo, canUndo, canRedo,
    dragState,
    handleDragStart, handleDragOver, handleDrop, handleTaskDragOver, handleDragEnd,
    handleColumnDragStart, handleColumnDragOver, handleColumnDragEnd,
    handleBoardDragStart, handleBoardDragOver, handleBoardDragEnd,
  };
}
