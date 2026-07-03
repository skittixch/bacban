import { getActivePriorityBadgeMap } from './priorityBadges';

const WORK_BOARD_KEY = 'work';
const LIFE_BOARD_KEY = 'life';

const padDatePart = (value) => String(value).padStart(2, '0');

export const getLocalDateKey = (date = new Date()) => (
  `${date.getFullYear()}-${padDatePart(date.getMonth() + 1)}-${padDatePart(date.getDate())}`
);

export const getMillisecondsUntilNextLocalDay = (date = new Date()) => {
  const nextDay = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1, 0, 0, 5);
  return Math.max(1000, nextDay.getTime() - date.getTime());
};

const nthWeekdayOfMonth = (year, monthIndex, weekday, nth) => {
  const date = new Date(year, monthIndex, 1);
  const offset = (weekday - date.getDay() + 7) % 7;
  return new Date(year, monthIndex, 1 + offset + ((nth - 1) * 7));
};

const lastWeekdayOfMonth = (year, monthIndex, weekday) => {
  const date = new Date(year, monthIndex + 1, 0);
  const offset = (date.getDay() - weekday + 7) % 7;
  return new Date(year, monthIndex, date.getDate() - offset);
};

const observedFixedDate = (year, monthIndex, day) => {
  const date = new Date(year, monthIndex, day);
  if (date.getDay() === 6) return new Date(year, monthIndex, day - 1);
  if (date.getDay() === 0) return new Date(year, monthIndex, day + 1);
  return date;
};

const getUsFederalHolidayKeysForYear = (year) => ([
  observedFixedDate(year, 0, 1),
  nthWeekdayOfMonth(year, 0, 1, 3),
  nthWeekdayOfMonth(year, 1, 1, 3),
  lastWeekdayOfMonth(year, 4, 1),
  observedFixedDate(year, 5, 19),
  observedFixedDate(year, 6, 4),
  nthWeekdayOfMonth(year, 8, 1, 1),
  nthWeekdayOfMonth(year, 9, 1, 2),
  observedFixedDate(year, 10, 11),
  nthWeekdayOfMonth(year, 10, 4, 4),
  observedFixedDate(year, 11, 25),
].map(getLocalDateKey));

export const isWeekendOrUsFederalHoliday = (date = new Date()) => {
  const day = date.getDay();
  if (day === 0 || day === 6) return true;

  const dateKey = getLocalDateKey(date);
  const holidayKeys = new Set([
    ...getUsFederalHolidayKeysForYear(date.getFullYear() - 1),
    ...getUsFederalHolidayKeysForYear(date.getFullYear()),
    ...getUsFederalHolidayKeysForYear(date.getFullYear() + 1),
  ]);

  return holidayKeys.has(dateKey);
};

const normalizeId = (value) => String(value || '').trim().toLowerCase();

const findBoardByRole = (boards = {}, role) => {
  if (boards[role]) return role;
  return Object.keys(boards).find((boardId) => (
    normalizeId(boardId) === role || normalizeId(boards[boardId]?.title) === role
  )) || null;
};

const getCanonicalBoardOrder = (boards = {}, boardOrder = []) => {
  const orderedIds = Array.isArray(boardOrder) ? boardOrder : [];
  const missingBoardIds = Object.keys(boards).filter((boardId) => !orderedIds.includes(boardId));

  return [...orderedIds, ...missingBoardIds].filter((boardId, index, ids) => (
    boards[boardId] && ids.indexOf(boardId) === index
  ));
};

export const hasActiveWorkPriority = (boards = {}) => {
  const workBoardId = findBoardByRole(boards, WORK_BOARD_KEY);
  if (!workBoardId) return false;
  return getActivePriorityBadgeMap(boards[workBoardId], workBoardId).size > 0;
};

export const getDisplayBoardOrder = (boards = {}, boardOrder = [], date = new Date()) => {
  const canonicalOrder = getCanonicalBoardOrder(boards, boardOrder);
  const lifeBoardId = findBoardByRole(boards, LIFE_BOARD_KEY);

  if (
    !lifeBoardId
    || canonicalOrder[0] === lifeBoardId
    || !isWeekendOrUsFederalHoliday(date)
    || hasActiveWorkPriority(boards)
  ) {
    return canonicalOrder;
  }

  return [lifeBoardId, ...canonicalOrder.filter((boardId) => boardId !== lifeBoardId)];
};
