const express = require("express");
const cors = require("cors");
const fs = require("fs").promises;
const path = require("path");
const crypto = require("crypto");

const app = express();
const PORT = process.env.PORT || 3001;
const DATA_FILE = process.env.DATA_FILE || "/data/kanban-data.json";
const DATA_DIR = path.dirname(DATA_FILE);
const AGENT_EVENT_FILE = process.env.AGENT_EVENT_FILE || path.join(DATA_DIR, "agent-events", "board-events.jsonl");
const DELETED_CARDS_FILE = process.env.DELETED_CARDS_FILE || path.join(DATA_DIR, "agent-events", "deleted-cards.jsonl");
const DELETED_CARD_FEEDBACK_FILE = process.env.DELETED_CARD_FEEDBACK_FILE || path.join(DATA_DIR, "agent-events", "deleted-card-feedback.jsonl");
const COLLECTION_ROUTING_FILE = process.env.COLLECTION_ROUTING_FILE || path.join(DATA_DIR, "agent-events", "collection-routing.jsonl");
const MAX_EVENT_CHANGES = 50;
const DEFAULT_SIMILARITY_THRESHOLD = 0.42;
const DEFAULT_COLLECTION_ROUTE_THRESHOLD = 0.36;
const COLLECTION_BOARD_IDS = new Set(["work", "life"]);

app.use(cors({
  exposedHeaders: ["X-BacBan-State-Hash"],
}));
app.use(express.json({ limit: "50mb" }));

const nowIso = () => new Date().toISOString().replace(/\.\d{3}Z$/, "Z");

const sha256 = (value) => crypto.createHash("sha256").update(String(value || "")).digest("hex");
const stateHash = (data) => sha256(JSON.stringify(data || {}));

const shortText = (value, limit = 320) => {
  if (value === undefined || value === null) return "";
  const text = String(value).replace(/\s+/g, " ").trim();
  return text.length > limit ? `${text.slice(0, limit - 1)}...` : text;
};

const stripHtml = (value) => shortText(String(value || "").replace(/<[^>]+>/g, " "), 600);

