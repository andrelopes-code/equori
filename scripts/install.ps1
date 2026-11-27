# Installs, upgrades or uninstalls the native Windows form of equori in %LOCALAPPDATA%\equori
# (docs/specs/2026-11-27-windows-per-user-design.md, PW2). Windows PowerShell 5.1 parses this file:
# no operator that PowerShell 7 added, ASCII only. Native output stays out of the pipeline, so
# Invoke-EquoriInstall returns only its exit code.
param([switch]$Uninstall, [switch]$Yes, [switch]$KeepData, [switch]$Reinstall)

$version = 'dev'

function Invoke-EquoriInstall([bool]$Uninstall, [bool]$Yes, [bool]$KeepData, [bool]$Reinstall) {
    $aa = [char]0x00E1; $at = [char]0x00E3; $cc = [char]0x00E7
    $ia = [char]0x00ED; $oa = [char]0x00F3; $ot = [char]0x00F5; $ua = [char]0x00FA
    $ar = [char]0x2192; $dot = [char]0x00B7
    $ignoreCase = [StringComparison]::OrdinalIgnoreCase
    $ProgressPreference = 'SilentlyContinue'
    $repo = 'andrelopes-code/equori'
    # The running step is rewritten in place only on a console without NO_COLOR (PW2.14).
    $tty = -not [Console]::IsOutputRedirected -and -not $env:NO_COLOR
    $step = @{ Label = ''; Started = Get-Date; Width = 0 }
    $ctx = @{ Failed = $false; Version = $version; Old = ''; First = $true; Run = $false }
    $lang = $env:EQUORI_LANG
    if ($lang) { $pt = $lang -like 'pt*' } else { $pt = (Get-Culture).Name -like 'pt*' }
    $ci = [Globalization.CultureInfo]::GetCultureInfo($(if ($pt) { 'pt-BR' } else { 'en-US' }))
    $ref = $(if ($version -eq 'dev') { 'main' } else { "v$version" })
    $guide = "https://github.com/$repo/blob/$ref/docs/install/windows"
    if ($pt) { $guide += '.pt-BR' }
    $guide += '.md'
    $dir = $env:EQUORI_DIR
    if (-not $dir -and $PSScriptRoot -and (Test-Path (Join-Path $PSScriptRoot 'equori-cli.exe'))) {
        $dir = $PSScriptRoot
    }
    if (-not $dir) { $dir = Join-Path $env:LOCALAPPDATA 'equori' }
    $dir = $dir.TrimEnd('\')
    $cli = Join-Path $dir 'equori-cli.exe'
    $runKey = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Run'
    $uninstallKey = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\equori'
    $lnk = Join-Path ([Environment]::GetFolderPath('Programs')) 'equori.lnk'

    function Pick($en, $ptText) {
        if ($pt) { return $ptText }
        return $en
    }

    function Write-Color([string]$text, $color, [switch]$NoNewline) {
        $params = @{ Object = $text; NoNewline = [bool]$NoNewline }
        if ($color -and $tty) { $params.ForegroundColor = $color }
        Write-Host @params
    }

    function Format-Row($label, $detail, $duration) {
        $left = ($label.PadRight(20) + $detail).TrimEnd()
        if (-not $duration) { return $left }

        return $left.PadRight(51) + ' ' + $duration.PadLeft(3)
    }

    function Start-Step($en, $ptText) {
        $step.Label = Pick $en $ptText
        $step.Started = Get-Date
        Show-Tick
    }

    function Show-Tick($detail) {
        if (-not $tty) { return }

        $text = '  [..] ' + (Format-Row $step.Label $detail "$(Get-Elapsed) s")
        $step.Width = [Math]::Max($step.Width, $text.Length)
        Write-Host ("`r" + $text) -NoNewline
    }

    function Get-Elapsed {
        return [int]((Get-Date) - $step.Started).TotalSeconds
    }

    # Write-Line ends the running step with its mark; the padding covers the longer running text.
    function Write-Line($mark, $color, $text) {
        if ($tty) { Write-Host "`r" -NoNewline }

        Write-Host '  ' -NoNewline
        Write-Color $mark $color -NoNewline
        Write-Host (" $text").PadRight([Math]::Max(0, $step.Width - 6))
        $step.Label = ''
        $step.Width = 0
    }

    function Complete-Step($detail) {
        $seconds = Get-Elapsed
        $duration = $null
        if ($seconds -ge 2) { $duration = "$seconds s" }

        Write-Line '[ok]' Green (Format-Row $step.Label $detail $duration)
    }

    function Set-StepFailed {
        if ($step.Label) { Write-Line '[!!]' Red $step.Label }
    }

    function Get-Failure($code) {
        $failures = @{
            w1 = @{
                anchorEn = 'w1-windows-is-too-old'; anchorPt = 'w1-windows-antigo'
                en = 'equori needs Windows 10 version 1803 or later; this computer runs {ver}.'
                pt = ("O equori precisa do Windows 10 vers${at}o 1803 ou mais recente; " +
                    "este computador usa {ver}.")
                fixEn = 'Update Windows, then run the command again.'
                fixPt = 'Atualize o Windows e execute o comando de novo.'
            }
            w2 = @{
                anchorEn = 'w2-unsupported-processor'; anchorPt = 'w2-processador-sem-suporte'
                en = 'equori runs on x64 and Arm processors; this computer reports {arch}.'
                pt = 'O equori roda em processadores x64 e Arm; este computador informa {arch}.'
                fixEn = 'Use a computer with an x64 or Arm processor.'
                fixPt = 'Use um computador com processador x64 ou Arm.'
            }
            w3 = @{
                anchorEn = 'w3-folder-is-not-writable'; anchorPt = 'w3-pasta-sem-escrita'
                en = '{dir} does not accept new files.'
                pt = "{dir} n${at}o aceita arquivos novos."
                fixEn = 'Set $env:EQUORI_DIR to another folder, then run the command again.'
                fixPt = 'Defina $env:EQUORI_DIR com outra pasta e execute o comando de novo.'
            }
            w4 = @{
                anchorEn = 'w4-port-in-use'; anchorPt = 'w4-porta-em-uso'
                en = 'Port {port} is in use by {process}.'
                pt = "A porta {port} est${aa} em uso por {process}."
                fixEn = ('Close that program, or set EQUORI_HTTP_ADDR=127.0.0.1:8081 in ' +
                    '{dir}\data\equori.env, then run the command again.')
                fixPt = ('Feche esse programa ou defina EQUORI_HTTP_ADDR=127.0.0.1:8081 em ' +
                    "{dir}\data\equori.env e execute o comando de novo.")
            }
            w5 = @{
                anchorEn = 'w5-smart-app-control-is-on'; anchorPt = 'w5-smart-app-control-ligado'
                en = ('Smart App Control is on: Windows blocks programs without a code ' +
                    'signature, and equori has none.')
                pt = ("O Controle Inteligente de Aplicativos est${aa} ligado: o Windows bloqueia " +
                    "programas sem assinatura digital, e o equori n${at}o tem.")
                fixEn = ("Turn it off in Windows Security $ar App & browser control $ar " +
                    'Smart App Control, then run the command again. Turning it back on may ' +
                    'require resetting Windows.')
                fixPt = ("Desligue-o em Seguran${cc}a do Windows $ar Controle de aplicativos " +
                    "e do navegador $ar Controle Inteligente de Aplicativos e execute o " +
                    "comando de novo. Relig${aa}-lo pode exigir a redefini${cc}${at}o do " +
                    'Windows.')
            }
            w6 = @{
                anchorEn = 'w6-download-failed'; anchorPt = 'w6-download-falhou'
                en = 'The download of {url} failed after 3 attempts: {error}.'
                pt = "O download de {url} falhou ap${oa}s 3 tentativas: {error}."
                fixEn = 'Check the internet connection, then run the command again.'
                fixPt = "Verifique a conex${at}o com a internet e execute o comando de novo."
            }
            w7 = @{
                anchorEn = 'w7-checksum-mismatch'; anchorPt = 'w7-checksum-diferente'
                en = 'The downloaded file does not match SHA256SUMS of the release.'
                pt = "O arquivo baixado n${at}o confere com o SHA256SUMS do release."
                fixEn = ('Run the command again; if it repeats, report it at ' +
                    'github.com/andrelopes-code/equori/issues.')
                fixPt = ('Execute o comando de novo; se repetir, relate em ' +
                    'github.com/andrelopes-code/equori/issues.')
            }
            w8 = @{
                anchorEn = 'w8-equori-does-not-stop'; anchorPt = 'w8-equori-nao-para'
                en = 'The running equori did not stop within 90 seconds.'
                pt = "O equori em execu${cc}${at}o n${at}o parou em 90 segundos."
                fixEn = 'Quit equori from its tray icon, then run the command again.'
                fixPt = "Saia do equori pelo ${ia}cone na bandeja e execute o comando de novo."
            }
            w9 = @{
                anchorEn = 'w9-equori-does-not-start'; anchorPt = 'w9-equori-nao-inicia'
                en = ('equori did not answer on {url}healthz within 120 seconds; the last lines ' +
                    'of its log are above.')
                pt = ("O equori n${at}o respondeu em {url}healthz em 120 segundos; as " +
                    "${ua}ltimas linhas do log est${at}o acima.")
                fixEn = 'Read {dir}\data\log\equori.log; it names the cause.'
                fixPt = 'Leia {dir}\data\log\equori.log; ele nomeia a causa.'
            }
        }
        return $failures[$code]
    }

    function Expand-Text([string]$text, $values) {
        foreach ($key in $values.Keys) { $text = $text.Replace("{$key}", [string]$values[$key]) }
        return $text
    }

    # Split-Words breaks text at spaces so that no printed line passes 80 columns.
    function Split-Words([string]$prefix, [string]$text) {
        $indent = ' ' * $prefix.Length
        $lines = @()
        $line = $prefix
        $fresh = $true
        foreach ($word in $text.Split(' ')) {
            if ($fresh) {
                $line += $word
            } elseif (($line.Length + 1 + $word.Length) -gt 80) {
                $lines += $line
                $line = $indent + $word
            } else {
                $line += ' ' + $word
            }
            $fresh = $false
        }
        return @($lines + $line)
    }

    function Write-Wrapped([string]$prefix, $color, [string]$text) {
        $lines = @(Split-Words $prefix $text)
        $cut = $prefix.TrimEnd().Length
        $head = $lines[0].Substring(0, $cut)
        $tail = $lines[0].Substring($cut)
        Write-Color $head $color -NoNewline
        Write-Color $tail $null
        foreach ($line in $lines | Select-Object -Skip 1) { Write-Color $line $null }
    }

    # Stop-Install ends the running step, prints the failure lines of PW2.12 and marks the run.
    function Stop-Install($code, $values) {
        $failure = Get-Failure $code
        Set-StepFailed
        Write-Host ''
        Write-Wrapped (Pick 'Error: ' 'Erro: ') Red `
            (Expand-Text (Pick $failure.en $failure.pt) $values)
        Write-Wrapped (Pick 'How to fix: ' 'Como resolver: ') $null `
            (Expand-Text (Pick $failure.fixEn $failure.fixPt) $values)
        Write-Host ($guide + '#' + (Pick $failure.anchorEn $failure.anchorPt))
        $ctx.Failed = $true
    }

    function Write-LogTail {
        $file = Join-Path $dir 'data\log\equori.log'
        if (-not (Test-Path -LiteralPath $file)) { return }

        Write-Host ''
        foreach ($line in Get-Content -LiteralPath $file -Tail 20) {
            foreach ($part in [regex]::Matches([string]$line, '.{1,80}')) { Write-Host $part.Value }
        }
    }

    function Write-Header($text) {
        Write-Color $text White
        Write-Host ''
    }

    function Get-InstalledVersion {
        if (-not (Test-Path -LiteralPath $cli)) { return '' }

        try { $first = & $cli version 2> $null | Select-Object -First 1 } catch { return '' }
        if ("$first" -match '^equori v(.+)$') { return $Matches[1].Trim() }
        return ''
    }

    function New-Client {
        Add-Type -AssemblyName System.Net.Http
        $client = New-Object System.Net.Http.HttpClient
        $client.Timeout = [TimeSpan]::FromMinutes(30)
        $client.DefaultRequestHeaders.UserAgent.ParseAdd('equori-install')
        return $client
    }

    # Invoke-Retry runs the action up to 3 times, 2 seconds apart (PW2.11); $ctx keeps the error.
    function Invoke-Retry([scriptblock]$action) {
        for ($attempt = 1; $attempt -le 3; $attempt++) {
            try {
                & $action
                return $true
            } catch {
                $cause = $_.Exception
                while ($cause.InnerException) { $cause = $cause.InnerException }
                $ctx.Error = $cause.Message.TrimEnd('.')
                if ($attempt -lt 3) { Start-Sleep -Seconds 2 }
            }
        }
        return $false
    }

    function Get-Text([string]$url) {
        $client = New-Client
        try {
            return $client.GetStringAsync($url).GetAwaiter().GetResult()
        } finally {
            $client.Dispose()
        }
    }

    function Resolve-Version {
        if ($version -ne 'dev') { return $true }

        if ($env:EQUORI_ZIP) {
            if ((Split-Path -Leaf $env:EQUORI_ZIP) -match '^equori_(.+)_windows_amd64\.zip$') {
                $ctx.Version = $Matches[1]
            }
            return $true
        }

        $ctx.Api = "https://api.github.com/repos/$repo/releases/latest"
        $found = Invoke-Retry {
            $ctx.Version = ((Get-Text $ctx.Api) | ConvertFrom-Json).tag_name.TrimStart('v')
        }
        if (-not $found) {
            Stop-Install 'w6' @{ url = $ctx.Api; error = $ctx.Error }
            return $false
        }

        return $true
    }

    function Get-Address {
        $addr = '127.0.0.1:8080'
        $file = Join-Path $dir 'data\equori.env'
        if (Test-Path -LiteralPath $file) {
            foreach ($line in Get-Content -LiteralPath $file) {
                $pattern = '^\s*EQUORI_HTTP_ADDR\s*=\s*"?([^"\s]+)"?\s*$'
                if ($line -match $pattern) { $addr = $Matches[1] }
            }
        }

        $hostName = '127.0.0.1'
        $ctx.Port = 8080
        if ($addr -match '^(.*):(\d+)$') {
            $ctx.Port = [int]$Matches[2]
            if ($Matches[1] -and $Matches[1] -notin '0.0.0.0', '[::]') { $hostName = $Matches[1] }
        }
        $ctx.Url = "http://${hostName}:$($ctx.Port)/"
    }

    # Find-PortOwner names the first listener outside the folder; the folder's equori passes.
    function Find-PortOwner {
        $listeners = @(Get-NetTCPConnection -State Listen -LocalPort $ctx.Port `
            -ErrorAction SilentlyContinue)
        foreach ($listener in $listeners) {
            $proc = Get-Process -Id $listener.OwningProcess -ErrorAction SilentlyContinue
            $path = $null
            try { if ($proc) { $path = $proc.Path } } catch { $path = $null }
            if ($path -and $path.StartsWith("$dir\", $ignoreCase)) { continue }

            if ($proc) { return $proc.ProcessName }
            return "PID $($listener.OwningProcess)"
        }
        return $null
    }

    function Test-FolderWritable {
        try {
            $null = New-Item -ItemType Directory -Force -Path $dir -ErrorAction Stop
            $probe = Join-Path $dir ".write-test-$([guid]::NewGuid().ToString('N'))"
            [IO.File]::WriteAllText($probe, 'x')
            Remove-Item -LiteralPath $probe -Force -ErrorAction Stop
            return $true
        } catch {
            return $false
        }
    }

    function Test-SmartAppControl {
        $policy = 'HKLM:\SYSTEM\CurrentControlSet\Control\CI\Policy'
        $item = Get-ItemProperty -Path $policy -Name VerifiedAndReputablePolicyState `
            -ErrorAction SilentlyContinue
        return ($item -and $item.VerifiedAndReputablePolicyState -eq 1)
    }

    function Invoke-Checks {
        Start-Step 'Checks' "Verifica${cc}${ot}es"
        $os = [Environment]::OSVersion.Version
        if ($os.Build -lt 17134) {
            Stop-Install 'w1' @{ ver = $os.ToString() }
            return
        }

        $arch = $env:PROCESSOR_ARCHITECTURE
        if ($env:PROCESSOR_ARCHITEW6432) { $arch = $env:PROCESSOR_ARCHITEW6432 }
        if ($arch -notin 'AMD64', 'ARM64') {
            Stop-Install 'w2' @{ arch = $arch }
            return
        }

        if (-not (Test-FolderWritable)) {
            Stop-Install 'w3' @{ dir = $dir }
            return
        }

        Get-Address
        $owner = Find-PortOwner
        if ($owner) {
            Stop-Install 'w4' @{ port = $ctx.Port; process = $owner; dir = $dir }
            return
        }

        if (Test-SmartAppControl) {
            Stop-Install 'w5' @{}
            return
        }

        $name = $(if ($os.Build -ge 22000) { 'Windows 11' } else { 'Windows 10' })
        $cpu = $(if ($arch -eq 'ARM64') { 'Arm' } else { 'x64' })
        $port = Pick "port $($ctx.Port) free" "porta $($ctx.Port) livre"
        Complete-Step "$name $cpu, $port"
    }

    function Format-Megabytes($bytes) {
        return ($bytes / 1MB).ToString('N1', $ci)
    }

    function Show-Download($received, $total) {
        if (-not $total) {
            Show-Tick ((Format-Megabytes $received) + ' MB')
            return
        }

        $percent = [int](100 * $received / $total)
        Show-Tick ("$(Format-Megabytes $received) / $(Format-Megabytes $total) MB  $percent%")
    }

    function Save-Download([string]$url, [string]$path) {
        $client = New-Client
        try {
            $mode = [System.Net.Http.HttpCompletionOption]::ResponseHeadersRead
            $response = $client.GetAsync($url, $mode).GetAwaiter().GetResult()
            $null = $response.EnsureSuccessStatusCode()
            $total = $response.Content.Headers.ContentLength
            $source = $response.Content.ReadAsStreamAsync().GetAwaiter().GetResult()
            $target = [IO.File]::Create($path)
            try {
                $buffer = New-Object byte[] 81920
                $received = 0
                $shown = Get-Date
                while (($count = $source.Read($buffer, 0, $buffer.Length)) -gt 0) {
                    $target.Write($buffer, 0, $count)
                    $received += $count
                    if (((Get-Date) - $shown).TotalMilliseconds -ge 200) {
                        Show-Download $received $total
                        $shown = Get-Date
                    }
                }
            } finally {
                $target.Dispose()
                $source.Dispose()
            }
        } finally {
            $client.Dispose()
        }
    }

    function Invoke-Download {
        Start-Step 'Download' 'Download'
        $asset = "equori_$($ctx.Version)_windows_amd64.zip"
        $base = "https://github.com/$repo/releases/download/v$($ctx.Version)"
        $ctx.Asset = $asset
        $ctx.Zip = $env:EQUORI_ZIP
        if (-not $ctx.Zip) {
            $ctx.Zip = Join-Path $ctx.Work $asset
            $done = Invoke-Retry { Save-Download "$base/$asset" $ctx.Zip }
            if (-not $done) {
                Stop-Install 'w6' @{ url = "$base/$asset"; error = $ctx.Error }
                return
            }
        }

        if ($env:EQUORI_SUMS) {
            $ctx.Sums = Get-Content -LiteralPath $env:EQUORI_SUMS -Raw
        } else {
            $done = Invoke-Retry { $ctx.Sums = Get-Text "$base/SHA256SUMS" }
            if (-not $done) {
                Stop-Install 'w6' @{ url = "$base/SHA256SUMS"; error = $ctx.Error }
                return
            }
        }

        Complete-Step ((Format-Megabytes (Get-Item -LiteralPath $ctx.Zip).Length) + ' MB')
    }

    function Find-Checksum([string]$sums, [string]$asset) {
        foreach ($line in $sums -split "`r?`n") {
            if ($line -match '^([0-9a-fA-F]{64})\s+\*?(.+?)\s*$' -and $Matches[2] -eq $asset) {
                return $Matches[1]
            }
        }
        return $null
    }

    function Invoke-Verify {
        Start-Step 'SHA-256' 'SHA-256'
        $expected = Find-Checksum $ctx.Sums $ctx.Asset
        $actual = (Get-FileHash -Algorithm SHA256 -LiteralPath $ctx.Zip).Hash
        if (-not $expected -or $actual -ne $expected) {
            Stop-Install 'w7' @{}
            return
        }

        Complete-Step (Pick 'matches' 'confere')
    }

    function Invoke-StopRunning {
        if (-not (Test-Path -LiteralPath $cli)) { return }

        Start-Step 'Stop' 'Parada'
        $out = Join-Path $ctx.Work 'stop.out'
        $err = Join-Path $ctx.Work 'stop.err'
        $proc = Start-Process -FilePath $cli -ArgumentList 'stop' -WorkingDirectory $env:TEMP `
            -WindowStyle Hidden -PassThru -RedirectStandardOutput $out -RedirectStandardError $err
        # Reading the handle keeps the exit code of a process that ends before the loop looks.
        $null = $proc.Handle
        while (-not $proc.HasExited) {
            Show-Tick
            Start-Sleep -Milliseconds 500
        }

        $proc.WaitForExit()
        if ($proc.ExitCode -ne 0) {
            Stop-Install 'w8' @{}
            return
        }

        Complete-Step
    }

    function Copy-ProgramFiles {
        $files = Join-Path $ctx.Work 'files'
        Add-Type -AssemblyName System.IO.Compression.FileSystem
        [IO.Compression.ZipFile]::ExtractToDirectory($ctx.Zip, $files)
        $extracted = @(Get-ChildItem -LiteralPath $files -Recurse -File -Force)
        $ctx.Files = $extracted.Count
        $ctx.Size = [int](($extracted | Measure-Object -Property Length -Sum).Sum / 1KB)
        if (Test-Path -LiteralPath (Join-Path $dir 'postgresql')) {
            Remove-Item -LiteralPath (Join-Path $dir 'postgresql') -Recurse -Force -ErrorAction Stop
        }

        Copy-Item -Path (Join-Path $files '*') -Destination $dir -Recurse -Force -ErrorAction Stop
        $data = "$dir\data\"
        Get-ChildItem -LiteralPath $dir -Recurse -File -Force |
            Where-Object { -not $_.FullName.StartsWith($data, $ignoreCase) } |
            Unblock-File
    }

    function Invoke-Files {
        Start-Step 'Files' 'Arquivos'
        try {
            Copy-ProgramFiles
        } catch {
            Stop-Install 'w3' @{ dir = $dir }
            return
        }

        $count = $ctx.Files.ToString('N0', $ci)
        Complete-Step (Pick "$count files" "$count arquivos")
    }

    function Set-Shortcut {
        $shell = New-Object -ComObject WScript.Shell
        $link = $shell.CreateShortcut($lnk)
        $link.TargetPath = "$dir\equori.exe"
        $link.WorkingDirectory = $dir
        $link.Description = 'equori'
        $link.Save()
    }

    function Set-RunValue {
        $command = "`"$dir\equori.exe`" tray --background"
        $null = New-ItemProperty -Path $runKey -Name 'equori' -Value $command `
            -PropertyType String -Force
    }

    # Set-UninstallEntry writes the entry of Settings -> Apps; its command is the one of A3.
    function Set-UninstallEntry {
        $command = 'powershell.exe -NoProfile -ExecutionPolicy Bypass -File ' +
            "`"$dir\install.ps1`" -Uninstall"
        $null = New-Item -Path $uninstallKey -Force
        $strings = @{
            DisplayName = 'equori'; DisplayVersion = $ctx.Version; Publisher = 'equori'
            InstallLocation = $dir; DisplayIcon = "$dir\equori.exe"; UninstallString = $command
        }
        foreach ($name in $strings.Keys) {
            $null = New-ItemProperty -Path $uninstallKey -Name $name -Value $strings[$name] `
                -PropertyType String -Force
        }

        $numbers = @{ NoModify = 1; NoRepair = 1; EstimatedSize = $ctx.Size }
        foreach ($name in $numbers.Keys) {
            $null = New-ItemProperty -Path $uninstallKey -Name $name -Value $numbers[$name] `
                -PropertyType DWord -Force
        }
    }

    function Invoke-Shortcuts {
        Start-Step 'Shortcuts' 'Atalhos'
        Set-Shortcut
        $detail = Pick 'Start menu' 'Menu Iniciar'
        # An upgrade keeps the state of "Start with Windows" (PW2.7).
        if ($ctx.First -or $ctx.Run) {
            Set-RunValue
            $detail += Pick ', Start with Windows' ', Iniciar com o Windows'
        }

        Set-UninstallEntry
        Complete-Step $detail
    }

    function Wait-Health {
        $url = $ctx.Url + 'healthz'
        while ((Get-Elapsed) -lt 120) {
            try {
                $reply = Invoke-WebRequest -UseBasicParsing -TimeoutSec 2 -Uri $url
                if ($reply.StatusCode -eq 200) { return $true }
            } catch { }

            Show-Tick
            Start-Sleep -Seconds 1
        }
        return $false
    }

    function Invoke-Start {
        Start-Step 'Start' "In${ia}cio"
        # A first start opens the browser itself; an upgrade starts the tray without opening it.
        if ($ctx.First) {
            Start-Process -FilePath "$dir\equori.exe" -WorkingDirectory $dir
        } else {
            Start-Process -FilePath "$dir\equori.exe" -ArgumentList 'tray', '--background' `
                -WorkingDirectory $dir
        }

        if (-not (Wait-Health)) {
            Set-StepFailed
            Write-LogTail
            Stop-Install 'w9' @{ url = $ctx.Url; dir = $dir }
            return
        }

        Complete-Step (Pick 'answer on /healthz' 'resposta em /healthz')
    }

    function Get-SetupUrl {
        $file = Join-Path $dir 'data\setup.url'
        for ($attempt = 0; $attempt -lt 10; $attempt++) {
            if (Test-Path -LiteralPath $file) {
                $text = (Get-Content -LiteralPath $file -Raw).Trim()
                if ($text) { return $text }
            }
            if (-not $ctx.First) { break }

            Start-Sleep -Seconds 1
        }
        return $ctx.Url
    }

    function Write-Field($label, $value, $color) {
        Write-Host ('  ' + $label.PadRight(13)) -NoNewline
        Write-Color $value $color
    }

    function Write-Summary {
        Write-Host ''
        if ($ctx.First) {
            Write-Color (Pick 'equori is installed.' "O equori est${aa} instalado.") Green
        } else {
            Write-Color (Pick "equori is upgraded to $($ctx.Version)." `
                "O equori foi atualizado para $($ctx.Version).") Green
        }

        Write-Field (Pick 'Address' "Endere${cc}o") (Get-SetupUrl) Cyan
        Write-Field (Pick 'Folder' 'Pasta') $dir $null
        Write-Field (Pick 'Open' 'Abrir') (Pick "Start menu $ar equori, or the tray icon" `
            "Menu Iniciar $ar equori, ou o ${ia}cone na bandeja") $null
        Write-Field (Pick 'Upgrade' 'Atualizar') (Pick 'run the same command again' `
            'execute de novo o mesmo comando') $null
        Write-Field (Pick 'Uninstall' 'Desinstalar') (Pick "Settings $ar Apps $ar equori" `
            "Configura${cc}${ot}es $ar Apps $ar equori") $null
        if (-not $ctx.First) { return }

        Write-Host ''
        Write-Color (Pick 'Keep a copy of data\secret.key apart from the backups.' `
            "Guarde uma c${oa}pia de data\secret.key longe dos backups.") Yellow
        Write-Color (Pick 'Without it, the bank connections cannot be read.' `
            "Sem ela, as conex${ot}es banc${aa}rias n${at}o podem ser lidas.") Yellow
    }

    function Invoke-InstallSteps {
        Invoke-Checks
        if ($ctx.Failed) { return }

        Invoke-Download
        if ($ctx.Failed) { return }

        Invoke-Verify
        if ($ctx.Failed) { return }

        Invoke-StopRunning
        if ($ctx.Failed) { return }

        Invoke-Files
        if ($ctx.Failed) { return }

        Invoke-Shortcuts
        Invoke-Start
    }

    function Invoke-Install {
        $v = $ctx.Version
        if ($ctx.Old -and $ctx.Old -eq $v -and -not $Reinstall -and -not $env:EQUORI_ZIP) {
            Write-Color (Pick "equori $v is already installed in $dir." `
                "O equori $v j${aa} est${aa} instalado em $dir.") White
            return
        }

        if ($ctx.Old) {
            Write-Header (Pick "equori $v $dot upgrade from $($ctx.Old) in $dir" `
                "equori $v $dot atualiza${cc}${at}o de $($ctx.Old) em $dir")
        } else {
            Write-Header (Pick "equori $v $dot installation into $dir" `
                "equori $v $dot instala${cc}${at}o em $dir")
        }

        $runValue = Get-ItemProperty -Path $runKey -Name 'equori' -ErrorAction SilentlyContinue
        $ctx.Run = $null -ne $runValue
        Invoke-InstallSteps
        if (-not $ctx.Failed) { Write-Summary }
    }

    function Remove-ProgramFiles {
        # The folder is the working directory of nothing that is deleted below.
        Set-Location $env:TEMP
        $keep = Join-Path $dir 'data'
        Get-ChildItem -LiteralPath $dir -Force -ErrorAction SilentlyContinue |
            Where-Object { $_.FullName -ne $keep } |
            Remove-Item -Recurse -Force -ErrorAction SilentlyContinue
        return @(Get-ChildItem -LiteralPath $dir -Force -ErrorAction SilentlyContinue |
            Where-Object { $_.FullName -ne $keep })
    }

    # Stop-Leftovers ends an uninstall that left files behind: a program still holds them.
    function Stop-Leftovers($items) {
        Set-StepFailed
        Write-Host ''
        foreach ($item in @($items | Select-Object -First 5)) { Write-Host "  $($item.FullName)" }
        Write-Color (Pick "These files are still in ${dir}: close the programs that use them," `
            "Estes arquivos continuam em ${dir}: feche os programas que os usam") Red
        Write-Color (Pick 'then run the uninstall again.' `
            "e execute a desinstala${cc}${at}o de novo.") Red
        $ctx.Failed = $true
    }

    function Remove-Shortcuts {
        Remove-Item -LiteralPath $lnk -Force -ErrorAction SilentlyContinue
        Remove-ItemProperty -Path $runKey -Name 'equori' -ErrorAction SilentlyContinue
        Remove-Item -Path $uninstallKey -Recurse -Force -ErrorAction SilentlyContinue
    }

    function Read-DeleteData {
        if ($KeepData) { return $false }
        if ($Yes) { return $true }

        Write-Host (Pick "Delete the data in $dir\data, backups included? [y/N] " `
            "Apagar os dados em $dir\data, backups inclu${ia}dos? [s/N] ") -NoNewline
        try { $answer = [Console]::ReadLine() } catch { $answer = '' }
        return ("$answer".Trim() -match '^(y|yes|s|sim)$')
    }

    function Invoke-Uninstall {
        $old = $ctx.Old
        if (-not $old) { $old = $version }
        Write-Header (Pick "equori $old $dot uninstall from $dir" `
            "equori $old $dot desinstala${cc}${at}o de $dir")
        Invoke-StopRunning
        if ($ctx.Failed) { return }

        Start-Step 'Files' 'Arquivos'
        $left = Remove-ProgramFiles
        if ($left.Count -gt 0) { return (Stop-Leftovers $left) }

        Complete-Step
        Start-Step 'Shortcuts' 'Atalhos'
        Remove-Shortcuts
        Complete-Step
        Write-Host ''
        if (Read-DeleteData) {
            Start-Step 'Files' 'Arquivos'
            Remove-Item -LiteralPath $dir -Recurse -Force -ErrorAction SilentlyContinue
            if (Test-Path -LiteralPath $dir) {
                return (Stop-Leftovers @(Get-ChildItem -LiteralPath $dir -Recurse -Force -File))
            }

            Complete-Step
            Write-Color (Pick 'equori is uninstalled and its data is deleted.' `
                "O equori foi desinstalado e os dados foram apagados.") Green
            return
        }

        Write-Color (Pick "equori is uninstalled. The data stays in $dir\data." `
            "O equori foi desinstalado. Os dados continuam em $dir\data.") Green
    }

    $ctx.Old = Get-InstalledVersion
    $ctx.First = -not (Test-Path -LiteralPath $cli)
    $ctx.Work = Join-Path $env:TEMP "equori-$([guid]::NewGuid().ToString('N').Substring(0, 8))"
    try {
        $null = New-Item -ItemType Directory -Force -Path $ctx.Work
        if ($Uninstall) {
            Invoke-Uninstall
        } elseif (Resolve-Version) {
            Invoke-Install
        }
    } finally {
        Remove-Item -LiteralPath $ctx.Work -Recurse -Force -ErrorAction SilentlyContinue
    }

    if ($ctx.Failed) { return 1 }
    return 0
}

$tls = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12
[Net.ServicePointManager]::SecurityProtocol = $tls
$result = Invoke-EquoriInstall ([bool]$Uninstall) ([bool]$Yes) ([bool]$KeepData) ([bool]$Reinstall)
$code = @($result)[-1]
# Under irm | iex, exit would close the terminal that shows the message.
if ($PSCommandPath) { exit $code }
$global:LASTEXITCODE = $code
