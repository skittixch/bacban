import React, { useState, useRef, useEffect } from 'react';
import { Plus, X, GripVertical, Check, ChevronRight } from 'lucide-react';
import { useKanbanContext } from '../contexts/KanbanContext';
import InlineEdit from './InlineEdit';

const SubtaskBoard = ({
  task, boardId, columnId, topLevelTaskId, subtaskPath,
  onSubtaskFocus, // callback for drill-in (overlay mode)
  isOverlay, // renders bigger when inside overlay
}) => {
  const kanban = useKanbanContext();
  const {
    addSubtask: onAddSubtask,
    deleteSubtask: onDeleteSubtask,
    updateSubtask: onUpdateSubtask,
    moveSubtask: onMoveSubtask,
    reorderSubtask: onReorderSubtask,
  } = kanban;
  const targetTaskId = topLevelTaskId || task.id;
  const [newText, setNewText] = useState('');
  const [addingToCol, setAddingToCol] = useState(null);
  const [dragSub, setDragSub] = useState(null);
  const [dragFromCol, setDragFromCol] = useState(null);
  const [dragSubIndex, setDragSubIndex] = useState(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (addingToCol && inputRef.current) inputRef.current.focus();
  }, [addingToCol]);

  const subtasks = task.subtasks || {
    columns: ['todo', 'doing', 'done'],
    columnTitles: { todo: 'To Do', doing: 'Doing', done: 'Done' },
    items: { todo: [], doing: [], done: [] },
  };
  const { columns, columnTitles, items } = subtasks;

  const handleSubDragStart = (e, sub, colId, index) => {
    e.stopPropagation();
    setDragSub(sub);
    setDragFromCol(colId);
    setDragSubIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    if (e.currentTarget) e.dataTransfer.setDragImage(e.currentTarget, e.currentTarget.offsetWidth / 2, 12);
  };

  const handleSubDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleSubDrop = (e, targetColId, targetIndex) => {
    e.preventDefault();
    e.stopPropagation();
    if (!dragSub || dragFromCol === null) return;
    if (dragFromCol === targetColId) {
      if (dragSubIndex !== targetIndex) onReorderSubtask(boardId, columnId, targetTaskId, targetColId, dragSubIndex, targetIndex, subtaskPath);
    } else {
      onMoveSubtask(boardId, columnId, targetTaskId, dragFromCol, targetColId, dragSub.id, targetIndex, subtaskPath);
    }
    setDragSub(null); setDragFromCol(null); setDragSubIndex(null);
  };

  const handleSubDragEnd = () => { setDragSub(null); setDragFromCol(null); setDragSubIndex(null); };

  const handleAddSubmit = (colId) => {
    if (newText.trim()) onAddSubtask(boardId, columnId, targetTaskId, colId, newText, subtaskPath);
    setNewText('');
    setAddingToCol(null);
  };


  const isLastCol = (colId) => colId === columns[columns.length - 1];

  const handlePillClick = (e, sub, colId) => {
    if (!onSubtaskFocus) return;
    if (e.target.closest('button') || e.target.closest('input')) return;
    const rect = e.currentTarget.getBoundingClientRect();
    onSubtaskFocus(sub, colId, { top: rect.top, left: rect.left, width: rect.width, height: rect.height });
  };

  return (
    <div
      className={`subtask-board ${isOverlay ? 'overlay-mode' : ''}`}
      style={{ '--subtask-column-count': columns.length }}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="subtask-columns">
        {columns.map((colId) => {
          const colItems = items[colId] || [];
          const isDone = isLastCol(colId);
          return (
            <div
              key={colId}
              className={`subtask-column`}
              onDragOver={handleSubDragOver}
              onDrop={(e) => handleSubDrop(e, colId, colItems.length)}
            >
              <div className="subtask-col-header">
                <span className="subtask-col-title">{columnTitles[colId]}</span>
                <span className="subtask-col-count">{colItems.length}</span>
              </div>

              <div className="subtask-items">
                {colItems.map((sub, subIdx) => (
                  <div
                    key={sub.id}
                    draggable
                    onDragStart={(e) => handleSubDragStart(e, sub, colId, subIdx)}
                    onDragOver={handleSubDragOver}
                    onDrop={(e) => handleSubDrop(e, colId, subIdx)}
                    onDragEnd={handleSubDragEnd}
                    onClick={(e) => handlePillClick(e, sub, colId)}
                    className={`subtask-pill ${isDone ? 'done' : ''} ${
                      dragSub?.id === sub.id ? 'dragging' : ''
                    } ${onSubtaskFocus ? 'clickable' : ''}`}
                  >
                    <>
                      <GripVertical size={10} className="subtask-grip" />
                      {isDone && <Check size={11} className="subtask-check" />}
                      <InlineEdit
                        value={sub.text}
                        onSave={(val) => onUpdateSubtask(boardId, columnId, targetTaskId, colId, sub.id, val, subtaskPath)}
                        trigger="doubleClick"
                        as="span"
                        textClassName={`subtask-text ${isDone ? 'line-through' : ''}`}
                        className={`subtask-edit-input`}
                        placeholder="Rename subtask..."
                        inputProps={{ onClick: (e) => e.stopPropagation() }}
                      />
                      {onSubtaskFocus && (
                        <ChevronRight size={10} className="subtask-drill-icon" />
                      )}
                      <button
                        className="subtask-delete"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteSubtask(boardId, columnId, targetTaskId, colId, sub.id, subtaskPath);
                        }}
                        aria-label={`Delete subtask ${sub.text}`}
                      >
                        <X size={10} />
                      </button>
                    </>
                  </div>
                ))}

                {colItems.length === 0 && (
                  <div
                    className={`subtask-empty`}
                    onClick={() => setAddingToCol(colId)}
                    onDragOver={handleSubDragOver}
                    onDrop={(e) => handleSubDrop(e, colId, 0)}
                  >
                    Drop here
                  </div>
                )}
              </div>

              {addingToCol === colId ? (
                <div className="subtask-add-form">
                  <input
                    ref={inputRef}
                    type="text"
                    value={newText}
                    onChange={(e) => setNewText(e.target.value)}
                    placeholder="Subtask..."
                    className={`subtask-add-input`}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        if (newText.trim()) {
                          onAddSubtask(boardId, columnId, targetTaskId, colId, newText, subtaskPath);
                          setNewText('');
                        } else {
                          setAddingToCol(null);
                        }
                      }
                      if (e.key === 'Escape') { setNewText(''); setAddingToCol(null); }
                    }}
                    onBlur={() => handleAddSubmit(colId)}
                  />
                </div>
              ) : (
                <button
                  className={`subtask-add-btn`}
                  onClick={() => setAddingToCol(colId)}
                  aria-label={`Add subtask to ${columnTitles[colId]}`}
                >
                  <Plus size={isOverlay ? 13 : 11} />
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default SubtaskBoard;