const normalizeText = (value) => String(value || "")
  .toLowerCase()
  .replace(/&[a-z0-9#]+;/gi, " ")
  .replace(/https?:\/\/\S+/g, " ")
  .replace(/[^a-z0-9]+/g, " ")
  .replace(/\s+/g, " ")
  .trim();

const tokenize = (value) => {
  const stopWords = new Set([
    "a", "an", "and", "are", "as", "at", "be", "by", "for", "from", "has",
    "have", "in", "is", "it", "of", "on", "or", "that", "the", "this",
    "to", "was", "with", "you", "your",
  ]);
  return new Set(
    normalizeText(value)
      .split(" ")
      .filter((token) => token.length >= 3 && !stopWords.has(token)),
  );
};

const toPositiveInteger = (value) => {
  if (value === undefined || value === null || value === "") return null;
  const direct = Number(value);
  if (Number.isFinite(direct) && direct > 0) return Math.round(direct);
  const match = String(value).trim().match(/^(?:p|#)?\s*(\d+)$/i);
  return match ? Number(match[1]) : null;
};

const isDoneColumnTitle = (title = "") => /done|complete/i.test(title);

const taskPriority = (task = {}) => {
  const priorityList = task.priorityList && typeof task.priorityList === "object" ? task.priorityList : {};
  return {
    rank: toPositiveInteger(task.priorityRank ?? task.priority ?? priorityList.rank ?? priorityList.priority),
    total: toPositiveInteger(task.priorityTotal ?? priorityList.total),
    source: shortText(task.prioritySource ?? priorityList.source, 80),
    label: shortText(task.priorityLabel ?? priorityList.label ?? task.priorityBadge ?? priorityList.badge, 160),
  };
};

const cardFingerprint = (task = {}) => sha256(JSON.stringify({
  text: task.text || "",
  references: task.references || "",
  waitingOn: task.waitingOn || "",
  dueDate: task.dueDate || "",
  doneAt: task.doneAt || "",
  color: task.color || "",
  priority: task.priority,
  priorityRank: task.priorityRank,
  prioritySource: task.prioritySource,
  priorityTotal: task.priorityTotal,
  priorityLabel: task.priorityLabel,
  subtasks: task.subtasks || null,
}));

const compactTask = (entry = {}) => {
  const task = entry.task || {};
  const priority = taskPriority(task);
  return {
    taskId: String(task.id),
    text: shortText(task.text),
    boardId: entry.boardId,
    boardTitle: shortText(entry.boardTitle, 120),
    columnId: entry.columnId,
    columnTitle: shortText(entry.columnTitle, 120),
    index: entry.index,
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
    doneAt: task.doneAt,
    waitingOn: shortText(task.waitingOn, 180),
    priority: priority.rank,
    prioritySource: priority.source,
    priorityTotal: priority.total,
    priorityLabel: priority.label,
    wasDone: Boolean(task.doneAt) || isDoneColumnTitle(entry.columnTitle),
  };
};

const getTaskSearchText = (entry = {}) => {
  const task = entry.task || {};
  const priority = taskPriority(task);
  return [
    task.text,
    task.waitingOn,
    task.dueDate,
    priority.label,
    priority.source,
    entry.boardTitle,
    entry.columnTitle,
  ].filter(Boolean).join(" ");
};

const getCandidateText = (body = {}) => [
  body.text,
  body.title,
  body.subject,
  body.from,
  body.sender,
  body.snippet,
  stripHtml(body.references),
].filter(Boolean).join(" ");

const isCollectionBoard = (entry = {}) => {
  const boardId = String(entry.boardId || "").toLowerCase();
  const boardTitle = String(entry.boardTitle || "").toLowerCase();
  return COLLECTION_BOARD_IDS.has(boardId) || COLLECTION_BOARD_IDS.has(boardTitle);
};

const compactLocation = (entry = {}) => ({
  boardId: entry.boardId,
  boardTitle: shortText(entry.boardTitle, 120),
  columnId: entry.columnId,
  columnTitle: shortText(entry.columnTitle, 120),
  index: entry.index,
});

const compactDeletedTaskPayload = (body = {}) => {
  const task = body.task && typeof body.task === "object" ? body.task : {};
  const priority = taskPriority(task);
  return {
    taskId: shortText(task.id ?? body.taskId, 120),
    text: shortText(task.text ?? body.text),
    boardId: shortText(body.boardId, 120),
    boardTitle: shortText(body.boardTitle, 120),
    columnId: shortText(body.columnId, 120),
    columnTitle: shortText(body.columnTitle, 120),
    index: body.index,
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
    doneAt: task.doneAt,
    waitingOn: shortText(task.waitingOn, 180),
    priority: priority.rank,
    prioritySource: priority.source,
    priorityTotal: priority.total,
    priorityLabel: priority.label,
  };
};

const flattenTasks = (state = {}) => {
  const tasks = new Map();
  const boards = state.boards || {};
  const boardIds = Array.isArray(state.boardOrder)
    ? [...state.boardOrder, ...Object.keys(boards).filter((id) => !state.boardOrder.includes(id))]
    : Object.keys(boards);

  for (const boardId of boardIds) {
    const board = boards[boardId];
    if (!board || !board.tasks) continue;

    const columnIds = Array.isArray(board.columnOrder)
      ? [...board.columnOrder, ...Object.keys(board.tasks).filter((id) => !board.columnOrder.includes(id))]
      : Object.keys(board.tasks);

    for (const columnId of columnIds) {
      const list = Array.isArray(board.tasks[columnId]) ? board.tasks[columnId] : [];
      for (let index = 0; index < list.length; index += 1) {
        const task = list[index];
        if (!task || task.id === undefined || task.id === null) continue;

        tasks.set(String(task.id), {
          task,
          boardId,
          boardTitle: board.title || boardId,
          columnId,
          columnTitle: (board.columnTitles && board.columnTitles[columnId]) || columnId,
          index,
          fingerprint: cardFingerprint(task),
        });
      }
    }
  }

  return tasks;
};

const ensureParentDir = async (filePath) => {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
};

const appendJsonLine = async (filePath, record) => {
  await ensureParentDir(filePath);
  await fs.appendFile(filePath, `${JSON.stringify(record)}\n`, "utf8");
};

const readJsonLines = async (filePath) => {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    return raw
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        try {
          return JSON.parse(line);
        } catch (error) {
          return null;
        }
      })
      .filter(Boolean);
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw error;
  }
};

const buildDeletedCardRecord = (entry, eventId, recordedAt) => {
  const task = entry.task || {};
  const searchText = getTaskSearchText(entry);
  return {
    deletionId: `trash_${sha256(`${recordedAt}|${task.id}|${entry.boardId}|${entry.columnId}|${entry.fingerprint}`).slice(0, 24)}`,
    eventId,
    deletedAt: recordedAt,
    source: "bacban-board",
    task: compactTask(entry),
    searchText: shortText(searchText, 700),
    normalizedText: normalizeText(searchText),
    tokenHash: sha256([...tokenize(searchText)].sort().join("|")),
    fingerprint: entry.fingerprint,
  };
};

const buildCollectionRouteRecord = (previousEntry, nextEntry, eventId, recordedAt) => {
  const task = nextEntry.task || {};
  const searchText = getTaskSearchText(nextEntry);
  return {
    routeId: `route_${sha256(`${recordedAt}|${task.id}|${previousEntry.boardId}|${nextEntry.boardId}|${nextEntry.fingerprint}`).slice(0, 24)}`,
    eventId,
    movedAt: recordedAt,
    source: "bacban-board",
    action: "card-moved-between-collections",
    task: compactTask(nextEntry),
    from: compactLocation(previousEntry),
    to: compactLocation(nextEntry),
    searchText: shortText(searchText, 700),
    normalizedText: normalizeText(searchText),
    tokenHash: sha256([...tokenize(searchText)].sort().join("|")),
    fingerprint: nextEntry.fingerprint,
  };
};

const buildDeletedCardFeedbackRecord = (body, req) => {
  const feedbackAt = nowIso();
  const task = compactDeletedTaskPayload(body);
  const reason = shortText(body.reason, 700);
  const searchText = [
    task.text,
    task.waitingOn,
    task.priorityLabel,
    task.prioritySource,
    task.boardTitle,
    task.columnTitle,
    reason,
  ].filter(Boolean).join(" ");

  return {
    feedbackId: `trash_feedback_${sha256(`${feedbackAt}|${task.taskId}|${reason}`).slice(0, 24)}`,
    feedbackAt,
    deletedAt: body.deletedAt || feedbackAt,
    source: "bacban-ui",
    reason,
    task,
    searchText: shortText(searchText, 900),
    normalizedText: normalizeText(searchText),
    tokenHash: sha256([...tokenize(searchText)].sort().join("|")),
    request: {
      actor: shortText(req.get("X-BacBan-Actor") || "", 80),
      userAgent: shortText(req.get("user-agent") || "", 180),
      ip: req.ip,
    },
  };
};

const buildBoardDiff = (previousData, nextData) => {
  if (!previousData) return null;

  const previousHash = stateHash(previousData);
  const nextHash = stateHash(nextData);
  if (previousHash === nextHash) return null;

  const previousTasks = flattenTasks(previousData);
  const nextTasks = flattenTasks(nextData);
  const changes = {
    created: [],
    deleted: [],
    moved: [],
    reordered: [],
    updated: [],
    completed: [],
    reopened: [],
  };

  for (const [taskId, previousEntry] of previousTasks.entries()) {
    const nextEntry = nextTasks.get(taskId);
    if (!nextEntry) {
      changes.deleted.push(compactTask(previousEntry));
      continue;
    }

    const locationChanged = previousEntry.boardId !== nextEntry.boardId
      || previousEntry.columnId !== nextEntry.columnId;
    const orderChanged = previousEntry.index !== nextEntry.index;
    const previousDone = Boolean(previousEntry.task.doneAt) || isDoneColumnTitle(previousEntry.columnTitle);
    const nextDone = Boolean(nextEntry.task.doneAt) || isDoneColumnTitle(nextEntry.columnTitle);

    if (locationChanged) {
      changes.moved.push({
        taskId,
        text: shortText(nextEntry.task.text),
        from: {
          boardId: previousEntry.boardId,
          boardTitle: shortText(previousEntry.boardTitle, 120),
          columnId: previousEntry.columnId,
          columnTitle: shortText(previousEntry.columnTitle, 120),
          index: previousEntry.index,
        },
        to: {
          boardId: nextEntry.boardId,
          boardTitle: shortText(nextEntry.boardTitle, 120),
          columnId: nextEntry.columnId,
          columnTitle: shortText(nextEntry.columnTitle, 120),
          index: nextEntry.index,
        },
      });
    } else if (orderChanged) {
      changes.reordered.push({
        taskId,
        text: shortText(nextEntry.task.text),
        boardId: nextEntry.boardId,
        boardTitle: shortText(nextEntry.boardTitle, 120),
        columnId: nextEntry.columnId,
        columnTitle: shortText(nextEntry.columnTitle, 120),
        fromIndex: previousEntry.index,
        toIndex: nextEntry.index,
      });
    }

    if (!previousDone && nextDone) changes.completed.push(compactTask(nextEntry));
    if (previousDone && !nextDone) changes.reopened.push(compactTask(nextEntry));

    if (previousEntry.fingerprint !== nextEntry.fingerprint && !locationChanged) {
      changes.updated.push(compactTask(nextEntry));
    }
  }

  for (const [taskId, nextEntry] of nextTasks.entries()) {
    if (!previousTasks.has(taskId)) {
      changes.created.push(compactTask(nextEntry));
    }
  }

  const summary = Object.fromEntries(Object.entries(changes).map(([key, value]) => [key, value.length]));
  const totalChanges = Object.values(summary).reduce((sum, count) => sum + count, 0);
  if (totalChanges === 0) return null;

  return {
    previousHash,
    nextHash,
    summary,
    changes,
    deletedEntries: [...previousTasks.entries()]
      .filter(([taskId]) => !nextTasks.has(taskId))
      .map(([, entry]) => entry),
    collectionMoves: [...previousTasks.entries()]
      .map(([taskId, previousEntry]) => ({ previousEntry, nextEntry: nextTasks.get(taskId) }))
      .filter(({ previousEntry, nextEntry }) => nextEntry
        && previousEntry.boardId !== nextEntry.boardId
        && isCollectionBoard(previousEntry)
        && isCollectionBoard(nextEntry)),
  };
};

const limitChanges = (changes) => Object.fromEntries(
  Object.entries(changes).map(([key, value]) => [key, value.slice(0, MAX_EVENT_CHANGES)]),
);

const recordBoardWrite = async (previousData, nextData, req) => {
  const diff = buildBoardDiff(previousData, nextData);
  if (!diff) return null;

  const recordedAt = nowIso();
  const eventId = `board_${sha256(`${recordedAt}|${diff.previousHash}|${diff.nextHash}`).slice(0, 24)}`;
  const collectionRouteRecords = diff.collectionMoves.map((move) => (
    buildCollectionRouteRecord(move.previousEntry, move.nextEntry, eventId, recordedAt)
  ));
  const event = {
    eventId,
    recordedAt,
    source: "bacban-board",
    gateway: "backend",
    status: "board-changed",
    classification: "status-only",
    dedupe: {
      previousHash: diff.previousHash,
      nextHash: diff.nextHash,
    },
    request: {
      method: req.method,
      path: req.path,
      actor: shortText(req.get("X-BacBan-Actor") || req.get("X-Codex-Actor") || "", 80),
      userAgent: shortText(req.get("user-agent") || "", 180),
      ip: req.ip,
    },
    bacban: {
      summary: diff.summary,
      truncatedAt: MAX_EVENT_CHANGES,
      changes: limitChanges(diff.changes),
      collectionRoutes: collectionRouteRecords.slice(0, MAX_EVENT_CHANGES).map(publicCollectionRouteRecord),
    },
    verification: "Backend accepted the full-state POST and persisted the board document.",
    nextAction: "Codex/OpenCLAW intake can read this private board-change message if board-side state changed outside the current agent loop.",
  };

  await appendJsonLine(AGENT_EVENT_FILE, event);

  for (const deletedEntry of diff.deletedEntries) {
    await appendJsonLine(DELETED_CARDS_FILE, buildDeletedCardRecord(deletedEntry, eventId, recordedAt));
  }

  for (const collectionRouteRecord of collectionRouteRecords) {
    await appendJsonLine(COLLECTION_ROUTING_FILE, collectionRouteRecord);
  }

  return event;
};

const getRecordSearchText = (record = {}) => [
  record.searchText,
  record.normalizedText,
  record.task?.text,
  record.task?.waitingOn,
  record.reason,
].filter(Boolean).join(" ");

const scoreSimilarity = (candidateText, record) => {
  const candidateTokens = tokenize(candidateText);
  const recordText = getRecordSearchText(record);
  const recordTokens = tokenize(recordText);
  if (candidateTokens.size === 0 || recordTokens.size === 0) return 0;

  let intersection = 0;
  for (const token of candidateTokens) {
    if (recordTokens.has(token)) intersection += 1;
  }

  const union = new Set([...candidateTokens, ...recordTokens]).size;
  const jaccard = union ? intersection / union : 0;
  const overlap = intersection / Math.min(candidateTokens.size, recordTokens.size);
  const candidateNorm = normalizeText(candidateText);
  const recordNorm = normalizeText(recordText);
  const phraseBoost = candidateNorm && recordNorm && (
    candidateNorm.includes(recordNorm) || recordNorm.includes(candidateNorm)
  ) ? 0.2 : 0;

  return Math.min(1, Number(((jaccard * 0.65) + (overlap * 0.35) + phraseBoost).toFixed(4)));
};

const publicDeletedRecord = (record) => ({
  deletionId: record.deletionId,
  deletedAt: record.deletedAt,
  eventId: record.eventId,
  task: record.task,
});

const publicDeleteFeedbackRecord = (record) => ({
  feedbackId: record.feedbackId,
  feedbackAt: record.feedbackAt,
  deletedAt: record.deletedAt,
  reason: record.reason,
  task: record.task,
});

const publicCollectionRouteRecord = (record) => ({
  routeId: record.routeId,
  movedAt: record.movedAt,
  eventId: record.eventId,
  task: record.task,
  from: record.from,
  to: record.to,
  action: record.action,
});

const buildCollectionRecommendation = (matches) => {
  if (!matches.length) return null;

  const candidates = new Map();
  for (const match of matches) {
    const to = match.route.to || {};
    const key = String(to.boardId || to.boardTitle || "");
    if (!key) continue;
    const existing = candidates.get(key) || {
      boardId: to.boardId,
      boardTitle: to.boardTitle,
      columnId: to.columnId,
      columnTitle: to.columnTitle,
      score: 0,
      bestScore: 0,
      matchCount: 0,
      latestMoveAt: "",
    };
    existing.score += match.score;
    existing.bestScore = Math.max(existing.bestScore, match.score);
    existing.matchCount += 1;
    existing.latestMoveAt = existing.latestMoveAt && existing.latestMoveAt > match.route.movedAt
      ? existing.latestMoveAt
      : match.route.movedAt;
    candidates.set(key, existing);
  }

  const [best] = [...candidates.values()].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (b.bestScore !== a.bestScore) return b.bestScore - a.bestScore;
    return String(b.latestMoveAt).localeCompare(String(a.latestMoveAt));
  });

  if (!best) return null;
  return {
    boardId: best.boardId,
    boardTitle: best.boardTitle,
    columnId: best.columnId,
    columnTitle: best.columnTitle,
    confidence: Number(Math.min(1, best.score).toFixed(4)),
    bestMatchScore: Number(best.bestScore.toFixed(4)),
    matchCount: best.matchCount,
    latestMoveAt: best.latestMoveAt,
  };
};

