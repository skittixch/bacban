import React, { useState, useEffect } from 'react';
import { HardDrive, Plus, RotateCcw, Settings, Sun, Moon } from 'lucide-react';
import confetti from 'canvas-confetti';
import { KanbanProvider, useKanbanContext } from './contexts/KanbanContext';
import Board from './components/Board';
import TaskOverlay from './components/TaskOverlay';
import { FocusProvider, useFocus } from './contexts/FocusContext';
import { ContextMenuProvider } from './contexts/ContextMenuContext';
import ContextMenu from './components/ContextMenu';
import MobileDemo from './components/MobileDemo';
import SettingsPanel from './components/SettingsPanel';

const themes = {
  blue: {
    primary: '#3b82f6',
    hover: '#2563eb',
    light: 'rgba(59, 130, 246, 0.1)',
    glow: 'rgba(59, 130, 246, 0.25)',
    name: 'Blue',
  },
  green: {
    primary: '#22c55e',
    hover: '#16a34a',
    light: 'rgba(34, 197, 94, 0.1)',
    glow: 'rgba(34, 197, 94, 0.25)',
    name: 'Green',
  },
  purple: {
    primary: '#8b5cf6',
    hover: '#7c3aed',
    light: 'rgba(139, 92, 246, 0.1)',
    glow: 'rgba(139, 92, 246, 0.25)',
    name: 'Purple',
  },
  orange: {
    primary: '#f97316',
    hover: '#ea580c',
    light: 'rgba(249, 115, 22, 0.1)',
    glow: 'rgba(249, 115, 22, 0.25)',
    name: 'Orange',
  },
  pink: {
    primary: '#ec4899',
    hover: '#db2777',
    light: 'rgba(236, 72, 153, 0.1)',
    glow: 'rgba(236, 72, 153, 0.25)',
    name: 'Pink',
  },
};

const useViewportMatch = (query) => {
  const getMatch = () => (
    typeof window !== 'undefined'
      && typeof window.matchMedia === 'function'
      && window.matchMedia(query).matches
  );

  const [matches, setMatches] = useState(getMatch);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return undefined;
    const mediaQuery = window.matchMedia(query);
    const handleChange = () => setMatches(mediaQuery.matches);

    handleChange();
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [query]);

  return matches;
};

