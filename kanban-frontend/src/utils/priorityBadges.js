const firstText = (...values) => {
  for (const value of values) {
    if (value === undefined || value === null) continue;
    const text = String(value).trim();
    if (text) return text;
  }
  return '';
};

const firstValue = (...values) => values.find((value) => value !== undefined && value !== null && String(value).trim() !== '');

const toPositiveInteger = (value) => {
  if (value === undefined || value === null || value === '') return null;
  const direct = Number(value);
  if (Number.isFinite(direct) && direct > 0) return Math.round(direct);

  const match = String(value).trim().match(/^(?:p|#)?\s*(\d+)$/i);
  if (!match) return null;

  const parsed = Number(match[1]);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

export const getTaskPriorityBadge = (task = {}) => {
  const priorityList = task.priorityList && typeof task.priorityList === 'object'
    ? task.priorityList
    : {};
  const rank = toPositiveInteger(firstValue(
    task.priorityRank,
    task.priority,
    priorityList.rank,
    priorityList.priority,
  ));
  const total = toPositiveInteger(firstValue(task.priorityTotal, priorityList.total));
  const label = firstText(task.priorityLabel, priorityList.label, task.priorityBadge, priorityList.badge);
  const source = firstText(task.prioritySource, priorityList.source);

  if (!rank) return null;

  const sourceIsEmail = /email|gmail|mail/i.test(source);
  const sourceLabel = sourceIsEmail ? 'Email' : source;
  const title = [
    sourceLabel ? `${sourceLabel} priority` : 'Priority',
    rank ? `Rank: ${rank}${total ? ` of ${total}` : ''}` : '',
    label,
  ].filter(Boolean).join('. ');

  return {
    ariaLabel: title,
    kind: sourceIsEmail ? 'email' : 'default',
    rank,
    title,
    total,
    isTopPriority: rank === 1,
  };
};