// Ensure data directory exists
async function ensureDataFile() {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });

    try {
      await fs.access(DATA_FILE);
    } catch {
      // File doesn't exist, create with default data
      const defaultData = {
        boards: {
          work: {
            title: "Work",
            tasks: { todo: [], inprogress: [], onhold: [], done: [] },
            columnOrder: ["todo", "inprogress", "onhold", "done"],
            columnTitles: {
              todo: "To Do",
              inprogress: "In Progress",
              onhold: "on hold",
              done: "Completed",
            },
            collapsed: false,
            height: 400,
          },
          life: {
            title: "Life",
            tasks: { todo: [], inprogress: [], onhold: [], done: [] },
            columnOrder: ["todo", "inprogress", "onhold", "done"],
            columnTitles: {
              todo: "To Do",
              inprogress: "In Progress",
              onhold: "on hold",
              done: "Completed",
            },
            collapsed: false,
            height: 400,
          },
        },
        theme: "blue",
        darkMode: true,
        boardOrder: ["work", "life"],
        projectColors: {
          "#ef4444": "Urgent",
          "#f97316": "Operations",
          "#f59e0b": "Setup",
          "#22c55e": "Release",
          "#3b82f6": "Client Work",
          "#8b5cf6": "Automation",
          "#ec4899": "Personal",
        },
        settings: {
          completedTaskRetentionDays: 7,
          completedTaskFade: true,
          completionCelebration: true,
          cardDensity: "comfortable",
        },
      };
      await fs.writeFile(DATA_FILE, JSON.stringify(defaultData, null, 2));
    }
  } catch (error) {
    console.error("Error ensuring data file:", error);
  }
}

