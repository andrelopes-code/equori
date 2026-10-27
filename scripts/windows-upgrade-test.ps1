# R7 on Windows (W-R7 of docs/superpowers/specs/2026-10-27-distribution-windows-design.md): the
# database of the previous release keeps every fact when the new installer upgrades it.
param(
    [Parameter(Mandatory)][string]$Previous,
    [Parameter(Mandatory)][string]$New,
    [Parameter(Mandatory)][string]$PreviousRef,
    [Parameter(Mandatory)][string]$Psql
)
$ErrorActionPreference = 'Stop'
$data = "$env:ProgramData\equori"
$base = 'http://127.0.0.1:8080'

function Install([string]$Installer) {
    $p = Start-Process -PassThru -Wait $Installer -ArgumentList '/VERYSILENT', '/SUPPRESSMSGBOXES', '/NORESTART'
    if ($p.ExitCode -ne 0) { throw "$Installer exited with $($p.ExitCode)" }
    for ($i = 0; $i -lt 120; $i++) {
        try { if ((Invoke-WebRequest -UseBasicParsing -TimeoutSec 2 "$base/healthz").StatusCode -eq 200) { return } } catch { }
        Start-Sleep -Seconds 1
    }
    throw "$Installer: equori did not answer /healthz"
}

# The query of scripts/upgrade-test.sh: balances and row counts of every table a user owns.
$snapshotSQL = @'
SELECT account_id || ' ' || sum(amount) FROM ledger_posting WHERE NOT voided GROUP BY account_id ORDER BY 1;
SELECT format('SELECT %L || '' '' || count(*) FROM %I', table_name, table_name)
FROM information_schema.columns
WHERE table_schema = 'public' AND column_name = 'user_id'
  AND table_name NOT LIKE 'outbox\_%' AND table_name <> 'identity_session'
ORDER BY table_name \gexec
'@
$dsn = "host=$($data -replace '\\', '/')/run user=equori dbname=equori"
function Snapshot { $snapshotSQL | & $Psql $dsn -At -v ON_ERROR_STOP=1 }
function Retrying { & $Psql $dsn -At -c "SELECT count(*) FROM outbox_delivery WHERE status = 'retrying'" }
function Settled {
    $previous = Snapshot
    for ($i = 0; $i -lt 60; $i++) {
        Start-Sleep -Seconds 10
        $current = Snapshot
        if ((Compare-Object $previous $current).Count -eq 0 -and (Retrying) -eq '0') { return $current }
        $previous = $current
    }
    throw 'facts still changing after 600 seconds'
}

Install $Previous
$url = (Get-Content "$data\setup.url" -Raw).Trim()
$token = ([uri]$url).Fragment -replace '^#token=', ''
$body = @{ token = $token; email = 'upgrade@equori.test'; password = 'equori-upgrade-test'; language = 'pt'; region = 'BR' } | ConvertTo-Json
Invoke-WebRequest -UseBasicParsing -Method Post -ContentType 'application/json' -Body $body "$base/api/v1/setup" | Out-Null
$src = Join-Path $env:RUNNER_TEMP 'upgrade-src'
git worktree add --detach $src $PreviousRef | Out-Null
Push-Location $src
try {
    go run ./cmd/demoseed -url $base -email upgrade@equori.test -password equori-upgrade-test -today 2026-10-26
    if ($LASTEXITCODE -ne 0) { throw 'demoseed failed' }
} finally { Pop-Location }
$before = Settled

Install $New
$after = Settled
$lost = Compare-Object $before $after | Where-Object { $_.SideIndicator -eq '<=' }
if ($lost) { $lost | ForEach-Object { $_.InputObject }; throw 'lost or changed after the upgrade' }
"upgrade from $PreviousRef kept $($before.Count) facts"
