#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const allowedSources = new Set(['gmail', 'whatsapp', 'manual', 'other']);
const allowedGateways = new Set(['openclaw', 'codex-automation', 'manual', 'other']);
const allowedStatuses = new Set([
  'received',
  'triaged',
  'board-changed',
  'work-started',
  'completed',
  'blocked',
  'approval-required',
  'no-op',
  'already-handled-by-Eric',
  'duplicate',
  'failed',
]);

function usage() {
  return `Usage: write-agent-ledger-event.mjs [options]

Options:
  --source <gmail|whatsapp|manual|other>        Default: gmail
  --gateway <openclaw|codex-automation|manual|other>
                                               Default: openclaw
  --status <status>                            Default: received
  --input-path <path>                          Read payload JSON from file
  --payload-json <json>                        Read payload JSON from argument
  --ledger-path <path>                         Override ledger JSONL path
  --dry-run                                    Normalize without appending
  --allow-duplicate                            Append even if event id exists
  --help                                       Show this help
`;
}

function fail(message) {
  console.error(message);
  process.exit(1);
}

function parseArgs(argv) {
  const opts = {
    source: 'gmail',
    gateway: 'openclaw',
    status: 'received',
    dryRun: false,
    allowDuplicate: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = () => {
      i += 1;
      if (i >= argv.length) fail(`Missing value for ${arg}`);
      return argv[i];
    };

    if (arg === '--help' || arg === '-h') {
      console.log(usage());
      process.exit(0);
    } else if (arg === '--source') {
      opts.source = next();
    } else if (arg === '--gateway') {
      opts.gateway = next();
    } else if (arg === '--status') {
      opts.status = next();
    } else if (arg === '--input-path') {
      opts.inputPath = next();
    } else if (arg === '--payload-json') {
      opts.payloadJson = next();
    } else if (arg === '--ledger-path') {
      opts.ledgerPath = next();
    } else if (arg === '--dry-run') {
      opts.dryRun = true;
    } else if (arg === '--allow-duplicate') {
      opts.allowDuplicate = true;
    } else {
      fail(`Unknown option: ${arg}`);
    }
  }

  if (!allowedSources.has(opts.source)) fail(`Invalid --source: ${opts.source}`);
  if (!allowedGateways.has(opts.gateway)) fail(`Invalid --gateway: ${opts.gateway}`);
  if (!allowedStatuses.has(opts.status)) fail(`Invalid --status: ${opts.status}`);

  return opts;
}

function normalizePath(value) {
  if (!value) return value;
  const text = String(value);
  const msysDrive = text.match(/^\/([a-zA-Z])\/(.*)$/);
  if (msysDrive) {
    return `${msysDrive[1].toUpperCase()}:/${msysDrive[2]}`;
  }
  return text.replace(/\\/g, '/');
}

function stripBom(text) {
  return text.replace(/^\uFEFF/, '');
}

function sha256Hex(text) {
  return crypto.createHash('sha256').update(text, 'utf8').digest('hex');
}

function firstValue(object, paths) {
  for (const candidate of paths) {
    let current = object;
    let found = true;
    for (const part of candidate.split('.')) {
      if (current == null || typeof current !== 'object' || !(part in current)) {
        found = false;
        break;
      }
      current = current[part];
    }

    if (found && current != null && String(current).trim().length > 0) {
      return current;
    }
  }
  return null;
}

function boolOrNull(value) {
  if (value == null) return null;
  if (typeof value === 'boolean') return value;
  const text = String(value).trim().toLowerCase();
  if (!text) return null;
  if (['true', '1', 'yes'].includes(text)) return true;
  if (['false', '0', 'no'].includes(text)) return false;
  return null;
}

async function readStdin() {
  if (process.stdin.isTTY) return '';
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  return Buffer.concat(chunks).toString('utf8');
}

async function payloadText(opts) {
  if (opts.inputPath) {
    return fs.readFileSync(normalizePath(opts.inputPath), 'utf8');
  }
  if (opts.payloadJson) return opts.payloadJson;
  const stdin = await readStdin();
  return stdin.trim() ? stdin : '{}';
}

function defaultLedgerPath() {
  const scriptDir = path.dirname(fileURLToPath(import.meta.url));
  const repoRoot = path.resolve(scriptDir, '..', '..');
  return path.join(repoRoot, 'codex', 'agent-ledger', 'events.jsonl');
}