// Read data
async function readData() {
  try {
    const data = await fs.readFile(DATA_FILE, "utf8");
    return JSON.parse(data);
  } catch (error) {
    console.error("Error reading data:", error);
    return null;
  }
}

// Write data
async function writeData(data) {
  try {
    await fs.writeFile(DATA_FILE, JSON.stringify(data, null, 2));
    return true;
  } catch (error) {
    console.error("Error writing data:", error);
    return false;
  }
}

// GET all data
app.get("/api/data", async (req, res) => {
  const data = await readData();
  if (data) {
    res.set("X-BacBan-State-Hash", stateHash(data));
    res.json(data);
  } else {
    res.status(500).json({ error: "Failed to read data" });
  }
});

// POST update all data
app.post("/api/data", async (req, res) => {
  const previousData = await readData();
  const previousHash = previousData ? stateHash(previousData) : "";
  const baseHash = req.get("X-BacBan-Base-Hash");
  const userAgent = req.get("user-agent") || "";
  const browserSaveWithoutHash = !baseHash && /mozilla|chrome|safari|firefox|edg/i.test(userAgent);

  if (browserSaveWithoutHash) {
    res.set("X-BacBan-State-Hash", previousHash);
    res.status(428).json({
      error: "Browser saves must include X-BacBan-Base-Hash. Reload before saving.",
      currentHash: previousHash,
    });
    return;
  }

  if (baseHash && previousHash && baseHash !== previousHash) {
    res.set("X-BacBan-State-Hash", previousHash);
    res.status(409).json({
      error: "Board changed since this client last loaded it. Reload before saving.",
      currentHash: previousHash,
    });
    return;
  }

  const success = await writeData(req.body);

  if (!success) {
    res.status(500).json({ error: "Failed to write data" });
    return;
  }

  try {
    await recordBoardWrite(previousData, req.body, req);
  } catch (error) {
    console.error("Error recording board-change evidence:", error);
  }

  res.set("X-BacBan-State-Hash", stateHash(req.body));
  res.json({ success: true });
});

