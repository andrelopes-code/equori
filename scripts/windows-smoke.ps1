# Smoke test of the Windows installer (W-R3 of docs/superpowers/specs/2026-10-27-distribution-windows-design.md).
# Runs elevated on a computer without equori: it installs, uses, restarts and uninstalls the service.
param(
    [Parameter(Mandatory)][string]$Installer,
    [Parameter(Mandatory)][string]$Tag,
    [Parameter(Mandatory)][string]$Region,
    [Parameter(Mandatory)][string]$Currency
)
$ErrorActionPreference = 'Stop'
$app = "$env:ProgramFiles\equori"
$data = "$env:ProgramData\equori"
$base = 'http://127.0.0.1:8080'

function Wait-Healthy([int]$Seconds) {
    for ($i = 0; $i -lt $Seconds; $i++) {
        try {
            if ((Invoke-WebRequest -UseBasicParsing -TimeoutSec 2 "$base/healthz").StatusCode -eq 200) { return }
        } catch { }
        Start-Sleep -Seconds 1
    }
    if (Test-Path "$data\log\equori.log") { Get-Content -Tail 40 "$data\log\equori.log" }
    throw "equori did not answer /healthz within $Seconds s"
}

function Install-Equori {
    $p = Start-Process -PassThru -Wait $Installer -ArgumentList '/VERYSILENT', '/SUPPRESSMSGBOXES', '/NORESTART', "/LOG=$env:TEMP\equori-setup.log"
    if ($p.ExitCode -ne 0) { Get-Content "$env:TEMP\equori-setup.log" -Tail 40; throw "installer exited with $($p.ExitCode)" }
}

function Transactions {
    (Invoke-RestMethod -Headers $auth "$base/api/v1/transactions").items.Count
}

Install-Equori
Wait-Healthy 90
"1 installed; the service answers"

$version = (& "$app\equori.exe" version | Select-Object -First 1)
if ($version -ne "equori $Tag") { throw "version is '$version', want 'equori $Tag'" }
"2 equori version reports $Tag"

$url = (Get-Content "$data\setup.url" -Raw).Trim()
$token = ([uri]$url).Fragment -replace '^#token=', ''
$body = @{ token = $token; email = 'smoke@equori.test'; password = 'equori-smoke-test'; language = 'en'; region = $Region; base_currency = $Currency } | ConvertTo-Json
$r = Invoke-WebRequest -UseBasicParsing -Method Post -ContentType 'application/json' -Body $body "$base/api/v1/setup"
if ($r.StatusCode -ne 201) { throw "setup answered $($r.StatusCode)" }
# The cookie is Secure: a browser sends it to the loopback address, the .NET client does not.
$cookie = (@($r.Headers['Set-Cookie']) -join ';') -replace '^.*?(equori_session=[^;]+).*$', '$1'
$auth = @{ Cookie = $cookie }
if (Test-Path "$data\setup.url") { throw 'setup.url is still there after the setup' }
"3 first user created with the token of setup.url"

$account = {
    param($name, $class, $kind)
    $fields = @{ name = $name; class = $class; currency = $Currency }
    if ($kind) { $fields.kind = $kind }
    (Invoke-RestMethod -Headers $auth -Method Post -ContentType 'application/json' -Body ($fields | ConvertTo-Json) "$base/api/v1/accounts").id
}
$checking = & $account 'Checking' 'asset' 'checking'
$food = & $account 'Food' 'expense' ''
$tx = @{ date = '2026-10-14'; description = 'smoke'; postings = @(
        @{ account_id = $checking; amount = @{ amount = -2300; currency = $Currency } },
        @{ account_id = $food; amount = @{ amount = 2300; currency = $Currency } }) } | ConvertTo-Json -Depth 5
Invoke-RestMethod -Headers $auth -Method Post -ContentType 'application/json' -Body $tx "$base/api/v1/transactions" | Out-Null
if ((Transactions) -ne 1) { throw 'the transaction is not listed' }
"4 an account and a transaction recorded"

