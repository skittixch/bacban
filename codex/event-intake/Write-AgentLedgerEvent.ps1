[CmdletBinding()]
param(
  [ValidateSet('gmail', 'whatsapp', 'manual', 'other')]
  [string]$Source = 'gmail',

  [ValidateSet('openclaw', 'codex-automation', 'manual', 'other')]
  [string]$Gateway = 'openclaw',

  [ValidateSet('received', 'triaged', 'board-changed', 'work-started', 'completed', 'blocked', 'approval-required', 'no-op', 'duplicate', 'failed')]
  [string]$Status = 'received',

  [string]$InputPath,
  [string]$PayloadJson,
  [string]$LedgerPath,
  [switch]$DryRun,
  [switch]$AllowDuplicate
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Get-Sha256Hex {
  param([Parameter(Mandatory = $true)][string]$Text)

  $sha = [System.Security.Cryptography.SHA256]::Create()
  try {
    $bytes = [System.Text.Encoding]::UTF8.GetBytes($Text)
    return ([BitConverter]::ToString($sha.ComputeHash($bytes))).Replace('-', '').ToLowerInvariant()
  } finally {
    $sha.Dispose()
  }
}

function Get-FirstValue {
  param(
    [Parameter(Mandatory = $true)]$Object,
    [Parameter(Mandatory = $true)][string[]]$Paths
  )

  foreach ($path in $Paths) {
    $current = $Object
    $found = $true
    foreach ($part in $path.Split('.')) {
      if ($null -eq $current) {
        $found = $false
        break
      }

      if ($current -is [System.Collections.IDictionary]) {
        if ($current.Contains($part)) {
          $current = $current[$part]
        } else {
          $found = $false
          break
        }
      } else {
        $prop = $current.PSObject.Properties[$part]
        if ($null -ne $prop) {
          $current = $prop.Value
        } else {
          $found = $false
          break
        }
      }
    }

    if ($found -and $null -ne $current -and "$current".Trim().Length -gt 0) {
      return $current
    }
  }

  return $null
}

function Convert-ToBoolOrNull {
  param($Value)

  if ($null -eq $Value) { return $null }
  if ($Value -is [bool]) { return $Value }

  $text = "$Value".Trim()
  if ($text.Length -eq 0) { return $null }

  if ($text -match '^(true|1|yes)$') { return $true }
  if ($text -match '^(false|0|no)$') { return $false }

  return $null
}

function Get-PayloadText {
  if ($InputPath) {
    $resolved = Resolve-Path -LiteralPath $InputPath
    return Get-Content -Raw -LiteralPath $resolved
  }

  if ($PayloadJson) {
    return $PayloadJson
  }

  if ([Console]::IsInputRedirected) {
    $stdin = [Console]::In.ReadToEnd()
    if (-not [string]::IsNullOrWhiteSpace($stdin)) {
      return $stdin
    }
  }

  return '{}'
}

$repoRoot = Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..\..')
if (-not $LedgerPath) {
  $LedgerPath = Join-Path $repoRoot 'codex\agent-ledger\events.jsonl'
}

$payloadText = Get-PayloadText
try {
  $payload = $payloadText | ConvertFrom-Json
} catch {
  throw "Input payload is not valid JSON: $($_.Exception.Message)"
}

$payloadHash = Get-Sha256Hex -Text $payloadText
$recordedAt = (Get-Date).ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ssZ')

$sourceEventId = Get-FirstValue $payload @('eventId', 'id', 'deliveryId', 'message.id', 'pubsub.messageId')
$emailAddress = Get-FirstValue $payload @('emailAddress', 'gmail.emailAddress', 'account', 'gmail.account')
$historyId = Get-FirstValue $payload @('historyId', 'gmail.historyId', 'message.historyId')
$messageId = Get-FirstValue $payload @('messageId', 'gmail.messageId', 'message.id', 'message.payload.id')
$threadId = Get-FirstValue $payload @('threadId', 'gmail.threadId', 'message.threadId')
$subject = Get-FirstValue $payload @('subject', 'gmail.subject', 'message.subject')
$from = Get-FirstValue $payload @('from', 'gmail.from', 'sender', 'message.from')
$receivedAt = Get-FirstValue $payload @('receivedAt', 'gmail.receivedAt', 'message.receivedAt', 'internalDate')
$hookId = Get-FirstValue $payload @('hookId', 'openclaw.hookId', 'hook.id')
$sessionKey = Get-FirstValue $payload @('sessionKey', 'openclaw.sessionKey', 'hook.sessionKey')
$cardId = Get-FirstValue $payload @('cardId', 'bacban.cardId', 'taskCardId')
$board = Get-FirstValue $payload @('board', 'bacban.board')
$column = Get-FirstValue $payload @('column', 'bacban.column')
$boardChanged = Convert-ToBoolOrNull (Get-FirstValue $payload @('boardChanged', 'bacban.changed'))
$classification = Get-FirstValue $payload @('classification', 'result.classification')
$verification = Get-FirstValue $payload @('verification', 'result.verification')
$nextAction = Get-FirstValue $payload @('nextAction', 'result.nextAction')
$statusMessage = Get-FirstValue $payload @('statusMessage', 'result.statusMessage')

$dedupeSeed = @(
  $Source,
  $Gateway,
  $sourceEventId,
  $emailAddress,
  $historyId,
  $messageId,
  $threadId,
  $payloadHash.Substring(0, 16)
) | Where-Object { $null -ne $_ -and "$_".Trim().Length -gt 0 }

$eventId = 'evt_' + (Get-Sha256Hex -Text ($dedupeSeed -join '|')).Substring(0, 24)

$record = [ordered]@{
  schemaVersion = 1
  eventId = $eventId
  recordedAt = $recordedAt
  source = $Source
  gateway = $Gateway
  status = $Status
  privacy = 'private-ledger-no-raw-body'
  dedupe = [ordered]@{
    sourceEventId = $sourceEventId
    payloadHashSha256 = $payloadHash
  }
  gmail = [ordered]@{
    emailAddress = $emailAddress
    historyId = $historyId
    messageId = $messageId
    threadId = $threadId
    subject = $subject
    from = $from
    receivedAt = $receivedAt
  }
  openclaw = [ordered]@{
    hookId = $hookId
    sessionKey = $sessionKey
  }
  bacban = [ordered]@{
    cardId = $cardId
    board = $board
    column = $column
    changed = $boardChanged
  }
  result = [ordered]@{
    classification = $classification
    statusMessage = $statusMessage
    verification = $verification
    nextAction = $nextAction
  }
}

$eventJson = $record | ConvertTo-Json -Depth 20 -Compress
$duplicate = $false

if ((Test-Path -LiteralPath $LedgerPath) -and -not $AllowDuplicate) {
  foreach ($line in Get-Content -LiteralPath $LedgerPath) {
    if ([string]::IsNullOrWhiteSpace($line)) { continue }
    $existing = $line | ConvertFrom-Json
    if ($existing.eventId -eq $eventId) {
      $duplicate = $true
      break
    }
  }
}

if (-not $DryRun -and -not $duplicate) {
  $ledgerDir = Split-Path -Parent $LedgerPath
  New-Item -ItemType Directory -Force -Path $ledgerDir | Out-Null
  Add-Content -LiteralPath $LedgerPath -Value $eventJson -Encoding UTF8
}

[pscustomobject]@{
  eventId = $eventId
  status = $(if ($duplicate) { 'duplicate' } else { $Status })
  duplicate = $duplicate
  dryRun = [bool]$DryRun
  ledgerPath = $LedgerPath
  wrote = (-not $DryRun -and -not $duplicate)
} | ConvertTo-Json -Depth 5