app.get("/api/agent-events", async (req, res) => {
  try {
    const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 50));
    const events = await readJsonLines(AGENT_EVENT_FILE);
    res.json({
      count: events.length,
      events: events.slice(-limit).reverse(),
    });
  } catch (error) {
    console.error("Error reading agent events:", error);
    res.status(500).json({ error: "Failed to read agent events" });
  }
});

app.get("/api/deleted-cards", async (req, res) => {
  try {
    const limit = Math.min(500, Math.max(1, Number(req.query.limit) || 100));
    const records = await readJsonLines(DELETED_CARDS_FILE);
    res.json({
      count: records.length,
      deletedCards: records.slice(-limit).reverse().map(publicDeletedRecord),
    });
  } catch (error) {
    console.error("Error reading deleted-card records:", error);
    res.status(500).json({ error: "Failed to read deleted-card records" });
  }
});

app.get("/api/deleted-card-feedback", async (req, res) => {
  try {
    const limit = Math.min(500, Math.max(1, Number(req.query.limit) || 100));
    const records = await readJsonLines(DELETED_CARD_FEEDBACK_FILE);
    res.json({
      count: records.length,
      feedback: records.slice(-limit).reverse().map(publicDeleteFeedbackRecord),
    });
  } catch (error) {
    console.error("Error reading deleted-card feedback:", error);
    res.status(500).json({ error: "Failed to read deleted-card feedback" });
  }
});

