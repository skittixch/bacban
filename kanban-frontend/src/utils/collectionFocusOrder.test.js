import {
  getDisplayBoardOrder,
  hasActiveWorkPriority,
  isWeekendOrUsFederalHoliday,
} from './collectionFocusOrder';

const buildBoards = ({
  workTasks = {},
  lifeTasks = {},
} = {}) => ({
  work: {
    title: 'Work',
    columnOrder: ['todo', 'inprogress', 'done'],
    columnTitles: {
      todo: 'To Do',
      inprogress: 'In Progress',
      done: 'Completed',
    },
    tasks: {
      todo: workTasks.todo || [],
      inprogress: workTasks.inprogress || [],
      done: workTasks.done || [],
    },
  },
  life: {
    title: 'Life',
    columnOrder: ['todo', 'inprogress', 'done'],
    columnTitles: {
      todo: 'To Do',
      inprogress: 'In Progress',
      done: 'Completed',
    },
    tasks: {
      todo: lifeTasks.todo || [],
      inprogress: lifeTasks.inprogress || [],
      done: lifeTasks.done || [],
    },
  },
});

describe('collection focus order', () => {
  it('keeps the saved order on a normal weekday', () => {
    const boards = buildBoards();

    expect(getDisplayBoardOrder(boards, ['work', 'life'], new Date(2026, 6, 2))).toEqual([
      'work',
      'life',
    ]);
  });

  it('moves Life first on a weekend when Work has no active priority', () => {
    const boards = buildBoards();

    expect(getDisplayBoardOrder(boards, ['work', 'life'], new Date(2026, 6, 5))).toEqual([
      'life',
      'work',
    ]);
  });

  it('moves Life first on an observed federal holiday when Work has no active priority', () => {
    const boards = buildBoards();

    expect(isWeekendOrUsFederalHoliday(new Date(2026, 6, 3))).toBe(true);
    expect(getDisplayBoardOrder(boards, ['work', 'life'], new Date(2026, 6, 3))).toEqual([
      'life',
      'work',
    ]);
  });

  it('keeps Work first on weekends when Work has an active priority card', () => {
    const boards = buildBoards({
      workTasks: {
        todo: [{ id: 'priority-work', text: 'Priority work', priority: 1 }],
      },
    });

    expect(hasActiveWorkPriority(boards)).toBe(true);
    expect(getDisplayBoardOrder(boards, ['work', 'life'], new Date(2026, 6, 5))).toEqual([
      'work',
      'life',
    ]);
  });

  it('does not let completed Work priority cards block Life-first weekends', () => {
    const boards = buildBoards({
      workTasks: {
        done: [{ id: 'done-priority-work', text: 'Done priority work', priority: 1 }],
      },
    });

    expect(hasActiveWorkPriority(boards)).toBe(false);
    expect(getDisplayBoardOrder(boards, ['work', 'life'], new Date(2026, 6, 5))).toEqual([
      'life',
      'work',
    ]);
  });

  it('preserves additional boards after the Life jump', () => {
    const boards = {
      ...buildBoards(),
      errands: {
        title: 'Errands',
        columnOrder: [],
        columnTitles: {},
        tasks: {},
      },
    };

    expect(getDisplayBoardOrder(boards, ['work', 'errands', 'life'], new Date(2026, 6, 5))).toEqual([
      'life',
      'work',
      'errands',
    ]);
  });
});
