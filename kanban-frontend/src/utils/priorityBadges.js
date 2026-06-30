const firstText = (...values) => {
  for (const value of values) {
    if (value === undefined || value === null) continue;
    const text = String(value).trim();
    if (text) return text;
  }
  return '';
};

const firstValue = (...values) => values.find((value) => (
  value !== undefined && value !== null && String(value).trim() !== ''
));

const toPositiveInteger = (value) => {
  if (value === undefined || value === null || value === '') return null;
  const direct = Number(value);
  if (Number.isFinite(direct) && direct > 0) return Math.round(direct);

  const match = String(value).trim().match(/^(?:p|#)?\s*(\d+)$/i);
  if (!match) return null;

  const parsed = Number(match[1]);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

export const isCompletionColumnTitle = (title = '') => /done|complete/i.test(title);

const getPriorityList = (task = {}) => (
  task.priorityList && typeof task.priorityList === 'object' ? task.priorityList : {}
);

const getPriorityParts = (task = {}) => {
  const priorityList = getPriorityList(task);
  return {
    rank: toPositiveInteger(firstValue(
      task.priorityRank,
      task.priority,
      priorityList.rank,
      priorityList.priority,
    )),
    total: toPositiveInteger(firstValue(task.priorityTotal, priorityList.total)),
    label: firstText(task.priorityLabel, priorityList.label, task.priorityBadge, priorityList.badge),
    source: firstText(task.prioritySource, priorityList.source),
    groupId: firstText(
      task.priorityGroupId,
      priorityList.groupId,
      priorityList.id,
      task.priorityThreadId,
      priorityList.threadId,
      task.emailThreadId,
      priorityList.emailThreadId,
      task.gmailThreadId,
      priorityList.gmailThreadId,
      task.threadId,
      priorityList.threadId,
    ),
  };
};

const getPriorityGroupKey = (task, boardId = '') => {
  const parts = getPriorityParts(task);
  if (!parts.rank) return null;

  if (parts.groupId) {
    return `id:${parts.groupId}`;
  }

  const source = parts.source || 'manual';
  const total = parts.total || 'unknown';
  return `fallback:${boardId}:${source}:${total}`;
};

export const getActivePriorityBadgeMap = (board = {}, boardId = '') => {
  const entriesByGroup = new Map();
  const columnOrder = Array.isArray(board.columnOrder)
    ? board.columnOrder
    : Object.keys(board.tasks || {});

  columnOrder.forEach((columnId, columnIndex) => {
    const columnTitle = board.columnTitles?.[columnId] || columnId;
    const isDoneColumn = isCompletionColumnTitle(columnTitle);
    const tasks = Array.isArray(board.tasks?.[columnId]) ? board.tasks[columnId] : [];

    tasks.forEach((task, taskIndex) => {
      const parts = getPriorityParts(task);
      if (!parts.rank) return;
      if (isDoneColumn) return;

      const groupKey = getPriorityGroupKey(task, boardId);
      if (!groupKey) return;

      const entry = {
        taskId: String(task.id),
        rank: parts.rank,
        originalTotal: parts.total,
        columnIndex,
        taskIndex,
      };

      if (!entriesByGroup.has(groupKey)) {
        entriesByGroup.set(groupKey, []);
      }
      entriesByGroup.get(groupKey).push(entry);
    });
  });

  const badgeMap = new Map();

  for (const entries of entriesByGroup.values()) {
    const sortedEntries = [...entries].sort((a, b) => (
      a.rank - b.rank
      || a.columnIndex - b.columnIndex
      || a.taskIndex - b.taskIndex
    ));

    sortedEntries.forEach((entry, index) => {
      badgeMap.set(entry.taskId, {
        rank: index + 1,
        total: sortedEntries.length || entry.originalTotal,
        originalRank: entry.rank,
        originalTotal: entry.originalTotal,
      });
    });
  }

  return badgeMap;
};

export const getBoardPriorityBadgeMaps = (boards = {}, boardOrder = []) => {
  const ids = Array.isArray(boardOrder)
    ? [...boardOrder, ...Object.keys(boards).filter((id) => !boardOrder.includes(id))]
    : Object.keys(boards);

  return ids.reduce((maps, boardId) => {
    maps[boardId] = getActivePriorityBadgeMap(boards[boardId], boardId);
    return maps;
  }, {});
};

export const getTaskPriorityBadge = (task = {}, options = {}) => {
  const parts = getPriorityParts(task);
  const activeBadge = options.activeBadge || {};
  const isCompleted = Boolean(options.isCompleted);
  const rank = toPositiveInteger(activeBadge.rank || options.rank || parts.rank);
  const activeTotal = toPositiveInteger(activeBadge.total || options.total);
  const originalTotal = toPositiveInteger(activeBadge.originalTotal || parts.total);
  const total = isCompleted ? originalTotal : (activeTotal || originalTotal);
  const originalRank = toPositiveInteger(activeBadge.originalRank || parts.rank);
  const label = parts.label;
  const source = parts.source;

  if (!rank) return null;

  const sourceIsEmail = /email|gmail|mail/i.test(source);
  const sourceLabel = sourceIsEmail ? 'Email' : source;
  const originalRankLabel = `Original rank: ${originalRank || rank}${originalTotal ? ` of ${originalTotal}` : ''}`;
  const title = isCompleted
    ? [
      sourceLabel ? `${sourceLabel} priority completed` : 'Priority completed',
      originalRankLabel,
      label,
    ].filter(Boolean).join('. ')
    : [
      sourceLabel ? `${sourceLabel} priority` : 'Priority',
      originalRank && originalRank !== rank
        ? `Active rank: ${rank}${activeTotal ? ` of ${activeTotal}` : ''}. ${originalRankLabel}`
        : `Rank: ${rank}${activeTotal || originalTotal ? ` of ${activeTotal || originalTotal}` : ''}`,
      label,
    ].filter(Boolean).join('. ');
  const rankLabel = originalRank && originalRank !== rank
    ? `Active rank: ${rank}${activeTotal ? ` of ${activeTotal}` : ''}. ${originalRankLabel}`
    : `Rank: ${rank}${activeTotal || originalTotal ? ` of ${activeTotal || originalTotal}` : ''}`;

  return {
    ariaLabel: title,
    kind: sourceIsEmail ? 'email' : 'default',
    rank,
    rankLabel,
    title,
    total,
    originalRank,
    originalTotal,
    isCompleted,
    isTopPriority: rank === 1,
  };
};