const KanbanBoardInner = () => {
  const kanban = useKanbanContext();
  const { stack } = useFocus();
  const [showSettings, setShowSettings] = useState(false);
  const [undoNotification, setUndoNotification] = useState(null);
  const isMobileViewport = useViewportMatch('(max-width: 700px)');
  const queryParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
  const mobileLayoutEnabled = Boolean(
    queryParams?.get('mobileDemo') === '1'
    || (isMobileViewport && queryParams?.get('desktopLayout') !== '1')
  );

  const {
    boards, boardOrder, isDarkMode, currentTheme, isLoading, saveStatus, projectColors, settings, storageConfig, isDemoMode,
    setIsDarkMode, setCurrentTheme, updateProjectColorName,
    updateSettings, updateStorageConfig, exportData, importData, resetDemoData,
    deletedTask, undoDelete, deletedSubtask, undoDeleteSubtask,
  } = kanban;


  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          if (kanban.redo()) setUndoNotification('Redone');
        } else {
          if (kanban.undo()) setUndoNotification('Undone');
        }
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        if (kanban.redo()) setUndoNotification('Redone');
        return;
      }

      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      switch (e.key.toLowerCase()) {
        case 't':
          e.preventDefault();
          setIsDarkMode(d => !d);
          break;
        case 's':
          e.preventDefault();
          setShowSettings(s => !s);
          break;
        default:
          break;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [setIsDarkMode, kanban]);

  useEffect(() => {
    if (undoNotification) {
      const t = setTimeout(() => setUndoNotification(null), 1500);
      return () => clearTimeout(t);
    }
  }, [undoNotification]);

  useEffect(() => {
    document.body.className = isDarkMode ? 'dark-mode' : '';
  }, [isDarkMode]);

  const handleResetDemoData = async () => {
    const ok = await resetDemoData?.();
    setUndoNotification(ok ? 'Demo reset' : 'Demo reset failed');
  };

  useEffect(() => {
    const handleConfetti = (e) => {
      if (settings?.completionCelebration === false) return;
      const { x, y } = e.detail;
      confetti({
        particleCount: 150, spread: 80,
        origin: { x: x / window.innerWidth, y: y / window.innerHeight },
        colors: ['#22c55e', '#3b82f6', '#f59e0b', '#ec4899', '#8b5cf6'],
        zIndex: 9999,
      });
    };
    window.addEventListener('taskDroppedToDone', handleConfetti);
    return () => window.removeEventListener('taskDroppedToDone', handleConfetti);
  }, [settings?.completionCelebration]);

  // Prevent body scroll when overlay is open
  useEffect(() => {
    document.body.style.overflow = stack.length > 0 ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [stack.length]);

  // Resolve a task from the focus stack entry
  const resolveTask = (entry) => {
    const board = boards[entry.boardId];
    if (!board) return null;
    const col = board.tasks[entry.columnId];
    if (!col) return null;
    const task = col.find(t => t.id === entry.taskId);
    if (!task) return null;

    // If subtaskPath is non-empty, traverse into nested subtasks
    if (entry.subtaskPath && entry.subtaskPath.length > 0) {
      let current = task;
      for (const step of entry.subtaskPath) {
        if (!current.subtasks || !current.subtasks.items) return null;
        const subCol = current.subtasks.items[step.colId];
        if (!subCol) return null;
        current = subCol.find(s => s.id === step.subtaskId);
        if (!current) return null;
      }
      return current;
    }

    return task;
  };

  if (isLoading) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${
        isDarkMode ? 'bg-gray-900 text-white' : 'bg-gray-50 text-gray-900'
      }`}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-2 themed-border border-t-transparent mx-auto mb-3" />
          <p className="text-sm text-gray-500">Loading boards…</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`app-shell min-h-screen transition-colors duration-300 ${
      isDarkMode ? 'bg-gray-900 text-white' : 'bg-gray-50 text-gray-900'
    } ${mobileLayoutEnabled ? 'mobile-demo-active' : ''}`}
    data-card-density={settings?.cardDensity || 'comfortable'}
    style={{
      '--theme-primary': themes[currentTheme]?.primary || '#3b82f6',
      '--theme-primary-hover': themes[currentTheme]?.hover || '#2563eb',
      '--theme-primary-light': themes[currentTheme]?.light || 'rgba(59, 130, 246, 0.1)',
      '--theme-primary-glow': themes[currentTheme]?.glow || 'rgba(59, 130, 246, 0.25)',
    }}>

      {/* ---- Main board content — dims when overlay is open ---- */}
      <div
        className="board-layer"
        style={{
          opacity: stack.length > 0 ? 0.15 : 1,
          filter: stack.length > 0 ? 'blur(3px)' : 'none',
          transition: 'opacity 0.4s ease, filter 0.4s ease',
          pointerEvents: stack.length > 0 ? 'none' : 'auto',
        }}
      >
        {isDemoMode && (
          <div className="demo-mode-banner" role="status">
            <div className="demo-mode-copy">
              <HardDrive size={16} />
              <span>Demo mode</span>
              <small>Saved in this browser only; site data may be cleared.</small>
            </div>
            <button type="button" onClick={handleResetDemoData}>
              <RotateCcw size={14} />
              <span>Reset sample board</span>
            </button>
          </div>
        )}

        {mobileLayoutEnabled ? (
          <MobileDemo />
        ) : (
          <>
        {/* Header */}
        <div className={`app-header sticky top-0 z-50 border-b bg-[var(--surface-primary)] border-[var(--border-default)]`}>
          <div className="max-w-full mx-auto px-5 py-2.5 flex justify-between items-center">
            <div className="flex items-center space-x-3">
              <h1 className="text-lg font-bold tracking-tight">BacBan</h1>
              <span className={`save-dot ${saveStatus}`} title={
                saveStatus === 'saved' ? 'All changes saved' :
                saveStatus === 'saving' ? 'Saving...' : 'Error saving'
              } />
            </div>
            <div className="flex items-center space-x-1.5">
              <button
                onClick={() => setIsDarkMode(d => !d)}
                className={`p-2 rounded-lg transition-all text-[var(--text-secondary)] hover:bg-[var(--surface-tertiary)] hover:text-[var(--theme-primary)]`}
                title="Toggle dark mode (T)"
                aria-label="Toggle dark mode"
              >
                {isDarkMode ? <Sun size={18} /> : <Moon size={18} />}
              </button>
              <button
                onClick={() => setShowSettings(s => !s)}
                className={`p-2 rounded-lg transition-all text-[var(--text-secondary)] hover:bg-[var(--surface-tertiary)] hover:text-[var(--text-primary)]`}
                title="Settings (S)"
                aria-label="Settings"
                aria-expanded={showSettings}
                aria-controls="settings-panel"
              >
                <Settings size={18} />
              </button>
            </div>
          </div>
        </div>

        {/* Settings Panel */}
        {showSettings && (
          <SettingsPanel
            themes={themes}
            currentTheme={currentTheme}
            isDarkMode={isDarkMode}
            settings={settings}
            storageConfig={storageConfig}
            projectColors={projectColors}
            setCurrentTheme={setCurrentTheme}
            setIsDarkMode={setIsDarkMode}
            updateSettings={updateSettings}
            updateStorageConfig={updateStorageConfig}
            updateProjectColorName={updateProjectColorName}
            exportData={exportData}
            importData={importData}
            isDemoMode={isDemoMode}
            resetDemoData={resetDemoData}
          />
        )}

        {/* Boards */}
        <div className="px-5 py-4">
          {boardOrder.map(boardId => boards[boardId] && (
            <Board
              key={boardId}
              boardId={boardId}
              board={boards[boardId]}
            />
          ))}
          <button
            onClick={() => kanban.addBoard()}
            className={`add-board-btn w-full py-3 rounded-xl border-2 border-dashed text-sm font-medium border-[var(--border-default)] text-[var(--text-disabled)] hover:border-[var(--border-strong)] hover:text-[var(--text-muted)] hover:bg-[var(--surface-tertiary)]`}
          >
            <Plus size={15} className="inline mr-1 -mt-0.5" /> Add Board
          </button>
        </div>
          </>
        )}
      </div>

      {/* ---- Focus Overlay Stack ---- */}
      {stack.map((entry, depth) => {
        const task = resolveTask(entry);
        return (
          <TaskOverlay
            key={depth}
            entry={entry}
            depth={depth}
            totalDepth={stack.length}
            isTop={depth === stack.length - 1}
            task={task}
            boardId={entry.boardId}
            columnId={entry.columnId}
          />
        );
      })}

      {/* Toasts */}
      {deletedSubtask && !deletedTask && (
        <div className="undo-toast">
          <span>Subtask deleted</span>
          <button onClick={undoDeleteSubtask}>Undo</button>
          <span className="text-gray-500 text-xs">or Ctrl+Z</span>
        </div>
      )}
      {undoNotification && !deletedTask && (
        <div className="undo-toast"><span>{undoNotification}</span></div>
      )}
      {deletedTask && (
        <div className="undo-toast">
          <span>Task deleted</span>
          <button onClick={undoDelete}>Undo</button>
          <span className="text-gray-500 text-xs">or Ctrl+Z</span>
        </div>
      )}

      {/* Global Context Menu */}
      <ContextMenu />
    </div>
  );
};

const KanbanBoard = () => (
  <KanbanProvider>
    <ContextMenuProvider>
      <FocusProvider>
        <KanbanBoardInner />
      </FocusProvider>
    </ContextMenuProvider>
  </KanbanProvider>
);

export default KanbanBoard;