$dump = (& "$app\equori.exe" backup | Select-Object -First 1)
if ($dump -notmatch '\\backups\\equori-[0-9-]+-s[0-9]+\.dump$' -or -not (Test-Path $dump)) { throw "backup printed '$dump'" }
"5 equori backup from the installing account wrote $dump"

Restart-Service equori
Wait-Healthy 60
if ((Transactions) -ne 1) { throw 'the transaction is gone after a restart' }
"6 Restart-Service keeps the transaction"

$servicePid = (Get-CimInstance Win32_Service -Filter "Name='equori'").ProcessId
$postgres = @(Get-CimInstance Win32_Process -Filter "Name='postgres.exe'" | Where-Object { $_.ParentProcessId -eq $servicePid } | ForEach-Object { $_.ProcessId })
if ($postgres.Count -eq 0) { throw 'no postgres.exe under the service' }
Stop-Process -Force -Id $servicePid
Start-Sleep -Seconds 2
$left = @($postgres | Where-Object { Get-Process -Id $_ -ErrorAction SilentlyContinue })
if ($left.Count -gt 0) { throw "postgres.exe $left outlived the killed equori.exe" }
Wait-Healthy 60
if ((Transactions) -ne 1) { throw 'the transaction is gone after a kill' }
"7 a killed equori.exe takes its postgres.exe along, and the service manager restarts it"

Install-Equori
Wait-Healthy 90
if ((Transactions) -ne 1) { throw 'the transaction is gone after an installation over the running version' }
"8 an installation over the running version keeps the transaction"

Stop-Service equori
$listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, 8080)
$listener.Start()
try {
    Start-Service equori -ErrorAction SilentlyContinue
    $found = $false
    for ($i = 0; $i -lt 30 -and -not $found; $i++) {
        Start-Sleep -Seconds 1
        $found = [bool](Select-String -Quiet -Path "$data\log\equori.log" -Pattern 'bind' -SimpleMatch) -and
            [bool](Select-String -Quiet -Path "$data\log\equori.log" -Pattern '127.0.0.1:8080' -SimpleMatch)
    }
    if (-not $found) { Get-Content -Tail 20 "$data\log\equori.log"; throw 'equori.log does not name the address it failed to listen on' }
} finally {
    $listener.Stop()
}
Wait-Healthy 30
"9 a taken port is named in equori.log, and the service starts once it is free"

Stop-Service equori
Copy-Item "$data\equori.env" "$env:TEMP\equori.env"
Add-Content "$data\equori.env" 'EQUORI_LOG_LEVEL=verbose'
Start-Service equori -ErrorAction SilentlyContinue
$found = $false
for ($i = 0; $i -lt 30 -and -not $found; $i++) {
    Start-Sleep -Seconds 1
    $found = [bool](Select-String -Quiet -Path "$data\log\equori.log" -Pattern 'EQUORI_LOG_LEVEL' -SimpleMatch)
}
Stop-Service equori -ErrorAction SilentlyContinue
Copy-Item -Force "$env:TEMP\equori.env" "$data\equori.env"
Start-Service equori
if (-not $found) { Get-Content -Tail 20 "$data\log\equori.log"; throw 'equori.log does not name the setting of equori.env that stops the start' }
Wait-Healthy 30
"9b a wrong setting of equori.env is named in equori.log"

$p = Start-Process -PassThru -Wait "$app\unins000.exe" -ArgumentList '/VERYSILENT', '/SUPPRESSMSGBOXES', '/NORESTART'
if ($p.ExitCode -ne 0) { throw "uninstaller exited with $($p.ExitCode)" }
for ($i = 0; $i -lt 30 -and (Test-Path $app); $i++) { Start-Sleep -Seconds 1 }
if (Get-Service equori -ErrorAction SilentlyContinue) { throw 'the service is still registered' }
if (Test-Path "$app\equori.exe") { throw "$app\equori.exe is still there" }
if (-not (Test-Path "$data\pg\PG_VERSION")) { throw 'the uninstaller removed the data' }
"10 a silent uninstall removes the service and the program and keeps the data"
