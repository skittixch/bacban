import React, { useState, useRef, useEffect } from 'react';
import { Plus, ChevronUp, ChevronDown, Trash2, X } from 'lucide-react';
import { useKanbanContext } from '../contexts/KanbanContext';
import { useContextMenu } from '../contexts/ContextMenuContext';
import TaskCard from './TaskCard';
import InlineEdit from './InlineEdit';

const Board = ({ boardId, board }) => {
  const kanban = useKanbanContext();
  const { showContextMenu } = useContextMenu();
  const {
    isDarkMode, boardOrder, dragState,
    handleBoardDragStart: onBoardDragStart,
    handleBoardDragOver: onBoardDragOver,
    handleBoardDragEnd: onBoardDragEnd,
    handleColumnDragStart: onColumnDragStart,
    handleColumnDragOver: onColumnDragOver,
    handleColumnDragEnd: onColumnDragEnd,
    addTask: onAddTask,
    updateColumnTitle: onUpdateColumnTitle,
    updateBoardTitle: onUpdateBoardTitle,
    toggleBoardCollapsed: onToggleCollapsed,
    deleteBoard: onDeleteBoard,
    addColumn: onAddColumn,
    deleteColumn: onDeleteColumn,
    handleDrop: onTaskDrop,
    handleDragOver: onDragOver,
  } = kanban;

  const draggedBoardId = dragState.boardId;
  const draggedColumn = dragState.column;
  const draggedColumnBoard = dragState.board;
  const [showNewTaskInput, setShowNewTaskInput] = useState(null);
  const [newTaskText, setNewTaskText] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const inputRef = useRef(null);

  useEffect(() => {
    if (showNewTaskInput && inputRef.current) inputRef.current.focus();
  }, [showNewTaskInput]);

  const columns = board.columnOrder.map(columnId => ({
    id: columnId,
    title: board.columnTitles[columnId],
    tasks: board.tasks[columnId] || [],
  }));


  // Styles now handled automatically by .board-column and .board-container token CSS classes

  const getColumnPosition = (index) => {
    if (columns.length === 1) return 'only';
    if (index === 0) return 'first';
    if (index === columns.length - 1) return 'last';
    return 'middle';
  };

  const getAccentColor = (index) => {
    const pos = getColumnPosition(index);
    if (pos === 'last') return '#22c55e';
    if (pos === 'middle' || pos === 'only') return '#f59e0b';
    return '#94a3b8';
  };

  return (
    <div
      className="board-section mb-5 fade-in"
      draggable
      onDragStart={(e) => onBoardDragStart(e, boardId)}
      onDragOver={(e) => onBoardDragOver(e, boardId)}
      onDragEnter={(e) => { e.preventDefault(); e.stopPropagation(); }}
      onDragEnd={onBoardDragEnd}
    >
      <div className={`board-container ${
        draggedBoardId === boardId ? 'opacity-40 rotate-1 scale-[0.98]' : ''
      }`}
        style={{ backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' }}
      >
        {/* Board Header */}
        <div className={`px-5 py-3.5 border-b border-[var(--border-default)] cursor-move`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <InlineEdit
                value={board.title}
                onSave={(val) => onUpdateBoardTitle(boardId, val)}
                as="h2"
                trigger="doubleClick"
                textClassName={`text-lg font-bold themed-text-hover transition-colors text-[var(--text-primary)]`}
                className={`text-lg font-bold bg-transparent border-b-2 themed-border focus:outline-none text-[var(--text-primary)]`}
                placeholder="Rename board..."
              />
            </div>

            <div className="flex items-center space-x-1.5">
              {boardOrder.length > 1 && (
                showDeleteConfirm ? (
                  <div className="flex items-center space-x-1.5 mr-1">
                    <span className="text-xs text-red-400">Delete?</span>
                    <button
                      onClick={() => onDeleteBoard(boardId)}
                      className="px-2 py-0.5 text-xs bg-red-500/90 text-white rounded-md hover:bg-red-600 transition-colors"
                    >
                      Yes
                    </button>
                    <button
                      onClick={() => setShowDeleteConfirm(false)}
                      className={`px-2 py-0.5 text-xs rounded-md transition-colors bg-[var(--surface-tertiary)] text-[var(--text-primary)] hover:bg-[var(--surface-sunken)]`}
                    >
                      No
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setShowDeleteConfirm(true)}
                    className="p-1.5 rounded-lg text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition-all"
                    title="Delete board"
                    aria-label="Delete board"
                  >
                    <Trash2 size={16} />
                  </button>
                )
              )}
              <button
                onClick={() => onToggleCollapsed(boardId)}
                className={`p-1.5 rounded-lg transition-all text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-tertiary)]`}
                title={board.collapsed ? 'Expand' : 'Collapse'}
                aria-label={board.collapsed ? 'Expand board' : 'Collapse board'}
              >
                {board.collapsed ? <ChevronDown size={18} /> : <ChevronUp size={18} />}
              </button>
            </div>
          </div>
        </div>

        {/* Board Content */}
        <div className={`overflow-hidden transition-all duration-300 ease-in-out ${
          board.collapsed ? 'max-h-0 opacity-0' : 'max-h-[4000px] opacity-100'
        }`}>
          {!board.collapsed && (
            <div className="p-4">
              <div className="flex gap-4 overflow-x-auto">
                {columns.map((column, index) => (
                  <div
                    key={column.id}
                    draggable
                    onDragStart={(e) => onColumnDragStart(e, column.id, boardId, index)}
                    onDragOver={(e) => onColumnDragOver(e, index, boardId)}
                    onDragEnter={(e) => { e.preventDefault(); e.stopPropagation(); }}
                    onDragEnd={onColumnDragEnd}
                    className={`board-column p-3.5 flex-1 min-w-[220px] flex flex-col group/col
                      ${draggedColumn === column.id && draggedColumnBoard === boardId ? 'opacity-40 rotate-1 scale-95' : ''}
                    `}
                  >
                    {/* Column accent bar */}
                    <div
                      className="column-header-accent"
                      style={{ background: getAccentColor(index) }}
                    />

                    {/* Column header */}
                    <div className="flex justify-between items-center mb-3 flex-shrink-0">
                      <InlineEdit
                        value={column.title}
                        onSave={(val) => onUpdateColumnTitle(boardId, column.id, val)}
                        as="h3"
                        trigger="doubleClick"
                        textClassName={`text-sm font-semibold themed-text-hover transition-colors text-[var(--text-primary)]`}
                        className={`text-sm font-semibold bg-transparent border-b-2 themed-border focus:outline-none flex-1 mr-2 text-[var(--text-primary)]`}
                        placeholder="Rename column..."
                      />

                      <div className="flex items-center space-x-1">
                        <button
                          onClick={() => setShowNewTaskInput(column.id)}
                          className="p-1 rounded themed-bg-light-hover text-gray-400 themed-text-hover transition-all"
                          title="Add task"
                          aria-label={`Add task to ${column.title}`}
                        >
                          <Plus size={15} />
                        </button>
                        {columns.length > 1 && (
                          <button
                            onClick={() => {
                              if (window.confirm('Are you sure you want to delete this column and all its tasks?')) {
                                onDeleteColumn(boardId, column.id);
                              }
                            }}
                            className="p-1 rounded hover:bg-red-500/10 text-gray-400 hover:text-red-400 transition-all opacity-0 group-hover/col:opacity-100"
                            title="Remove column"
                            aria-label={`Remove column ${column.title}`}
                          >
                            <X size={13} />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* New task input */}
                    {showNewTaskInput === column.id && (
                      <div className="mb-3 flex-shrink-0">
                        <input
                          ref={inputRef}
                          type="text"
                          value={newTaskText}
                          onChange={(e) => setNewTaskText(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              if (newTaskText.trim()) {
                                onAddTask(boardId, column.id, newTaskText);
                                setNewTaskText('');
                              } else {
                                setShowNewTaskInput(null);
                              }
                            }
                            if (e.key === 'Escape') {
                              setNewTaskText('');
                              setShowNewTaskInput(null);
                            }
                          }}
                          onBlur={() => {
                            if (newTaskText.trim()) {
                              onAddTask(boardId, column.id, newTaskText);
                            }
                            setNewTaskText('');
                            setShowNewTaskInput(null);
                          }}
                          placeholder="Enter task..."
                          className={`w-full p-2 text-sm border rounded-lg themed-ring focus:border-transparent bg-[var(--surface-input)] border-[var(--border-default)] text-[var(--text-primary)] placeholder-[var(--text-disabled)]`}
                        />
                      </div>
                    )}

                    {/* Tasks list */}
                    <div
                      className="flex-1 space-y-2 overflow-y-auto max-h-[60vh] min-h-[60px]"
                      onDragOver={onDragOver}
                      onDragEnter={(e) => { e.preventDefault(); e.stopPropagation(); }}
                      onDrop={(e) => onTaskDrop(e, boardId, column.id)}
                      onDoubleClick={(e) => {
                        if (e.target === e.currentTarget) {
                          setShowNewTaskInput(column.id);
                        }
                      }}
                      onContextMenu={(e) => {
                        showContextMenu(e, [
                          {
                            label: 'Add Task',
                            icon: <Plus size={14} />,
                            onClick: () => setShowNewTaskInput(column.id)
                          }
                        ]);
                      }}
                    >
                      {column.tasks.length === 0 ? (
                        <div
                          className="column-empty cursor-pointer"
                          onClick={() => setShowNewTaskInput(column.id)}
                          onDragOver={onDragOver}
                          onDragEnter={(e) => { e.preventDefault(); e.stopPropagation(); }}
                          title="Click to add a task"
                        >
                          + Add a task
                        </div>
                      ) : (
                        column.tasks.map((task, taskIndex) => (
                          <TaskCard
                            key={task.id}
                            task={task}
                            boardId={boardId}
                            columnId={column.id}
                            columnPosition={getColumnPosition(index)}
                            columnTitle={column.title}
                            taskIndex={taskIndex}
                          />
                        ))
                      )}
                    </div>
                  </div>
                ))}

                {/* Add column button */}
                <button
                  onClick={() => onAddColumn(boardId)}
                  className={`add-column-btn min-w-[50px] rounded-lg border-2 border-dashed flex items-center justify-center border-[var(--border-default)] text-[var(--text-disabled)] hover:border-[var(--border-strong)] hover:text-[var(--text-muted)]`}
                  title="Add column"
                  aria-label="Add column to board"
                >
                  <Plus size={22} />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Board;