function readLedgerEvents(ledgerPath) {
  if (!fs.existsSync(ledgerPath)) return [];
  return fs
    .readFileSync(ledgerPath, 'utf8')
    .split(/\r?\n/)
    .filter((line) => line.trim())
    .map((line) => {
      try {
        return JSON.parse(stripBom(line));
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

const opts = parseArgs(process.argv.slice(2));
const ledgerPath = normalizePath(opts.ledgerPath || defaultLedgerPath());
const rawPayloadText = await payloadText(opts);
const cleanPayloadText = stripBom(rawPayloadText);

let payload;
try {
  payload = JSON.parse(cleanPayloadText);
} catch (error) {
  fail(`Input payload is not valid JSON: ${error.message}`);
}

const payloadHash = sha256Hex(cleanPayloadText);
const sourceEventId = firstValue(payload, ['eventId', 'id', 'deliveryId', 'message.id', 'pubsub.messageId']);
const emailAddress = firstValue(payload, ['emailAddress', 'gmail.emailAddress', 'account', 'gmail.account']);
const historyId = firstValue(payload, ['historyId', 'gmail.historyId', 'message.historyId']);
const messageId = firstValue(payload, ['messageId', 'gmail.messageId', 'message.id', 'message.payload.id']);
const threadId = firstValue(payload, ['threadId', 'gmail.threadId', 'message.threadId']);
const subject = firstValue(payload, ['subject', 'gmail.subject', 'message.subject']);
const from = firstValue(payload, ['from', 'gmail.from', 'sender', 'message.from']);
const receivedAt = firstValue(payload, ['receivedAt', 'gmail.receivedAt', 'message.receivedAt', 'internalDate']);
const hookId = firstValue(payload, ['hookId', 'openclaw.hookId', 'hook.id']);
const sessionKey = firstValue(payload, ['sessionKey', 'openclaw.sessionKey', 'hook.sessionKey']);
const cardId = firstValue(payload, ['cardId', 'bacban.cardId', 'taskCardId']);
const board = firstValue(payload, ['board', 'bacban.board']);
const column = firstValue(payload, ['column', 'bacban.column']);
const boardChanged = boolOrNull(firstValue(payload, ['boardChanged', 'bacban.changed']));
const classification = firstValue(payload, ['classification', 'result.classification']);
const verification = firstValue(payload, ['verification', 'result.verification']);
const nextAction = firstValue(payload, ['nextAction', 'result.nextAction']);
const statusMessage = firstValue(payload, ['statusMessage', 'result.statusMessage']);

const dedupeSeed = [
  opts.source,
  opts.gateway,
  sourceEventId,
  emailAddress,
  historyId,
  messageId,
  threadId,
  payloadHash.slice(0, 16),
].filter((value) => value != null && String(value).trim().length > 0);
const eventId = `evt_${sha256Hex(dedupeSeed.join('|')).slice(0, 24)}`;

const record = {
  schemaVersion: 1,
  eventId,
  recordedAt: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
  source: opts.source,
  gateway: opts.gateway,
  status: opts.status,
  privacy: 'private-ledger-no-raw-body',
  dedupe: {
    sourceEventId,
    payloadHashSha256: payloadHash,
  },
  gmail: {
    emailAddress,
    historyId,
    messageId,
    threadId,
    subject,
    from,
    receivedAt,
  },
  openclaw: {
    hookId,
    sessionKey,
  },
  bacban: {
    cardId,
    board,
    column,
    changed: boardChanged,
  },
  result: {
    classification,
    statusMessage,
    verification,
    nextAction,
  },
};

const duplicate = !opts.allowDuplicate && readLedgerEvents(ledgerPath).some((event) => event.eventId === eventId);

if (!opts.dryRun && !duplicate) {
  fs.mkdirSync(path.dirname(ledgerPath), { recursive: true });
  fs.appendFileSync(ledgerPath, `${JSON.stringify(record)}${os.EOL}`, 'utf8');
}

console.log(
  JSON.stringify(
    {
      eventId,
      status: duplicate ? 'duplicate' : opts.status,
      duplicate,
      dryRun: opts.dryRun,
      ledgerPath,
      wrote: !opts.dryRun && !duplicate,
    },
    null,
    0,
  ),
);
