#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const terminalStatuses = new Set([
  'completed',
  'board-changed',
  'work-started',
  'blocked',
  'approval-required',
  'no-op',
  'already-handled-by-Eric',
  'duplicate',
  'failed',
]);

function usage() {
  return `Usage: find-agent-ledger-terminal-event.mjs [options]

Options:
  --message-id <gmail-message-id>
  --thread-id <gmail-thread-id>
  --ledger-path <path>
  --since-hours <hours>       Default: 72
  --help
`;
}

function fail(message) {
  console.error(message);
  process.exit(1);
}

function parseArgs(argv) {
  const opts = { sinceHours: 72 };
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
    } else if (arg === '--message-id') {
      opts.messageId = next();
    } else if (arg === '--thread-id') {
      opts.threadId = next();
    } else if (arg === '--ledger-path') {
      opts.ledgerPath = next();
    } else if (arg === '--since-hours') {
      opts.sinceHours = Number.parseInt(next(), 10);
    } else {
      fail(`Unknown option: ${arg}`);
    }
  }

  if (!Number.isFinite(opts.sinceHours)) fail('Invalid --since-hours value');
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

function defaultLedgerPath() {
  const scriptDir = path.dirname(fileURLToPath(import.meta.url));
  const repoRoot = path.resolve(scriptDir, '..', '..');
  return path.join(repoRoot, 'codex', 'agent-ledger', 'events.jsonl');
}

function readEvents(ledgerPath) {
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

function eventTime(event) {
  const parsed = Date.parse(event.recordedAt || '');
  return Number.isFinite(parsed) ? parsed : 0;
}

const opts = parseArgs(process.argv.slice(2));
const ledgerPath = normalizePath(opts.ledgerPath || defaultLedgerPath());
const cutoffMs = Date.now() - Math.abs(opts.sinceHours) * 60 * 60 * 1000;
const matches = readEvents(ledgerPath).filter((event) => {
  const time = eventTime(event);
  if (time && time < cutoffMs) return false;

  const gmail = event.gmail || {};
  const messageMatch = opts.messageId && gmail.messageId === opts.messageId;
  const threadMatch = opts.threadId && gmail.threadId === opts.threadId;
  return Boolean(messageMatch || threadMatch);
});

const terminal = matches
  .filter((event) => terminalStatuses.has(event.status))
  .sort((a, b) => eventTime(b) - eventTime(a));
const received = matches.filter((event) => event.status === 'received');
const latestTerminal = terminal.length > 0 ? terminal[0] : null;

console.log(
  JSON.stringify(
    {
      hasTerminal: Boolean(latestTerminal),
      latestTerminal,
      terminalCount: terminal.length,
      receivedCount: received.length,
      matchCount: matches.length,
      messageId: opts.messageId || null,
      threadId: opts.threadId || null,
      ledgerPath,
    },
    null,
    0,
  ),
);
