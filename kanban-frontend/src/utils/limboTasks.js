export const LIMBO_STALE_DAYS = 14;
export const LIMBO_STALE_MS = LIMBO_STALE_DAYS * 24 * 60 * 60 * 1000;

export const isLimboColumnTitle = (title = '') => /hold|waiting|blocked/i.test(title);

const parseTaskDate = (value) => {
  if (!value) return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;

  const normalized = String(value).trim();
  if (!normalized) return null;

  const isoDateOnly = normalized.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoDateOnly) {
    const [, year, month, day] = isoDateOnly;
    return new Date(Number(year), Number(month) - 1, Number(day)).getTime();
  }

  const slashDateOnly = normalized.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slashDateOnly) {
    const [, month, day, year] = slashDateOnly;
    return new Date(Number(year), Number(month) - 1, Number(day)).getTime();
  }

  const parsed = Date.parse(normalized);
  return Number.isNaN(parsed) ? null : parsed;
};

export const getTaskLastInfoTime = (task = {}) => (
  Math.max(
    parseTaskDate(task.updatedAt) || 0,
    parseTaskDate(task.lastInfoAt) || 0,
    parseTaskDate(task.lastSignalAt) || 0,
    parseTaskDate(task.dateAdded) || 0,
    parseTaskDate(task.createdAt) || 0,
  ) || null
);

export const isLimboTask = (task, columnTitle, now = Date.now()) => {
  if (!isLimboColumnTitle(columnTitle)) return false;

  const lastInfoTime = getTaskLastInfoTime(task);
  if (!lastInfoTime) return false;

  return now - lastInfoTime > LIMBO_STALE_MS;
};

export const partitionLimboTasks = (tasks = [], columnTitle, now = Date.now()) => (
  tasks.reduce((groups, task, taskIndex) => {
    const entry = { task, taskIndex };
    if (isLimboTask(task, columnTitle, now)) {
      groups.limboTasks.push(entry);
    } else {
      groups.visibleTasks.push(entry);
    }
    return groups;
  }, { visibleTasks: [], limboTasks: [] })
);