app.post("/api/deleted-cards/feedback", async (req, res) => {
  try {
    const reason = shortText(req.body.reason, 700);
    if (!reason.trim()) {
      res.status(400).json({ error: "Provide a delete reason." });
      return;
    }

    const record = buildDeletedCardFeedbackRecord({ ...req.body, reason }, req);
    await appendJsonLine(DELETED_CARD_FEEDBACK_FILE, record);
    res.json({
      success: true,
      feedback: publicDeleteFeedbackRecord(record),
      guidance: "Delete feedback was recorded in the private BacBan agent ledger for future Codex/OpenCLAW intake.",
    });
  } catch (error) {
    console.error("Error writing deleted-card feedback:", error);
    res.status(500).json({ error: "Failed to write deleted-card feedback" });
  }
});

app.post("/api/deleted-cards/check", async (req, res) => {
  try {
    const candidateText = getCandidateText(req.body);

    if (!candidateText.trim()) {
      res.status(400).json({ error: "Provide text, subject, sender/from, snippet, or references to compare." });
      return;
    }

    const threshold = Number.isFinite(Number(req.body.threshold))
      ? Number(req.body.threshold)
      : DEFAULT_SIMILARITY_THRESHOLD;
    const limit = Math.min(25, Math.max(1, Number(req.body.limit) || 5));
    const currentTaskIds = new Set(flattenTasks((await readData()) || {}).keys());
    const records = await readJsonLines(DELETED_CARDS_FILE);
    const feedbackRecords = await readJsonLines(DELETED_CARD_FEEDBACK_FILE);

    const tombstoneMatches = records
      .filter((record) => !currentTaskIds.has(String(record.task?.taskId)))
      .map((record) => ({
        score: scoreSimilarity(candidateText, record),
        reason: "similar-deleted-card",
        deletedCard: publicDeletedRecord(record),
      }));
    const feedbackMatches = feedbackRecords
      .filter((record) => !currentTaskIds.has(String(record.task?.taskId)))
      .map((record) => ({
        score: scoreSimilarity(candidateText, record),
        reason: "similar-delete-feedback",
        deleteFeedback: publicDeleteFeedbackRecord(record),
      }));
    const matches = [...tombstoneMatches, ...feedbackMatches]
      .filter((match) => match.score >= threshold)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    res.json({
      checkedAt: nowIso(),
      threshold,
      matchCount: matches.length,
      matches,
      guidance: matches.length
        ? "Treat this as a likely duplicate/noise candidate and inspect before creating a new BacBan card."
        : "No similar deleted-card tombstone crossed the threshold.",
    });
  } catch (error) {
    console.error("Error checking deleted-card similarity:", error);
    res.status(500).json({ error: "Failed to check deleted-card similarity" });
  }
});

