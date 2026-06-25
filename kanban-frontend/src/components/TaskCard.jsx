import React, { useState, useRef } from 'react';
import { Edit3, Trash2, Calendar, Copy, Palette } from 'lucide-react';
import { useFocus } from '../contexts/FocusContext';
import { useKanbanContext } from '../contexts/KanbanContext';
import { useContextMenu } from '../contexts/ContextMenuContext';
import InlineEdit from './InlineEdit';

const ProgressRing = ({ done, total, size = 22 }) => {
  const r = (size - 4) / 2;
  const circumference = 2 * Math.PI * r;
  const pct = total > 0 ? done / total : 0;
  const offset = circumference * (1 - pct);
  const allDone = done === total && total > 0;

  return (
    <div className="progress-ring-wrap" title={`${done}/${total} done`}>
      <svg width={size} height={size} className="progress-ring-svg">
        <circle
          cx={size / 2} cy={size / 2} r={r}
          fill="none" stroke="currentColor" strokeWidth={2} opacity={0.15}
        />
        <circle
          cx={size / 2} cy={size / 2} r={r}
          fill="none"
          stroke={allDone ? '#22c55e' : 'var(--theme-primary)'}
          strokeWidth={2}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: 'stroke-dashoffset 0.4s ease' }}
        />
      </svg>
      <span className={`progress-ring-label ${allDone ? 'all-done' : ''}`}>
        {done}/{total}
      </span>
    </div>
  );
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

const parseCalendarDate = (value) => {
  if (!value) return null;
  if (value instanceof Date) {
    const time = value.getTime();
    return Number.isNaN(time) ? null : time;
  }
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;

  const normalized = String(value).trim();
  if (!normalized) return null;

  const dateOnly = normalized.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (dateOnly) {
    const [, year, month, day] = dateOnly;
    return new Date(Number(year), Number(month) - 1, Number(day)).getTime();
  }

  const parsed = Date.parse(normalized);
  return Number.isNaN(parsed) ? null : parsed;
};

const clampPercent = (value) => Math.min(100, Math.max(0, value));

const getTimelineProgress = (dateAdded, dueDate, currentDate = new Date()) => {
  const start = parseCalendarDate(dateAdded);
  const end = parseCalendarDate(dueDate);
  const current = parseCalendarDate(currentDate);

  if (!end || !current) return 0;
  if (!start || end <= start) return current >= end ? 100 : 0;

  return clampPercent(((current - start) / (end - start)) * 100);
};

