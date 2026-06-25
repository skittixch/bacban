import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Moon, Plus, Sun } from 'lucide-react';
import { useKanbanContext } from '../contexts/KanbanContext';
import { useContextMenu } from '../contexts/ContextMenuContext';
import TaskCard from './TaskCard';
import './MobileDemo.css';

const LONG_PRESS_MS = 650;
const SWIPE_COMMIT_PX = 136;
const SWIPE_DEAD_ZONE_PX = 10;
const MOVE_CANCEL_PX = 14;
const INTERACTIVE_SELECTOR = 'button, a, input, textarea, select, [contenteditable="true"], [role="button"]';

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const triggerTactileCue = (pattern) => {
  try {
    window.navigator?.vibrate?.(pattern);
  } catch {
    // Mobile web haptics are best-effort and ignored by some browsers.
  }
};

const getColumnPosition = (columnIndex, columnCount) => {
  if (columnCount <= 1) return 'only';
  if (columnIndex === 0) return 'first';
  if (columnIndex === columnCount - 1) return 'last';
  return 'middle';
};

const getAccentColor = (columnPosition) => {
  if (columnPosition === 'last') return '#22c55e';
  if (columnPosition === 'middle' || columnPosition === 'only') return '#f59e0b';
  return '#94a3b8';
};

const buildStackSections = (boards, boardOrder) => (
  boardOrder.flatMap((boardId, boardIndex) => {
    const board = boards[boardId];
    if (!board) return [];

    const columnOrder = board.columnOrder || [];

    return columnOrder.map((columnId, columnIndex) => {
      const previousColumnId = columnOrder[columnIndex - 1] || null;
      const nextColumnId = columnOrder[columnIndex + 1] || null;

      return {
        rank: (boardIndex * 100) + columnIndex,
        boardIndex,
        columnIndex,
        boardId,
        boardTitle: board.title || boardId,
        columnId,
        columnTitle: board.columnTitles?.[columnId] || columnId,
        previousColumnId,
        previousColumnTitle: previousColumnId ? board.columnTitles?.[previousColumnId] || previousColumnId : '',
        nextColumnId,
        nextColumnTitle: nextColumnId ? board.columnTitles?.[nextColumnId] || nextColumnId : '',
        tasks: board.tasks?.[columnId] || [],
        columnPosition: getColumnPosition(columnIndex, columnOrder.length),
      };
    });
  })
);

