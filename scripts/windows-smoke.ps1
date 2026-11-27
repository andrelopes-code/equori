# Smoke test of the Windows zip (PW6 of docs/specs/2026-11-27-windows-per-user-design.md).
# Runs as an ordinary user on a computer without equori: it installs the zip through
# scripts/install.ps1 into a folder with a space and a non-ASCII letter, uses equori, upgrades,
# reinstalls and uninstalls it. ASCII only: Windows PowerShell 5.1 and PowerShell 7 parse it.
param(
    [Parameter(Mandatory)][string]$Zip,
    [Parameter(Mandatory)][string]$Tag,
    [Parameter(Mandatory)][string]$Region,
    [Parameter(Mandatory)][string]$Currency
)
$ErrorActionPreference = 'Stop'
$ignoreCase = [StringComparison]::OrdinalIgnoreCase
$utf8 = New-Object Text.UTF8Encoding $false
$version = $Tag -replace '^v', ''
$installer = Join-Path $PSScriptRoot 'install.ps1'
$goldens = Join-Path $PSScriptRoot 'testdata'
$dir = "$env:LOCALAPPDATA\equori smoke Jo" + [char]0x00E3 + 'o'
$data = "$dir\data"
$base = 'http://127.0.0.1:8080'
$work = Join-Path ([IO.Path]::GetTempPath()) "equori-smoke-$PID"
$runKey = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Run'
$uninstallKey = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\equori'
$lnk = Join-Path ([Environment]::GetFolderPath('Programs')) 'equori.lnk'
$cli = "$dir\equori-cli.exe"

try { [Console]::OutputEncoding = $utf8 } catch { }

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

function Transactions {
    (Invoke-RestMethod -Headers $auth "$base/api/v1/transactions").items.Count
}

