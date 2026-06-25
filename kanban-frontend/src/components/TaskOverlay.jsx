import React, { useState, useEffect, useRef } from 'react';
import { X, ArrowLeft, Edit3, Calendar } from 'lucide-react';
import { useFocus } from '../contexts/FocusContext';
import { useKanbanContext } from '../contexts/KanbanContext';
import SubtaskBoard from './SubtaskBoard';
import ReferenceEditor from './ReferenceEditor';
import InlineEdit from './InlineEdit';
import { getTaskPriorityBadge } from '../utils/priorityBadges';

const isWaitingColumn = (title) => /waiting|hold|block|review/i.test(title || '');

const removeLinkFromText = (text, url) => {
  // eslint-disable-next-line no-useless-escape
  const escapedUrl = url.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
  const mdRegex = new RegExp(`\\[[^\\]]*\\]\\(${escapedUrl}\\)`, 'g');
  let clean = text.replace(mdRegex, '');
  const plainRegex = new RegExp(escapedUrl, 'g');
  clean = clean.replace(plainRegex, '');
  return clean.replace(/ {2,}/g, ' ').trim();
};

/**
 * TaskOverlay — the fly-out card detail view.
 * Renders one level of the focus stack. Multiple instances stack with progressive dimming.
 */
const TaskOverlay = ({
  entry, depth, totalDepth, isTop,
  task, boardId, columnId,
}) => {
  const kanban = useKanbanContext();
  const {
    isDarkMode,
    boards,
    updateTask: onUpdate,
    updateTaskWaitingOn: onUpdateWaitingOn,
    updateTaskReferences: onUpdateReferences,
    updateTaskDueDate: onUpdateDueDate,
    getTaskProgress,
  } = kanban;
  const { goBack, closeAll, openTask } = useFocus();
  const [phase, setPhase] = useState('entering');
  const overlayRef = useRef(null);
  const editInlineRef = useRef(null);

  // Two-frame mount for CSS transition trigger
  useEffect(() => {
    const raf1 = requestAnimationFrame(() => {
      const raf2 = requestAnimationFrame(() => setPhase('entered'));
      return () => cancelAnimationFrame(raf2);
    });
    return () => cancelAnimationFrame(raf1);
  }, []);

  // Focus management: focus on open, return focus on close, and trap focus
  useEffect(() => {
    if (isTop && overlayRef.current) {
      const previouslyFocusedElement = document.activeElement;
      overlayRef.current.focus();

      const handleKeyDown = (e) => {
        if (e.key !== 'Tab') return;

        const focusableElements = overlayRef.current.querySelectorAll(
          'a[href], area[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), iframe, object, embed, [tabindex="0"], [contenteditable]'
        );

        if (focusableElements.length === 0) return;

        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === firstElement || document.activeElement === overlayRef.current) {
            e.preventDefault();
            lastElement.focus();
          }
        } else {
          if (document.activeElement === lastElement) {
            e.preventDefault();
            firstElement.focus();
          }
        }
      };

      window.addEventListener('keydown', handleKeyDown);
      return () => {
        window.removeEventListener('keydown', handleKeyDown);
        if (previouslyFocusedElement && typeof previouslyFocusedElement.focus === 'function') {
          previouslyFocusedElement.focus();
        }
      };
    }
  }, [isTop]);

  if (!task) return null;

  // Calculate FLIP origin transform from source card rect
  const { sourceRect } = entry;
  let originStyle = {};
  if (sourceRect && phase === 'entering') {
    const screenCX = window.innerWidth / 2;
    const screenCY = window.innerHeight / 2;
    const srcCX = sourceRect.left + sourceRect.width / 2;
    const srcCY = sourceRect.top + sourceRect.height / 2;
    const offsetX = srcCX - screenCX;
    const offsetY = srcCY - screenCY;
    const targetW = Math.min(window.innerWidth * 0.88, 680);
    const scale = Math.max(sourceRect.width / targetW, 0.25);
    originStyle = {
      transform: `translate(calc(-50% + ${offsetX}px), calc(-50% + ${offsetY}px)) scale(${scale})`,
      opacity: 0.4,
    };
  }

  // Depth-based visibility
  const distFromTop = totalDepth - 1 - depth;
  let layerOpacity = 1;
  let layerPointer = 'auto';
  if (distFromTop === 1) {
    layerOpacity = 0.2;
    layerPointer = 'none';
  } else if (distFromTop >= 2) {
    layerOpacity = 0;
    layerPointer = 'none';
  }

  const progress = getTaskProgress ? getTaskProgress(task) : null;
  const priorityBadge = getTaskPriorityBadge(task);

  const isSubtaskLevel = (entry.subtaskPath || []).length > 0;
  const overlayClassName = `task-overlay ${phase} ${
    isSubtaskLevel ? 'task-overlay--nested' : 'task-overlay--root'
  }`;

  const board = boards[boardId];
  const columnTitle = board?.columnTitles?.[columnId];
  const showWaiting = isWaitingColumn(columnTitle) || !!task.waitingOn || isSubtaskLevel;


  // Handler for subtask pill clicks — drill deeper
  const handleSubtaskFocus = (subtask, subColId, pillRect) => {
    openTask({
      boardId,
      columnId,
      taskId: task.id,
      subtaskPath: [...(entry.subtaskPath || []), { colId: subColId, subtaskId: subtask.id }],
      _resolvedTask: subtask, // pass the subtask object for deep levels
    }, pillRect);
  };

  const extractUrls = (text) => {
    const links = [];
    let clean = text;
    const mdRe = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g;
    clean = clean.replace(mdRe, (_, title, url) => { links.push({ title, url }); return ''; });
    const urlRe = /(https?:\/\/[^\s]+)/g;
    clean = clean.replace(urlRe, (_, url) => { links.push({ title: null, url }); return ''; });
    return { links, text: clean.trim() };
  };

  const { links, text: cleanText } = extractUrls(task.text || '');

  return (
    <>
      {/* Backdrop — only the topmost overlay renders one */}
      {isTop && (
        <div
          className={`overlay-backdrop ${phase === 'entered' ? 'visible' : ''}`}
          style={{ zIndex: 1000 + depth * 10 }}
          onClick={closeAll}
        />
      )}

      {/* Overlay card */}
      <div
        ref={overlayRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="task-overlay-title"
        tabIndex={-1}
        className={overlayClassName}
        style={{
          zIndex: 1001 + depth * 10,
          opacity: layerOpacity,
          pointerEvents: layerPointer,
          ...(phase === 'entering' ? originStyle : {}),
          transition: phase === 'entering' ? 'none' : undefined,
          outline: 'none',
        }}
      >
        {/* Header bar */}
        <div className="overlay-header">
          <div className="overlay-nav">
            {depth > 0 ? (
              <button onClick={goBack} className="overlay-btn" title="Go back" aria-label="Go back">
                <ArrowLeft size={16} />
              </button>
            ) : (
              <div />
            )}
            <div className="overlay-breadcrumb">
              {isSubtaskLevel && (
                <span className="overlay-crumb-parent">Subtask</span>
              )}
            </div>
            <button onClick={goBack} className="overlay-btn" title="Close (Esc)" aria-label="Close task overlay">
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className={`overlay-body ${priorityBadge ? 'has-overlay-priority-rank' : ''}`}>
          {priorityBadge && (
            <span
              className={`task-priority-rank overlay-priority-rank task-priority-rank-${priorityBadge.kind} ${
                priorityBadge.isTopPriority ? 'task-priority-rank-top' : ''
              }`}
              title={priorityBadge.title}
              aria-label={priorityBadge.ariaLabel}
              data-priority-rank={priorityBadge.rank}
            >
              {priorityBadge.rank}
            </span>
          )}

          {/* Title area */}
          <div className="overlay-title-row">
            {task.color && (
              <span className="overlay-color-dot" style={{ background: task.color }} />
            )}
            <InlineEdit
              ref={editInlineRef}
              value={task.text}
              onSave={(val) => onUpdate(boardId, columnId, task.id, val, entry.subtaskPath)}
              as="h2"
              labelId="task-overlay-title"
              textClassName="overlay-title"
              className={`overlay-title-input`}
              isEditable={isTop}
              placeholder="Enter title..."
              renderText={() => cleanText || task.text}
            />
            {isTop && (
              <button
                className="overlay-edit-btn"
                onClick={() => editInlineRef.current?.startEditing()}
                aria-label="Edit title"
              >
                <Edit3 size={14} />
              </button>
            )}
          </div>

          {/* Meta row */}
          <div className="overlay-meta">
            <span className="overlay-date">{task.createdAt}</span>

            {progress && (
              <span className="overlay-progress">
                {progress.done}/{progress.total} done
              </span>
            )}
            <div className="flex items-center gap-1.5 bg-[var(--surface-tertiary)] text-[var(--text-muted)] px-2 py-1 rounded-md text-xs font-medium">
              <Calendar size={12} className="text-gray-400" />
              <input
                type="date"
                value={task.dueDate || ''}
                onChange={(e) => {
                  if (onUpdateDueDate) {
                    onUpdateDueDate(boardId, columnId, task.id, e.target.value, entry.subtaskPath);
                  }
                }}
                className="bg-transparent border-none outline-none focus:ring-0 p-0"
              />
            </div>
          </div>

          {showWaiting && (
            <div className="overlay-waiting-banner mb-5 flex items-center gap-2 p-2.5 rounded-lg border border-dashed bg-amber-500/5 border-amber-500/25">
              <span className="relative flex h-2 w-2 flex-shrink-0 animate-pulse">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
              </span>
              <span className="text-xs font-semibold text-amber-600 dark:text-amber-400 flex-shrink-0">Waiting for</span>
              <input
                type="text"
                defaultValue={task.waitingOn || ''}
                placeholder="something..."
                key={task.waitingOn}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') e.target.blur();
                }}
                onBlur={(e) => {
                  if (onUpdateWaitingOn) {
                    onUpdateWaitingOn(boardId, columnId, task.id, e.target.value, entry.subtaskPath);
                  }
                }}
                className="text-xs font-medium text-amber-700 dark:text-amber-300 bg-transparent border-none outline-none focus:ring-0 flex-1 p-0 cursor-text"
              />
            </div>
          )}

          {/* Links */}
          {links.length > 0 && (
            <div className="overlay-links">
              {links.map((link, i) => {
                let domain = link.url;
                try { domain = new URL(link.url).hostname; } catch(e) {}
                return (
                  <div
                    key={i}
                    className={`overlay-link group/link-item flex items-center justify-between`}
                    style={{ paddingRight: '4px' }}
                  >
                    <a
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-inherit no-underline"
                    >
                      <img
                        src={`https://www.google.com/s2/favicons?domain=${domain}&sz=64`}
                        alt=""
                        className="overlay-link-icon"
                      />
                      <span className="truncate max-w-[150px]">{link.title || domain}</span>
                    </a>
                    {isTop && (
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          const newText = removeLinkFromText(task.text, link.url);
                          onUpdate(boardId, columnId, task.id, newText, entry.subtaskPath);
                        }}
                        className="p-1 rounded hover:bg-red-500/20 text-gray-400 hover:text-red-400 opacity-0 group-hover/link-item:opacity-100 transition-opacity ml-1"
                        title="Remove link"
                        aria-label="Remove link"
                      >
                        <X size={10} />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Subtask board */}
          {isTop && (
            <div className="overlay-subtask-section">
              <div className="overlay-section-header">
                <h3>{isSubtaskLevel ? 'Sub-subtasks' : 'Subtasks'}</h3>
                {progress && (
                  <span className="overlay-section-count">{progress.done}/{progress.total}</span>
                )}
              </div>
              <SubtaskBoard
                task={task}
                boardId={boardId}
                columnId={columnId}
                topLevelTaskId={entry.taskId}
                subtaskPath={entry.subtaskPath}
                onSubtaskFocus={handleSubtaskFocus}
                isOverlay={true}
              />
            </div>
          )}

          {/* References — mini CMS editor */}
          {isTop && (
            <ReferenceEditor
              value={task.references || ''}
              isDarkMode={isDarkMode}
              disabled={!isTop}
              onSave={(html) => {
                if (onUpdateReferences) {
                  onUpdateReferences(boardId, columnId, task.id, html, entry.subtaskPath);
                }
              }}
            />
          )}
        </div>
      </div>
    </>
  );
};

export default TaskOverlay;