const TaskCard = ({
  task, boardId, columnId, columnPosition, columnTitle, taskIndex, disableNativeDrag = false,
}) => {
  const kanban = useKanbanContext();
  const {
    dragState,
    handleDragStart: onDragStart,
    handleTaskDragOver: onDragOver,
    handleDragEnd: onDragEnd,
    deleteTask: onDelete,
    updateTask: onUpdate,
    updateTaskColor: onUpdateColor,
    updateTaskWaitingOn: onUpdateWaitingOn,
    updateTaskDueDate: onUpdateDueDate,
    duplicateTask: onDuplicateTask,
    getTaskProgress,
    projectColors,
    settings,
  } = kanban;
  const { showContextMenu } = useContextMenu();

  const isDragging = dragState.board === boardId && dragState.task?.id === task.id;
  const isDropTarget =
    dragState.overTaskIndex === taskIndex &&
    dragState.overTarget?.boardId === boardId &&
    dragState.overTarget?.columnId === columnId;
  const { openTask } = useFocus();
  const [isColorPickerOpen, setIsColorPickerOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const cardRef = useRef(null);
  const editInlineRef = useRef(null);

  const accentClass = `task-accent-${columnPosition}`;
  const changedAt = parseTaskTime(task.updatedAt) || parseTaskTime(task.createdAt);
  const isRecentlyChanged = Boolean(changedAt && Date.now() - changedAt <= RECENT_CHANGE_WINDOW_MS);
  const isAttentionCard = !task.doneAt && (
    Boolean(task.waitingOn) ||
    isWaitingColumn(columnTitle) ||
    isDueSoonOrOverdue(task.dueDate)
  );

  let opacity = 1;
  const completedTaskRetentionDays = Number(settings?.completedTaskRetentionDays ?? 3);
  const completionFadeEnabled = settings?.completedTaskFade !== false;

  if (completionFadeEnabled && completedTaskRetentionDays > 0 && task.doneAt) {
    const doneAt = parseTaskTime(task.doneAt);
    if (doneAt) {
      const daysOld = (Date.now() - doneAt) / (1000 * 60 * 60 * 24);
      opacity = Math.max(0.08, 1 - (daysOld / completedTaskRetentionDays));
    }
  }

  const progress = getTaskProgress ? getTaskProgress(task) : null;
  const hasDueDate = Boolean(String(task.dueDate || '').trim());
  const timelinePercent = hasDueDate
    ? getTimelineProgress(task.dateAdded || task.createdAt, task.dueDate)
    : 0;


  const clickTimeout = useRef(null);

  const handleCardClick = (e) => {
    if (
      e.target.closest('button') || e.target.closest('a') ||
      e.target.closest('input') || e.target.closest('textarea')
    ) return;
    
    if (clickTimeout.current) {
      clearTimeout(clickTimeout.current);
      clickTimeout.current = null;
    }

    if (e.detail === 1) {
      clickTimeout.current = setTimeout(() => {
        // Fly-out: capture source rect and open overlay
        const rect = cardRef.current?.getBoundingClientRect();
        openTask(
          { boardId, columnId, taskId: task.id },
          rect ? { top: rect.top, left: rect.left, width: rect.width, height: rect.height } : null,
        );
      }, 250);
    }
  };

  const extractUrls = (text) => {
    const links = [];
    let textWithoutUrls = text;
    const markdownRegex = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g;
    textWithoutUrls = textWithoutUrls.replace(markdownRegex, (_, title, url) => { links.push({ title, url }); return ''; });
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    textWithoutUrls = textWithoutUrls.replace(urlRegex, (_, url) => { links.push({ title: null, url }); return ''; });
    return { links, textWithoutUrls: textWithoutUrls.trim() };
  };

  const { links, textWithoutUrls } = extractUrls(task.text);

  const handleDragStartLocal = (e) => {
    const target = e.currentTarget;
    e.dataTransfer.effectAllowed = 'move';
    onDragStart(e, task, boardId, columnId, taskIndex);
    requestAnimationFrame(() => {
      if (target) {
        target.classList.add('task-placeholder');
      }
    });
  };

  const handleDragEndLocal = (e) => {
    e.currentTarget.classList.remove('task-placeholder');
    if (onDragEnd) onDragEnd();
  };

  return (
    <div className="flex flex-col w-full relative">
      {isDropTarget && <div className="drop-indicator-line" />}
      <div
        ref={cardRef}
        data-task-card="true"
        draggable={!disableNativeDrag}
        onDragStart={disableNativeDrag ? undefined : handleDragStartLocal}
        onDragEnd={disableNativeDrag ? undefined : handleDragEndLocal}
        onDragOver={disableNativeDrag ? undefined : (e) => onDragOver(e, taskIndex, boardId, columnId)}
        onDragEnter={(e) => { e.preventDefault(); e.stopPropagation(); }}
        onClick={handleCardClick}
        onContextMenu={(e) => {
          showContextMenu(e, [
            {
              label: 'Edit Due Date',
              icon: <Calendar size={14} />,
              onClick: () => {
                const dateInput = document.getElementById(`date-input-${task.id}`);
                if (dateInput && dateInput.showPicker) {
                  dateInput.showPicker();
                } else {
                  const val = window.prompt('Enter Due Date (YYYY-MM-DD)', task.dueDate || '');
                  if (val !== null) onUpdateDueDate(boardId, columnId, task.id, val);
                }
              }
            },
            {
              label: 'Set Project',
              icon: <Palette size={14} />,
              onClick: () => setIsColorPickerOpen(true)
            },
            {
              label: 'Duplicate Task',
              icon: <Copy size={14} />,
              onClick: () => onDuplicateTask(boardId, columnId, task.id)
            },
            { type: 'divider' },
            {
              label: 'Delete Task',
              icon: <Trash2 size={14} />,
              type: 'danger',
              onClick: () => onDelete(boardId, columnId, task.id)
            }
          ]);
        }}
        className={`relative task-card p-3 rounded-lg ${accentClass} group
          hover:shadow-md shadow-sm
          ${hasDueDate ? 'has-task-timeline' : ''}
          ${isRecentlyChanged ? 'task-card-recent' : ''}
          ${isRecentlyChanged && isAttentionCard ? 'task-card-attention' : ''}
          ${isDragging ? 'task-dragging' : ''}
          ${isDropTarget ? 'drop-target' : ''}
        `}
        data-recent-change={isRecentlyChanged ? 'true' : undefined}
        data-attention={isRecentlyChanged && isAttentionCard ? 'true' : undefined}
        style={{
          opacity,
          borderLeftColor: task.color || undefined,
          borderLeftWidth: task.color ? '3px' : undefined,
          cursor: isEditing ? 'default' : 'pointer',
        }}
      >
        {/* Waiting On Input at the top of the card if it's a waiting column */}
        {!isEditing && isWaitingColumn(columnTitle) && (
          <div className="waiting-on-bar mb-2.5 pb-2 border-b border-dashed border-amber-500/20" onClick={e => e.stopPropagation()} onDoubleClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-1.5 w-full">
              <span className="relative flex h-2 w-2 flex-shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
              </span>
              <span className="text-[11px] font-semibold text-amber-600 dark:text-amber-400 flex-shrink-0">Waiting for</span>
              <input
                type="text"
                defaultValue={task.waitingOn || ''}
                placeholder="something..."
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.target.blur();
                  }
                }}
                onBlur={(e) => {
                  onUpdateWaitingOn(boardId, columnId, task.id, e.target.value);
                }}
                className="waiting-on-input flex-1 text-[11px] font-semibold bg-transparent border-none outline-none focus:ring-0 placeholder-amber-500/40 text-amber-700 dark:text-amber-300 p-0"
              />
            </div>
          </div>
        )}

            <div className="task-card-content-grid">
              <div className="task-card-body">
                <div className="task-title-row">
                  {task.color && <span className="color-dot flex-shrink-0" style={{ background: task.color }} />}
                  <InlineEdit
                    ref={editInlineRef}
                    value={task.text}
                    onSave={(value) => onUpdate(boardId, columnId, task.id, value)}
                    onEditingChange={setIsEditing}
                    type="textarea"
                    trigger="doubleClick"
                    as="p"
                    textClassName="task-text-clamp task-title-text text-sm font-medium leading-relaxed whitespace-pre-wrap"
                    className={`task-title-input p-1.5 text-sm border rounded-lg resize-none themed-ring focus:border-transparent bg-[var(--surface-input)] border-[var(--border-default)] text-[var(--text-primary)]`}
                    inputProps={{ rows: Math.min(5, Math.ceil(task.text.length / 40)) }}
                    renderText={() => textWithoutUrls}
                  />
                </div>
                {links.length > 0 && (
                  <div className="space-y-1.5 mt-2">
                    {links.map((link, i) => {
                      let domain = link.url;
                      try { domain = new URL(link.url).hostname; } catch(e) {}
                      const displayUrl = link.url.replace(/^https?:\/\//, '').replace(/^www\./, '');
                      return (
                        <a key={i} href={link.url} target="_blank" rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className={`flex flex-col p-2 rounded-md border border-[var(--border-default)] bg-[var(--surface-tertiary)] hover:border-[var(--border-strong)] hover:bg-[var(--surface-sunken)] transition-all group/link`} title={link.url}
                        >
                          <div className="flex items-center space-x-2 overflow-hidden">
                            <img src={`https://www.google.com/s2/favicons?domain=${domain}&sz=64`} alt="" className="w-[14px] h-[14px] rounded-sm flex-shrink-0" />
                            <p className={`text-xs font-semibold truncate text-[var(--text-primary)]`}>{link.title || domain}</p>
                          </div>
                          <p className="text-[10px] truncate mt-0.5 ml-5 themed-text">{displayUrl}</p>
                        </a>
                      );
                    })}
                  </div>
                )}
              </div>
              <div className="task-card-actions">
                {progress && <ProgressRing done={progress.done} total={progress.total} />}
                <div className="opacity-0 group-hover:opacity-100 transition-opacity flex space-x-1">
                  <button onClick={(e) => { e.stopPropagation(); editInlineRef.current?.startEditing(); }}
                    className="text-gray-400 themed-text-hover transition-colors" title="Edit task" aria-label="Edit task"><Edit3 size={13} /></button>
                  <button onClick={(e) => { e.stopPropagation(); onDelete(boardId, columnId, task.id); }}
                    className="text-gray-400 hover:text-red-400 transition-colors" title="Delete task" aria-label="Delete task"><Trash2 size={13} /></button>
                </div>
              </div>
            </div>
            {hasDueDate && (
              <div
                className="task-timeline"
                aria-label={`Timeline ${timelinePercent.toFixed(2)} percent elapsed. Due ${task.dueDate}.`}
              >
                <div className="task-timeline-due">
                  <Calendar size={10} />
                  <span>{task.dueDate}</span>
                </div>
                <div className="task-timeline-track" aria-hidden="true">
                  <span style={{ width: `${timelinePercent}%` }} />
                </div>
              </div>
            )}
            <input
              type="date"
              id={`date-input-${task.id}`}
              className="absolute opacity-0 pointer-events-none -z-10 w-0 h-0"
              value={task.dueDate || ''}
              onChange={(e) => onUpdateDueDate(boardId, columnId, task.id, e.target.value)}
            />

        {/* Color picker */}
        {!isEditing && (
          <div className="absolute -bottom-2 -left-2 z-10">
            {!isColorPickerOpen ? (
              <button onClick={(e) => { e.stopPropagation(); setIsColorPickerOpen(true); }}
                className={`opacity-0 group-hover:opacity-100 w-4 h-4 rounded-full transition-all border-2 border-[var(--border-default)] bg-[var(--surface-primary)] hover:border-[var(--border-strong)]`} style={{ background: task.color || undefined }} title={task.color && projectColors ? projectColors[task.color] : "Set Project"} aria-label="Set task project" />
            ) : (
              <div className={`flex gap-1 p-1.5 rounded-lg shadow-xl z-20 bg-[var(--surface-elevated)] border-[var(--border-strong)]`} onClick={(e) => e.stopPropagation()}>
                {projectColors && Object.entries(projectColors).map(([hex, name]) => (
                  <button key={hex} onClick={(e) => { e.stopPropagation(); onUpdateColor(boardId, columnId, task.id, hex); setIsColorPickerOpen(false); }}
                    className={`w-4 h-4 rounded-full transition-transform hover:scale-125 ${
                      task.color === hex ? 'ring-2 ring-offset-1 themed-ring' : ''
                    }`}
                    style={{ background: hex }} title={name}
                    aria-label={`Set project to ${name}`} />
                ))}
                <button onClick={(e) => { e.stopPropagation(); onUpdateColor(boardId, columnId, task.id, null); setIsColorPickerOpen(false); }}
                    className={`w-4 h-4 rounded-full transition-transform hover:scale-125 bg-[var(--surface-tertiary)] border-[var(--border-default)] ${!task.color ? 'ring-2 ring-offset-1 themed-ring' : ''}`}
                    title="None"
                    aria-label="Clear project color" />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default TaskCard;