const MobileSwipeTaskCard = ({ task, section, taskIndex, onMove }) => {
  const pressTimerRef = useRef(null);
  const gestureRef = useRef(null);
  const suppressClickRef = useRef(false);
  const readyCueRef = useRef(false);
  const [swipe, setSwipe] = useState({
    progress: 0,
    status: 'idle',
    target: null,
    ready: false,
    blocked: false,
  });

  const hasPrevious = Boolean(section.previousColumnId);
  const hasNext = Boolean(section.nextColumnId);

  const clearPressTimer = () => {
    if (pressTimerRef.current) {
      window.clearTimeout(pressTimerRef.current);
      pressTimerRef.current = null;
    }
  };

  const resetSwipe = () => {
    setSwipe({ progress: 0, status: 'idle', target: null, ready: false, blocked: false });
  };

  const getTargetDirection = (offset) => {
    if (offset < -SWIPE_DEAD_ZONE_PX) return 'previous';
    if (offset > SWIPE_DEAD_ZONE_PX) return 'next';
    return null;
  };

  const hasTarget = (direction) => (
    direction === 'previous' ? hasPrevious : direction === 'next' ? hasNext : false
  );

  const handlePointerDown = (event) => {
    if (event.button && event.button !== 0) return;
    if (event.target.closest(INTERACTIVE_SELECTOR)) return;

    const target = event.currentTarget;
    const pointerId = event.pointerId;

    clearPressTimer();
    gestureRef.current = {
      pointerId,
      startX: event.clientX,
      startY: event.clientY,
      armed: false,
      progress: 0,
      target: null,
    };
    readyCueRef.current = false;

    pressTimerRef.current = window.setTimeout(() => {
      const gesture = gestureRef.current;
      if (!gesture || gesture.pointerId !== pointerId) return;

      gesture.armed = true;
      suppressClickRef.current = true;
      target.setPointerCapture?.(pointerId);
      setSwipe({ progress: 0, status: 'held', target: null, ready: false, blocked: false });
      triggerTactileCue([14, 24, 18]);
    }, LONG_PRESS_MS);
  };

  const handlePointerMove = (event) => {
    const gesture = gestureRef.current;
    if (!gesture || gesture.pointerId !== event.pointerId) return;

    const dx = event.clientX - gesture.startX;
    const dy = event.clientY - gesture.startY;

    if (!gesture.armed) {
      if (Math.abs(dx) > MOVE_CANCEL_PX || Math.abs(dy) > MOVE_CANCEL_PX) {
        clearPressTimer();
        gestureRef.current = null;
      }
      return;
    }

    event.preventDefault();
    const direction = getTargetDirection(dx);
    const available = hasTarget(direction);
    const progress = direction ? clamp(Math.abs(dx) / SWIPE_COMMIT_PX, 0, 1) : 0;
    const ready = Boolean(available && progress >= 1);

    if (ready && !readyCueRef.current) {
      readyCueRef.current = true;
      triggerTactileCue([10, 18, 24]);
    }

    if (!ready) {
      readyCueRef.current = false;
    }

    gesture.progress = progress;
    gesture.target = direction;
    setSwipe({
      progress,
      status: 'dragging',
      target: direction,
      ready,
      blocked: Boolean(direction && !available),
    });
  };

  const finishGesture = (event, cancelled = false) => {
    clearPressTimer();
    const gesture = gestureRef.current;
    if (!gesture || gesture.pointerId !== event.pointerId) return;

    const currentTarget = event.currentTarget;
    if (currentTarget.hasPointerCapture?.(event.pointerId)) {
      currentTarget.releasePointerCapture(event.pointerId);
    }

    if (!gesture.armed) {
      gestureRef.current = null;
      return;
    }

    event.preventDefault();
    suppressClickRef.current = true;
    gestureRef.current = null;

    const direction = gesture.target;
    const shouldCommit = !cancelled && hasTarget(direction) && gesture.progress >= 1;

    if (shouldCommit) {
      const commitPoint = {
        x: event.clientX,
        y: event.clientY,
      };

      triggerTactileCue(28);

      setSwipe({
        progress: 1,
        status: `commit-${direction}`,
        target: direction,
        ready: true,
        blocked: false,
      });

      window.setTimeout(() => {
        onMove(section.boardId, section.columnId, task.id, direction, commitPoint);
        resetSwipe();
      }, 90);
    } else {
      setSwipe({ progress: 0, status: 'settling', target: null, ready: false, blocked: false });
      if (direction && !hasTarget(direction)) {
        triggerTactileCue([8, 20, 8]);
      }
      window.setTimeout(resetSwipe, 150);
    }

    readyCueRef.current = false;

    window.setTimeout(() => {
      suppressClickRef.current = false;
    }, 360);
  };

  const handleClickCapture = (event) => {
    if (!suppressClickRef.current) return;
    event.preventDefault();
    event.stopPropagation();
  };

  const handleContextMenuCapture = (event) => {
    if (!suppressClickRef.current && !gestureRef.current?.armed) return;
    event.preventDefault();
    event.stopPropagation();
  };

  const shellClassName = [
    'mobile-swipe-shell',
    hasPrevious ? 'has-previous' : '',
    hasNext ? 'has-next' : '',
    swipe.status !== 'idle' ? `is-${swipe.status}` : '',
    swipe.target ? `swiping-${swipe.target}` : '',
    swipe.ready ? 'swipe-ready' : '',
    swipe.blocked ? 'swipe-blocked' : '',
  ].filter(Boolean).join(' ');

  return (
    <div
      className={shellClassName}
      style={{
        '--swipe-progress': swipe.progress,
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={(event) => finishGesture(event)}
      onPointerCancel={(event) => finishGesture(event, true)}
      onClickCapture={handleClickCapture}
      onContextMenuCapture={handleContextMenuCapture}
    >
      <div className="mobile-swipe-card">
        <TaskCard
          task={task}
          boardId={section.boardId}
          columnId={section.columnId}
          columnPosition={section.columnPosition}
          columnTitle={section.columnTitle}
          taskIndex={taskIndex}
          disableNativeDrag
        />
      </div>
      <div className="mobile-swipe-affordance" aria-hidden="true">
        <span className={`mobile-swipe-target previous ${swipe.target === 'previous' ? 'active' : ''} ${!hasPrevious ? 'disabled' : ''}`}>
          <ChevronLeft size={16} />
          <span>{section.previousColumnTitle || section.columnTitle}</span>
        </span>
        <span className="mobile-swipe-progress">
          <span />
        </span>
        <span className={`mobile-swipe-target next ${swipe.target === 'next' ? 'active' : ''} ${!hasNext ? 'disabled' : ''}`}>
          <span>{section.nextColumnTitle || section.columnTitle}</span>
          <ChevronRight size={16} />
        </span>
      </div>
    </div>
  );
};

const MobileDemo = () => {
  const kanban = useKanbanContext();
  const { showContextMenu } = useContextMenu();
  const {
    boards,
    boardOrder,
    isDarkMode,
    saveStatus,
    setIsDarkMode,
    addTask,
    handleDrop,
    handleDragOver,
    moveTaskToAdjacentColumn,
  } = kanban;
  const [activeInput, setActiveInput] = useState(null);
  const [draft, setDraft] = useState('');
  const firstSectionRef = useRef(null);
  const inputRef = useRef(null);

  const sections = useMemo(() => buildStackSections(boards, boardOrder), [boards, boardOrder]);

  useEffect(() => {
    requestAnimationFrame(() => {
      firstSectionRef.current?.scrollIntoView({ block: 'start', inline: 'nearest' });
    });
  }, []);

  useEffect(() => {
    if (activeInput && inputRef.current) inputRef.current.focus();
  }, [activeInput]);

  const resetInput = () => {
    setActiveInput(null);
    setDraft('');
  };

  const submitTask = (section) => {
    if (!draft.trim()) {
      resetInput();
      return;
    }
    addTask(section.boardId, section.columnId, draft);
    resetInput();
  };

  return (
    <main className={`mobile-demo-screen ${isDarkMode ? 'mobile-demo-dark' : 'mobile-demo-light'}`}>
      {sections.map((section, sectionIndex) => {
        const inputKey = `${section.boardId}:${section.columnId}`;
        const inputOpen = activeInput === inputKey;

        return (
          <section
            key={inputKey}
            ref={sectionIndex === 0 ? firstSectionRef : null}
            className="mobile-stack-section"
            data-board={section.boardId}
            data-column={section.columnId}
            data-rank={section.rank}
          >
            <div className="mobile-stack-panel board-container">
              <header className="mobile-stack-header">
                <div className="mobile-stack-title-block">
                  <span className="mobile-stack-kicker">{section.boardTitle}</span>
                  <h2>{section.columnTitle}</h2>
                  <p>{section.tasks.length} task{section.tasks.length === 1 ? '' : 's'}</p>
                </div>
                <div className="mobile-stack-actions">
                  <span className={`mobile-save-dot ${saveStatus}`} aria-label={`Save status: ${saveStatus}`} />
                  <button
                    type="button"
                    onClick={() => setActiveInput(inputKey)}
                    aria-label={`Add task to ${section.boardTitle}: ${section.columnTitle}`}
                  >
                    <Plus size={16} />
                  </button>
                  {sectionIndex === 0 && (
                    <button type="button" onClick={() => setIsDarkMode((value) => !value)} aria-label="Toggle dark mode">
                      {isDarkMode ? <Sun size={18} /> : <Moon size={18} />}
                    </button>
                  )}
                </div>
              </header>

              <div className="mobile-stack-column board-column">
                <div
                  className="column-header-accent"
                  style={{ background: getAccentColor(section.columnPosition) }}
                />

                {inputOpen && (
                  <div className="mobile-stack-input-wrap">
                    <input
                      ref={inputRef}
                      type="text"
                      value={draft}
                      onChange={(event) => setDraft(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') submitTask(section);
                        if (event.key === 'Escape') resetInput();
                      }}
                      onBlur={() => submitTask(section)}
                      placeholder="Enter task..."
                    />
                  </div>
                )}

                <div
                  className="mobile-stack-task-list"
                  onDragOver={handleDragOver}
                  onDragEnter={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                  }}
                  onDrop={(event) => handleDrop(event, section.boardId, section.columnId)}
                  onDoubleClick={(event) => {
                    if (event.target === event.currentTarget) setActiveInput(inputKey);
                  }}
                  onContextMenu={(event) => {
                    showContextMenu(event, [
                      {
                        label: 'Add Task',
                        icon: <Plus size={14} />,
                        onClick: () => setActiveInput(inputKey),
                      },
                    ]);
                  }}
                >
                  {section.tasks.length === 0 ? (
                    <div
                      className="column-empty cursor-pointer"
                      onClick={() => setActiveInput(inputKey)}
                      onDragOver={handleDragOver}
                      onDragEnter={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                      }}
                      title="Click to add a task"
                    >
                      + Add a task
                    </div>
                  ) : (
                    section.tasks.map((task, taskIndex) => (
                      <MobileSwipeTaskCard
                        key={task.id}
                        task={task}
                        section={section}
                        taskIndex={taskIndex}
                        onMove={moveTaskToAdjacentColumn}
                      />
                    ))
                  )}
                </div>
              </div>
            </div>
          </section>
        );
      })}
    </main>
  );
};

export default MobileDemo;
