param(
  [string]$MessageId,
  [string]$ThreadId,
  [string]$LedgerPath,
  [int]$SinceHours = 72
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

if (-not $LedgerPath) {
  $repoRoot = Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..\..')
  $LedgerPath = Join-Path $repoRoot 'codex\agent-ledger\events.jsonl'
}

$terminalStatuses = @(
  'completed',
  'board-changed',
  'work-started',
  'blocked',
  'approval-required',
  'no-op',
  'already-handled-by-Eric',
  'duplicate',
  'failed'
)

$cutoff = (Get-Date).ToUniversalTime().AddHours(-1 * [Math]::Abs($SinceHours))
$matches = @()

if (Test-Path -LiteralPath $LedgerPath) {
  foreach ($line in Get-Content -LiteralPath $LedgerPath) {
    if ([string]::IsNullOrWhiteSpace($line)) { continue }
    try {
      $event = $line | ConvertFrom-Json
    } catch {
      continue
    }

    if ($event.recordedAt) {
      try {
        if (([datetime]$event.recordedAt).ToUniversalTime() -lt $cutoff) { continue }
      } catch {
        # Keep malformed timestamps in scope so older runtime quirks do not hide evidence.
      }
    }

    $gmail = $event.gmail
    $isMessageMatch = $MessageId -and $gmail -and $gmail.messageId -eq $MessageId
    $isThreadMatch = $ThreadId -and $gmail -and $gmail.threadId -eq $ThreadId
    if (-not ($isMessageMatch -or $isThreadMatch)) { continue }

    $matches += $event
  }
}

$terminal = @($matches | Where-Object { $terminalStatuses -contains $_.status } | Sort-Object recordedAt -Descending)
$received = @($matches | Where-Object { $_.status -eq 'received' })
$latestTerminal = if ($terminal.Count -gt 0) { $terminal[0] } else { $null }

[pscustomobject]@{
  hasTerminal = [bool]$latestTerminal
  latestTerminal = $latestTerminal
  terminalCount = $terminal.Count
  receivedCount = $received.Count
  matchCount = $matches.Count
  messageId = $MessageId
  threadId = $ThreadId
  ledgerPath = $LedgerPath
} | ConvertTo-Json -Depth 20
