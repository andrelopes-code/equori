# R7 on Windows (PW6 of docs/specs/2026-11-27-windows-per-user-design.md): the database of the
# previous release keeps every fact when install.ps1 upgrades it with the new zip.
param(
    [Parameter(Mandatory)][string]$Previous,
    [Parameter(Mandatory)][string]$New,
    [Parameter(Mandatory)][string]$PreviousRef,
    [Parameter(Mandatory)][string]$Psql
)
$ErrorActionPreference = 'Stop'
$installer = Join-Path $PSScriptRoot 'install.ps1'
$dir = "$env:LOCALAPPDATA\equori upgrade"
$data = "$dir\data"
$base = 'http://127.0.0.1:8080'
$work = Join-Path ([IO.Path]::GetTempPath()) "equori-upgrade-$PID"

# Install runs install.ps1 on a zip, as a person runs the pasted command. The script checks the
# health of equori itself and exits with 1 when it does not answer.
function Install([string]$Zip) {
    $Zip = (Resolve-Path $Zip).Path
    $hash = (Get-FileHash -Algorithm SHA256 $Zip).Hash.ToLower()
    $sums = Join-Path $work 'SHA256SUMS'
    [IO.File]::WriteAllText($sums, "$hash  $(Split-Path -Leaf $Zip)`n", (New-Object Text.UTF8Encoding $false))
    $env:EQUORI_DIR = $dir
    $env:EQUORI_LANG = 'en'
    $env:EQUORI_ZIP = $Zip
    $env:EQUORI_SUMS = $sums
    # Unset, Windows PowerShell 5.1 does not inherit the PowerShell 7 modules of pwsh.
    $modules = $env:PSModulePath
    $env:PSModulePath = $null
    try {
        # -Wait would also wait for equori.exe, which the installation leaves running.
        $p = Start-Process -PassThru powershell.exe -WindowStyle Hidden `
            -ArgumentList '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', "`"$installer`"" `
            -RedirectStandardOutput "$work\install.out" -RedirectStandardError "$work\install.err"
        # Reading the handle keeps the exit code of a process that ends early.
        $null = $p.Handle
        $p.WaitForExit()
    } finally {
        $env:PSModulePath = $modules
        # The variables of install.ps1 hold for the child alone: equori-cli warns on them.
        foreach ($name in 'EQUORI_DIR', 'EQUORI_LANG', 'EQUORI_ZIP', 'EQUORI_SUMS') {
            Remove-Item "Env:$name" -ErrorAction SilentlyContinue
        }
    }
    Get-Content "$work\install.out", "$work\install.err"
    if ($p.ExitCode -ne 0) { throw "install.ps1 of $(Split-Path -Leaf $Zip) exited with $($p.ExitCode)" }
}

# The query of scripts/upgrade-test.sh: balances and row counts of every table a user owns.
$snapshotSQL = @'
SELECT account_id || ' ' || sum(amount) FROM ledger_posting WHERE NOT voided GROUP BY account_id ORDER BY 1;
SELECT format('SELECT %L || '' '' || count(*) FROM %I', table_name, table_name)
FROM information_schema.columns
WHERE table_schema = 'public' AND column_name IN ('user_id', 'books_id')
  AND table_name NOT LIKE 'outbox\_%' AND table_name NOT IN ('identity_session', 'identity_membership')
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

New-Item -ItemType Directory -Force $work | Out-Null
try {
    Install $Previous
    $url = (Get-Content "$data\setup.url" -Raw).Trim()
    $token = ([uri]$url).Fragment -replace '^#token=', ''
    $body = @{ token = $token; email = 'upgrade@equori.test'; password = 'equori-upgrade-test'; language = 'pt'; region = 'BR'; update_check = $false } | ConvertTo-Json
    Invoke-WebRequest -UseBasicParsing -Method Post -ContentType 'application/json' -Body $body "$base/api/v1/setup" | Out-Null
    $src = Join-Path $env:RUNNER_TEMP 'upgrade-src'
    git worktree add --detach $src $PreviousRef | Out-Null
    Push-Location $src
    try {
        go run ./cmd/demoseed -url $base -email upgrade@equori.test -password equori-upgrade-test
        if ($LASTEXITCODE -ne 0) { throw 'demoseed failed' }
    } finally { Pop-Location }
    $before = Settled

    Install $New
    $after = Settled
    $lost = Compare-Object $before $after | Where-Object { $_.SideIndicator -eq '<=' }
    if ($lost) { $lost | ForEach-Object { $_.InputObject }; throw 'lost or changed after the upgrade' }
    "upgrade from $PreviousRef kept $($before.Count) facts"
} finally {
    Remove-Item -Recurse -Force $work -ErrorAction SilentlyContinue
}
