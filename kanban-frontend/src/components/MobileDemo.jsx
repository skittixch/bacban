import React, { useEffect, useMemo, useState } from 'react';
import { Calendar, CheckCircle2, ChevronRight, Moon, Plus, Sun } from 'lucide-react';
import { useKanbanContext } from '../contexts/KanbanContext';
import { useFocus } from '../contexts/FocusContext';
import './MobileDemo.css';

const getColumns = (board) => {
  if (!board) return [];
  return board.columnOrder.map((columnId) => ({
    id: columnId,
    title: board.columnTitles[columnId] || columnId,
    tasks: board.tasks[columnId] || [],
  }));
};

const getPreferredColumnId = (columns) => (
  columns.find((column) => column.tasks.length > 0)?.id || columns[0]?.id || ''
);

const stripUrls = (text = '') => {
  const withoutMarkdownUrls = text.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '$1');
  return withoutMarkdownUrls.replace(/https?:\/\/[^\s]+/g, '').replace(/\s+/g, ' ').trim() || text;
};

const isWaitingColumn = (title) => /waiting|hold|block|review/i.test(title || '');
const RECENT_CHANGE_WINDOW_MS = 24 * 60 * 60 * 1000;

const parseTaskTime = (value) => {
  if (!value) return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? null : parsed;
};

const isDueSoonOrOverdue = (dueDate) => {
  if (!dueDate) return false;
  const due = Date.parse(`${dueDate}T23:59:59`);
  if (Number.isNaN(due)) return false;
  return due <= Date.now() + (24 * 60 * 60 * 1000);
};

const MobileTaskCard = ({ boardId, column, task, projectName, progress }) => {
  const { openTask } = useFocus();
  const progressPct = progress && progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0;
  const changedAt = parseTaskTime(task.updatedAt) || parseTaskTime(task.createdAt);
  const isRecentlyChanged = changedAt && Date.now() - changedAt <= RECENT_CHANGE_WINDOW_MS;
  const isAttentionCard = !task.doneAt && (
    Boolean(task.waitingOn) ||
    isWaitingColumn(column.title) ||
    isDueSoonOrOverdue(task.dueDate)
  );
  const cardClassName = [
    'mobile-task-card',
    isRecentlyChanged ? 'mobile-task-card-recent' : '',
    isRecentlyChanged && isAttentionCard ? 'mobile-task-card-attention' : '',
  ].filter(Boolean).join(' ');

  const handleOpen = (event) => {
    const rect = event.currentTarget.getBoundingClientRect();
    openTask(
      { boardId, columnId: column.id, taskId: task.id },
      { top: rect.top, left: rect.left, width: rect.width, height: rect.height },
    );
  };

  return (
    <button
      type="button"
      className={cardClassName}
      data-recent-change={isRecentlyChanged ? 'true' : undefined}
      data-attention={isRecentlyChanged && isAttentionCard ? 'true' : undefined}
      onClick={handleOpen}
    >
      <span className="mobile-task-accent" style={{ background: task.color || 'var(--mobile-accent-muted)' }} />
      <span className="mobile-task-content">
        <span className="mobile-task-title">{stripUrls(task.text)}</span>
        {(task.waitingOn || isWaitingColumn(column.title)) && (
          <span className="mobile-task-waiting">
            {task.waitingOn ? `Waiting: ${task.waitingOn}` : column.title}
          </span>
        )}
        <span className="mobile-task-meta">
          <span>{task.createdAt}</span>
          {projectName && <span>{projectName}</span>}
          {task.dueDate && (
            <span className="mobile-task-chip">
              <Calendar size={12} />
              {task.dueDate}
            </span>
          )}
        </span>
      </span>
      <span className="mobile-task-side">
        {progress && (
          <span
            className="mobile-progress-ring"
            style={{ '--mobile-progress': `${progressPct * 3.6}deg` }}
            aria-label={`${progress.done} of ${progress.total} subtasks complete`}
          >
            <span>{progress.done}/{progress.total}</span>
          </span>
        )}
        <ChevronRight size={18} aria-hidden="true" />
      </span>
    </button>
  );
};