app.get("/api/collection-routes", async (req, res) => {
  try {
    const limit = Math.min(500, Math.max(1, Number(req.query.limit) || 100));
    const records = await readJsonLines(COLLECTION_ROUTING_FILE);
    res.json({
      count: records.length,
      collectionRoutes: records.slice(-limit).reverse().map(publicCollectionRouteRecord),
    });
  } catch (error) {
    console.error("Error reading collection-routing records:", error);
    res.status(500).json({ error: "Failed to read collection-routing records" });
  }
});

app.post("/api/collection-routing/check", async (req, res) => {
  try {
    const candidateText = getCandidateText(req.body);

    if (!candidateText.trim()) {
      res.status(400).json({ error: "Provide text, title, subject, sender/from, snippet, or references to compare." });
      return;
    }

    const threshold = Number.isFinite(Number(req.body.threshold))
      ? Number(req.body.threshold)
      : DEFAULT_COLLECTION_ROUTE_THRESHOLD;
    const limit = Math.min(25, Math.max(1, Number(req.body.limit) || 5));
    const records = await readJsonLines(COLLECTION_ROUTING_FILE);

    const matches = records
      .map((record) => ({
        score: scoreSimilarity(candidateText, record),
        reason: "similar-past-card-move",
        route: publicCollectionRouteRecord(record),
      }))
      .filter((match) => match.score >= threshold)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
    const recommendation = buildCollectionRecommendation(matches);

    res.json({
      checkedAt: nowIso(),
      threshold,
      matchCount: matches.length,
      recommendation,
      matches,
      guidance: recommendation
        ? `Prefer ${recommendation.boardTitle || recommendation.boardId}${recommendation.columnTitle ? ` / ${recommendation.columnTitle}` : ""} unless current evidence clearly belongs elsewhere.`
        : "No similar collection-move hint crossed the threshold; use the normal board-routing rules.",
    });
  } catch (error) {
    console.error("Error checking collection-routing similarity:", error);
    res.status(500).json({ error: "Failed to check collection-routing similarity" });
  }
});

// Health check
app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

// Initialize and start server
ensureDataFile().then(() => {
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`BacBan API running on port ${PORT}`);
    console.log(`Data file: ${DATA_FILE}`);
    console.log(`Agent event file: ${AGENT_EVENT_FILE}`);
    console.log(`Deleted-card file: ${DELETED_CARDS_FILE}`);
    console.log(`Deleted-card feedback file: ${DELETED_CARD_FEEDBACK_FILE}`);
    console.log(`Collection routing file: ${COLLECTION_ROUTING_FILE}`);
  });
});