# Get-Owned lists the processes of the folder; Win32_Process reads the path of a restricted token.
function Get-Owned([string[]]$Names) {
    $filter = ($Names | ForEach-Object { "Name='$_'" }) -join ' OR '
    @(Get-CimInstance Win32_Process -Filter $filter | Where-Object {
            $_.ExecutablePath -and $_.ExecutablePath.StartsWith("$dir\", $ignoreCase)
        })
}

# Invoke-Installer runs a script in Windows PowerShell 5.1, the shell of the pasted command.
# The child sets UTF-8 before it writes, so the captured file holds the non-ASCII text.
function Invoke-Installer([string]$Lang, [string[]]$Switches = @(), [string]$Script = $installer,
    [bool]$Archive = $true) {
    $env:EQUORI_LANG = $Lang
    $env:EQUORI_ZIP = if ($Archive) { $Zip } else { '' }
    $env:EQUORI_SUMS = if ($Archive) { "$work\SHA256SUMS" } else { '' }
    $out = Join-Path $work "install-$([guid]::NewGuid().ToString('N').Substring(0, 8)).out"
    $command = '[Console]::OutputEncoding = New-Object Text.UTF8Encoding $false; ' +
        "& '$Script' $($Switches -join ' '); " +
        'if ($null -eq $LASTEXITCODE) { exit 255 }; exit $LASTEXITCODE'
    $encoded = [Convert]::ToBase64String([Text.Encoding]::Unicode.GetBytes($command))
    $watch = [Diagnostics.Stopwatch]::StartNew()
    # Windows PowerShell 5.1 started from pwsh inherits its PSModulePath and fails to load the
    # PowerShell 7 modules (Get-FileHash, Unblock-File); unset, it uses its own default.
    $modules = $env:PSModulePath
    $env:PSModulePath = $null
    try {
        # -Wait would also wait for equori.exe, which the installation leaves running.
        $p = Start-Process powershell.exe -PassThru -WindowStyle Hidden `
            -ArgumentList '-NoProfile', '-ExecutionPolicy', 'Bypass', '-EncodedCommand', $encoded `
            -RedirectStandardOutput $out -RedirectStandardError "$out.err"
        # Reading the handle keeps the exit code of a process that ends early.
        $null = $p.Handle
        $p.WaitForExit()
    } finally {
        $env:PSModulePath = $modules
    }
    $watch.Stop()
    $text = [IO.File]::ReadAllText($out, $utf8)
    Write-Host $text
    $errors = [IO.File]::ReadAllText("$out.err", $utf8)
    if ($errors.Trim()) { Write-Host $errors }

    [pscustomobject]@{ Code = $p.ExitCode; Text = $text; Seconds = $watch.Elapsed.TotalSeconds }
}

# Get-Masked removes what differs between two runs: durations, sizes, counts, the operating
# system name, the version, the folder and the address with the token of the setup.
function Get-Masked([string]$Text) {
    $cc = [char]0x00E7
    $escaped = [regex]::Escape($version)
    $lines = ($Text -replace "`r`n", "`n").TrimEnd("`n") -split "`n"
    $masked = foreach ($line in $lines) {
        $line = $line.Replace($dir, '<dir>')
        $line = $line -replace "^equori $escaped ", 'equori <version> '
        $line = $line -replace '\s+\d+ s$', ''
        $line = $line -replace '[\d.,]+ MB', '<n> MB'
        $line = $line -replace '[\d.,]+ (files|arquivos)$', '<n> $1'
        $line = $line -replace 'Windows (10|11) (x64|Arm)', '<os>'
        $line -replace "^(  (Address|Endere${cc}o)\s+).+$", '$1<address>'
    }

    ($masked -join "`n") + "`n"
}

function Assert-Golden([string]$Name, [string]$Text) {
    $golden = ([IO.File]::ReadAllText((Join-Path $goldens $Name), $utf8)) -replace "`r`n", "`n"
    $actual = Get-Masked $Text
    if ($actual -ceq $golden) { return }

    [IO.File]::WriteAllText("$work\golden.txt", $golden, $utf8)
    [IO.File]::WriteAllText("$work\actual.txt", $actual, $utf8)
    git --no-pager diff --no-index --no-color --src-prefix=golden/ --dst-prefix=actual/ `
        "$work\golden.txt" "$work\actual.txt"
    throw "the output differs from scripts/testdata/$Name"
}

function Assert-Installed([object]$Run, [string]$What) {
    if ($Run.Code -ne 0) { throw "$What exited with $($Run.Code)" }
}

New-Item -ItemType Directory -Force $work | Out-Null
$listener = $null
try {
    $Zip = (Resolve-Path $Zip).Path
    $hash = (Get-FileHash -Algorithm SHA256 $Zip).Hash.ToLower()
    [IO.File]::WriteAllText("$work\SHA256SUMS", "$hash  $(Split-Path -Leaf $Zip)`n", $utf8)
    $env:EQUORI_DIR = $dir
    Remove-Item Env:EQUORI_HTTP_ADDR -ErrorAction SilentlyContinue

    $listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, 8080)
    $listener.Start()
    $run = Invoke-Installer 'en'
    $listener.Stop()
    $listener = $null
    if ($run.Code -eq 0 -or $run.Text -notmatch 'w4') { throw 'port 8080 in use did not stop with w4' }
    "1 a taken port stops the installation with w4 before any download"

    $run = Invoke-Installer 'en'
    Assert-Installed $run 'install.ps1'
    Assert-Golden 'install-windows.en.golden' $run.Text
    "2 install.ps1 prints the English golden"

    $marked = @(Get-ChildItem -LiteralPath $dir -Recurse -File -Force |
            Where-Object { -not $_.FullName.StartsWith("$data\", $ignoreCase) } |
            Where-Object { Get-Item -LiteralPath $_.FullName -Stream Zone.Identifier -ErrorAction SilentlyContinue })
    if ($marked.Count -gt 0) { throw "Zone.Identifier on $($marked[0].FullName)" }
    "3 no program file carries the mark of the web"

    $link = (New-Object -ComObject WScript.Shell).CreateShortcut($lnk)
    if ($link.TargetPath -ne "$dir\equori.exe") { throw "shortcut targets '$($link.TargetPath)'" }
    $runValue = (Get-ItemProperty $runKey -Name equori).equori
    if ($runValue -ne "`"$dir\equori.exe`" tray --background") { throw "Run value is '$runValue'" }
    $entry = Get-ItemProperty $uninstallKey
    $uninstallString = "powershell.exe -NoProfile -ExecutionPolicy Bypass -File `"$dir\install.ps1`" -Uninstall"
    $want = [ordered]@{
        DisplayName = 'equori'; DisplayVersion = $version; Publisher = 'equori'
        InstallLocation = $dir; DisplayIcon = "$dir\equori.exe"; UninstallString = $uninstallString
        NoModify = 1; NoRepair = 1
    }
    foreach ($name in $want.Keys) {
        if ($entry.$name -ne $want[$name]) { throw "uninstall entry $name is '$($entry.$name)'" }
    }
    if ($entry.EstimatedSize -le 0) { throw 'uninstall entry EstimatedSize is empty' }
    if (-not (Test-Path "$dir\install.ps1")) { throw 'install.ps1 is not in the folder' }
    "4 the shortcut, the Run value and the uninstall entry hold the contract values"

    Wait-Healthy 90
    $first = (& $cli version | Select-Object -First 1)
    if ($first -ne "equori $Tag") { throw "version is '$first', want 'equori $Tag'" }
    "5 /healthz answers 200 and equori-cli version reports $Tag"

    $url = (Get-Content "$data\setup.url" -Raw).Trim()
    $token = ([uri]$url).Fragment -replace '^#token=', ''
    $body = @{ token = $token; email = 'smoke@equori.test'; password = 'equori-smoke-test'; language = 'en'; region = $Region; base_currency = $Currency; update_check = $false } | ConvertTo-Json
    $r = Invoke-WebRequest -UseBasicParsing -Method Post -ContentType 'application/json' -Body $body "$base/api/v1/setup"
    if ($r.StatusCode -ne 201) { throw "setup answered $($r.StatusCode)" }
    # The cookie is Secure: a browser sends it to the loopback address, the .NET client does not.
    $cookie = (@($r.Headers['Set-Cookie']) -join ';') -replace '^.*?(equori_session=[^;]+).*$', '$1'
    $auth = @{ Cookie = $cookie }
    if (Test-Path "$data\setup.url") { throw 'setup.url is still there after the setup' }

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
    "6 first user created with the token of setup.url; an account and a transaction recorded"

    $dump = (& $cli backup | Select-Object -First 1)
    $pattern = '^' + [regex]::Escape("$data\backups\") + 'equori-[0-9-]+-s[0-9]+\.dump$'
    if ($dump -notmatch $pattern -or -not (Test-Path -LiteralPath $dump)) { throw "backup printed '$dump'" }
    "7 equori-cli backup wrote $dump"

    Start-Process "$dir\equori.exe" -WorkingDirectory $dir
    Start-Sleep -Seconds 10
    $count = (Get-Owned 'equori.exe').Count
    if ($count -ne 1) { throw "$count equori.exe processes run after a second start, want 1" }
    "8 a second start of equori.exe leaves one process"

    & $cli stop | Out-Host
    if ($LASTEXITCODE -ne 0) { throw "stop exited with $LASTEXITCODE" }
    for ($i = 0; $i -lt 10 -and (Get-Owned 'equori.exe', 'postgres.exe').Count -gt 0; $i++) {
        Start-Sleep -Seconds 1
    }
    $left = Get-Owned 'equori.exe', 'postgres.exe'
    if ($left.Count -gt 0) { throw "$($left[0].Name) still runs after stop" }
    $watch = [Diagnostics.Stopwatch]::StartNew()
    & $cli stop | Out-Host
    if ($LASTEXITCODE -ne 0 -or $watch.Elapsed.TotalSeconds -ge 2) {
        throw "stop with nothing running exited with $LASTEXITCODE after $($watch.Elapsed.TotalSeconds) s"
    }
    "9 stop ends equori.exe and postgres.exe, and returns 0 at once when nothing runs"

    Start-Process "$dir\equori.exe" -ArgumentList 'tray', '--background' -WorkingDirectory $dir
    Wait-Healthy 90
    if ((Transactions) -ne 1) { throw 'the transaction is gone after stop and start' }
    "10 equori.exe tray --background starts again with the transaction"

    $run = Invoke-Installer 'en' @('-Reinstall')
    Assert-Installed $run 'install.ps1 -Reinstall'
    if ($run.Text -notmatch 'upgrade from') { throw 'install.ps1 -Reinstall did not print the upgrade header' }
    Wait-Healthy 90
    if ((Transactions) -ne 1) { throw 'the transaction is gone after the reinstall' }
    $run = Invoke-Installer 'en' -Script "$dir\install.ps1" -Archive $false
    Assert-Installed $run 'install.ps1 of the folder'
    # The limit holds the start of powershell.exe; a download or a stop takes longer.
    if ($run.Text -notmatch 'is already installed in' -or $run.Seconds -ge 5) {
        throw "the second run took $($run.Seconds) s and printed: $($run.Text)"
    }
    "11 a reinstall over the running equori keeps the transaction; the next run ends at the header"

    $run = Invoke-Installer 'en' @('-Uninstall', '-KeepData')
    Assert-Installed $run 'install.ps1 -Uninstall -KeepData'
    $run = Invoke-Installer 'pt-BR'
    Assert-Installed $run 'install.ps1 after the uninstall'
    Assert-Golden 'install-windows.pt-BR.golden' $run.Text
    Wait-Healthy 90
    if ((Transactions) -ne 1) { throw 'the transaction is gone after uninstall and install' }
    "11b install.ps1 prints the Portuguese golden, and the kept data holds the transaction"

    $scanner = "$env:ProgramFiles\Windows Defender\MpCmdRun.exe"
    if (-not (Test-Path $scanner)) {
        "::warning::MpCmdRun.exe is absent; the Defender scan did not run"
    } else {
        $scan = & $scanner -Scan -ScanType 3 -File $dir -DisableRemediation
        $scan | Select-Object -Last 8 | Out-Host
        if ($LASTEXITCODE -eq 2) { throw 'Defender found a threat in the folder' }
        if ($LASTEXITCODE -ne 0) { "::warning::MpCmdRun.exe exited with $LASTEXITCODE; the scan did not complete" }
    }
    "12 the Defender scan of the folder"

    $run = Invoke-Installer 'en' @('-Uninstall', '-KeepData')
    Assert-Installed $run 'install.ps1 -Uninstall -KeepData'
    foreach ($name in 'equori.exe', 'equori-cli.exe', 'install.ps1', 'postgresql') {
        if (Test-Path "$dir\$name") { throw "$dir\$name is still there after the uninstall" }
    }
    if (Test-Path $lnk) { throw 'the shortcut is still there' }
    if (Get-ItemProperty $runKey -Name equori -ErrorAction SilentlyContinue) { throw 'the Run value is still there' }
    if (Test-Path $uninstallKey) { throw 'the uninstall entry is still there' }
    if ((Get-Owned 'equori.exe', 'postgres.exe').Count -gt 0) { throw 'a process of the folder still runs' }
    if (-not (Test-Path "$data\pg\PG_VERSION")) { throw 'the uninstall removed the data' }
    "13 the uninstall keeps the data and removes the program, the shortcut, the Run value and the entry"
} finally {
    if ($listener) { $listener.Stop() }
    Remove-Item -Recurse -Force $work -ErrorAction SilentlyContinue
}