const MobileDemo = () => {
  const kanban = useKanbanContext();
  const {
    boards,
    boardOrder,
    isDarkMode,
    saveStatus,
    projectColors,
    setIsDarkMode,
    addTask,
    getTaskProgress,
  } = kanban;
  const [draft, setDraft] = useState('');
  const initialBoardId = boardOrder.find((boardId) => boards[boardId]) || '';
  const [selectedBoardId, setSelectedBoardId] = useState(initialBoardId);

  const board = boards[selectedBoardId] || boards[initialBoardId];
  const resolvedBoardId = boards[selectedBoardId] ? selectedBoardId : initialBoardId;
  const columns = useMemo(() => getColumns(board), [board]);
  const [selectedColumnId, setSelectedColumnId] = useState('');

  useEffect(() => {
    if (!selectedBoardId && initialBoardId) {
      setSelectedBoardId(initialBoardId);
    }
  }, [initialBoardId, selectedBoardId]);

  useEffect(() => {
    if (!columns.length) return;
    if (!columns.some((column) => column.id === selectedColumnId)) {
      setSelectedColumnId(getPreferredColumnId(columns));
    }
  }, [columns, selectedColumnId]);

  const selectedColumn = columns.find((column) => column.id === selectedColumnId) || columns[0];
  const boardTaskCount = columns.reduce((sum, column) => sum + column.tasks.length, 0);
  const doneColumn = columns[columns.length - 1];
  const doneCount = doneColumn?.tasks.length || 0;

  const handleBoardSelect = (boardId) => {
    const nextColumns = getColumns(boards[boardId]);
    setSelectedBoardId(boardId);
    setSelectedColumnId(getPreferredColumnId(nextColumns));
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    if (!draft.trim() || !resolvedBoardId || !selectedColumn) return;
    addTask(resolvedBoardId, selectedColumn.id, draft);
    setDraft('');
  };

  return (
    <main className={`mobile-demo-screen ${isDarkMode ? 'mobile-demo-dark' : 'mobile-demo-light'}`}>
      <header className="mobile-demo-header">
        <div>
          <div className="mobile-demo-brand-row">
            <h1>BacBan</h1>
            <span className={`mobile-save-dot ${saveStatus}`} aria-label={`Save status: ${saveStatus}`} />
          </div>
          <p>{board?.title || 'Board'} / {selectedColumn?.title || 'Column'}</p>
        </div>
        <div className="mobile-demo-actions">
          <button type="button" onClick={() => setIsDarkMode((value) => !value)} aria-label="Toggle dark mode">
            {isDarkMode ? <Sun size={18} /> : <Moon size={18} />}
          </button>
        </div>
      </header>

      <section className="mobile-board-switcher" aria-label="Boards">
        {boardOrder.map((boardId) => {
          const item = boards[boardId];
          if (!item) return null;
          const itemColumns = getColumns(item);
          const itemCount = itemColumns.reduce((sum, column) => sum + column.tasks.length, 0);
          const selected = boardId === resolvedBoardId;
          return (
            <button
              key={boardId}
              type="button"
              className={selected ? 'selected' : ''}
              onClick={() => handleBoardSelect(boardId)}
            >
              <span>{item.title}</span>
              <strong>{itemCount}</strong>
            </button>
          );
        })}
      </section>

      <section className="mobile-board-summary" aria-label={`${board?.title || 'Board'} summary`}>
        <div>
          <span>Total</span>
          <strong>{boardTaskCount}</strong>
        </div>
        <div>
          <span>{doneColumn?.title || 'Done'}</span>
          <strong>{doneCount}</strong>
        </div>
        <div>
          <span>Selected</span>
          <strong>{selectedColumn?.tasks.length || 0}</strong>
        </div>
      </section>

      <nav className="mobile-column-tabs" aria-label="Columns">
        {columns.map((column) => (
          <button
            key={column.id}
            type="button"
            className={column.id === selectedColumn?.id ? 'selected' : ''}
            onClick={() => setSelectedColumnId(column.id)}
          >
            <span>{column.title}</span>
            <strong>{column.tasks.length}</strong>
          </button>
        ))}
      </nav>

      <section className="mobile-task-list" aria-label={selectedColumn?.title || 'Tasks'}>
        {selectedColumn?.tasks.length ? (
          selectedColumn.tasks.map((task) => (
            <MobileTaskCard
              key={task.id}
              boardId={resolvedBoardId}
              column={selectedColumn}
              task={task}
              projectName={task.color ? projectColors?.[task.color] : ''}
              progress={getTaskProgress ? getTaskProgress(task) : null}
            />
          ))
        ) : (
          <div className="mobile-empty-column">
            <CheckCircle2 size={20} />
            <span>No tasks in {selectedColumn?.title || 'this column'}</span>
          </div>
        )}
      </section>

      <form className="mobile-quick-add" onSubmit={handleSubmit}>
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder={selectedColumn ? `Add to ${selectedColumn.title}` : 'Add task'}
          aria-label="New task"
        />
        <button type="submit" aria-label="Add task" disabled={!draft.trim() || !selectedColumn}>
          <Plus size={20} />
        </button>
      </form>
    </main>
  );
};

export default MobileDemo;
