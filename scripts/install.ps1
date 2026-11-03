# Installs or upgrades equori under compose in %USERPROFILE%\equori (docs/install/windows.md; P14 A163).
# Windows PowerShell 5.1 parses this file: no operator that PowerShell 7 added. Native output goes to Out-Host, so
# Invoke-EquoriInstall returns only its exit code.
$version = 'dev'

function Invoke-EquoriInstall {
    $aa = [char]0x00E1; $ac = [char]0x00E2; $at = [char]0x00E3; $cc = [char]0x00E7; $ea = [char]0x00E9
    $ec = [char]0x00EA; $ia = [char]0x00ED; $oa = [char]0x00F3; $ot = [char]0x00F5; $ua = [char]0x00FA
    $ProgressPreference = 'SilentlyContinue'
    $repo = 'andrelopes-code/equori'
    $dir = Join-Path $env:USERPROFILE 'equori'
    $envFile = Join-Path $dir '.env'
    $log = Join-Path $dir 'install.log'
    # The running step is rewritten in place only on a console (A190.2).
    $tty = -not [Console]::IsOutputRedirected
    $step = @{ Label = ''; Started = Get-Date; Width = 0 }
    $pt = (Get-Culture).Name -like 'pt*'
    if ($version -eq 'dev') {
        $ref = 'main'
        $download = "https://github.com/$repo/releases/latest/download"
    } else {
        $ref = "v$version"
        $download = "https://github.com/$repo/releases/download/v$version"
    }
    $guide = "https://github.com/$repo/blob/$ref/docs/install/windows"
    if ($pt) { $guide += '.pt-BR' }
    $guide += '.md'

    function Pick($en, $ptText) {
        if ($pt) { return $ptText }
        return $en
    }

    function Say($en, $ptText) {
        Write-Host (Pick $en $ptText)
    }

    function Start-Step($en, $ptText) {
        $step.Label = Pick $en $ptText
        $step.Started = Get-Date
        Show-Tick
    }

    function Show-Tick {
        if (-not $tty) { return }

        $text = '  [..] {0} {1} s' -f $step.Label, (Get-Elapsed)
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
        Write-Host $mark -ForegroundColor $color -NoNewline
        Write-Host (" $text").PadRight([Math]::Max(0, $step.Width - 6))
        $step.Label = ''
        $step.Width = 0
    }

    function Complete-Step($detail) {
        $text = $step.Label
        if ($detail) { $text += " $detail" }

        $seconds = Get-Elapsed
        if ($seconds -ge 2) { $text += " ($seconds s)" }

        Write-Line '[ok]' Green $text
    }

    function Set-StepFailed {
        if ($step.Label) { Write-Line '[!!]' Red $step.Label }
    }

    function Stop-Install($anchorEn, $anchorPt, $en, $ptText) {
        Set-StepFailed
        Write-Host ''
        Write-Host ((Pick 'Error: ' 'Erro: ') + (Pick $en $ptText)) -ForegroundColor Red
        Write-Host ((Pick 'How to fix: ' 'Como resolver: ') + $guide + '#' + (Pick $anchorEn $anchorPt))
        return 1
    }

    # Invoke-Logged runs docker with its output in the log; a failure prints the end of the log (A190.5).
    function Invoke-Logged([string[]]$arguments) {
        $docker = (Get-Command docker).Source
        $p = Start-Process -FilePath $docker -ArgumentList $arguments -WorkingDirectory $dir -NoNewWindow -PassThru `
            -RedirectStandardOutput "$log.out" -RedirectStandardError "$log.err"
        # Reading the handle keeps the exit code of a process that ends before the loop looks.
        $null = $p.Handle
        while (-not $p.HasExited) {
            Show-Tick
            Start-Sleep -Seconds 1
        }

        $p.WaitForExit()
        Get-Content "$log.out", "$log.err" | Add-Content $log
        Remove-Item "$log.out", "$log.err"
        if ($p.ExitCode -eq 0) { return 0 }

        Set-StepFailed
        Write-Host ''
        Get-Content $log -Tail 20 | Out-Host
        Say "Full log: $log" "Log completo: $log"
        return 1
    }

    Write-Host "equori $version" -ForegroundColor White
    if (Test-Path $envFile) {
        Say "Upgrading $dir" "Atualizando $dir"
    } else {
        Say "Installing into $dir" "Instalando em $dir"
    }
    Write-Host ''

    Start-Step 'Docker' 'Docker'
    if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
        return (Stop-Install 'i1-docker-is-not-installed' 'i1-docker-ausente' `
            'Docker is not installed or not on the PATH. Install Docker, then run this command again.' `
            "O Docker n${at}o est${aa} instalado ou n${at}o est${aa} no PATH. Instale o Docker e execute este comando de novo.")
    }
    docker info *> $null
    $desktop = Join-Path $env:ProgramFiles 'Docker\Docker\Docker Desktop.exe'
    if ($LASTEXITCODE -ne 0 -and (Test-Path $desktop)) {
        # Docker Desktop installed but not started: start it and wait up to 120 seconds (A190.4).
        Start-Process $desktop
        $step.Label = Pick 'Docker (starting Docker Desktop)' 'Docker (abrindo o Docker Desktop)'
        do {
            Show-Tick
            Start-Sleep -Seconds 1
            docker info *> $null
        } while ($LASTEXITCODE -ne 0 -and (Get-Elapsed) -lt 120)
        $step.Label = 'Docker'
    }
    if ($LASTEXITCODE -ne 0) {
        return (Stop-Install 'i2-docker-does-not-answer' 'i2-docker-sem-resposta' `
            'Docker does not answer. Start Docker Desktop, or on Linux start the docker service and add the user to the docker group.' `
            "O Docker n${at}o responde. Abra o Docker Desktop ou, no Linux, inicie o servi${cc}o docker e inclua o usu${aa}rio no grupo docker.")
    }
    docker compose version *> $null
    if ($LASTEXITCODE -ne 0) {
        return (Stop-Install 'i3-docker-compose-v2-is-missing' 'i3-docker-compose-v2-ausente' `
            'Docker Compose v2 is missing: docker compose version fails. Install the Compose plugin.' `
            "O Docker Compose v2 est${aa} ausente: docker compose version falha. Instale o plugin Compose.")
    }
    # The kernel version is the one value that tells the WSL 2 engine from Hyper-V (A163.3).
    $kernel = docker info --format '{{.KernelVersion}}' 2> $null
    if ("$kernel" -notmatch 'WSL2') {
        if (-not (Get-Command wsl.exe -ErrorAction SilentlyContinue)) {
            return (Stop-Install 'i4-docker-does-not-use-wsl-2' 'i4-docker-sem-wsl-2' `
                'Windows Subsystem for Linux is missing. Run wsl --install in a terminal opened as administrator, restart Windows, then run this command again.' `
                "O Subsistema do Windows para Linux est${aa} ausente. Execute wsl --install num terminal aberto como administrador, reinicie o Windows e execute este comando de novo.")
        }
        return (Stop-Install 'i4-docker-does-not-use-wsl-2' 'i4-docker-sem-wsl-2' `
            'Docker Desktop does not use the WSL 2 engine. Turn on Settings > General > "Use the WSL 2 based engine", then run this command again.' `
            "O Docker Desktop n${at}o usa o motor WSL 2. Ative Settings > General > ""Use the WSL 2 based engine"" e execute este comando de novo.")
    }

    Complete-Step (docker version --format '{{.Server.Version}}' 2> $null)

    # A196: the tag of the running image names the version an upgrade replaces.
    $current = $null
    if (Test-Path $envFile) {
        Push-Location $dir
        try {
            $image = docker compose ps --format '{{.Image}}' app 2> $null | Select-Object -First 1
        } finally {
            Pop-Location
        }
        if ("$image" -match ':(.+)-standalone$') { $current = $Matches[1] }
    }

    $arrow = [char]0x2192
    if (-not $current) {
        Start-Step "Files of version $version" "Arquivos da vers${at}o $version"
    } elseif ($current -eq $version) {
        Start-Step "Version $version, already installed" "Vers${at}o $version, j${aa} instalada"
    } else {
        Start-Step "Version $current $arrow $version" "Vers${at}o $current $arrow $version"
    }
    if ((Test-Path (Join-Path $dir 'compose.yaml')) -and -not (Test-Path $envFile)) {
        return (Stop-Install 'i5-composeyaml-without-env' 'i5-composeyaml-sem-env' `
            "$dir holds compose.yaml without .env: an installation made without this script. Write .env with the database password of that installation; the guide shows how." `
            "$dir tem compose.yaml sem .env: uma instala${cc}${at}o feita sem este script. Grave o .env com a senha do banco dessa instala${cc}${at}o; o guia mostra como.")
    }

    if (Test-Path $envFile) {
        $port = 8080
        foreach ($line in Get-Content $envFile) {
            if ($line -match '^EQUORI_PORT=(\d+)$') { $port = [int]$Matches[1] }
        }
    } else {
        $port = $null
        foreach ($p in 8080..8099) {
            if (-not (Get-NetTCPConnection -State Listen -LocalPort $p -ErrorAction SilentlyContinue)) {
                $port = $p
                break
            }
        }
        if ($null -eq $port) {
            return (Stop-Install 'i7-no-free-port' 'i7-nenhuma-porta-livre' `
                'Ports 8080 to 8099 are all in use. Stop a program that uses one of them, then run this command again.' `
                "As portas 8080 a 8099 est${at}o todas em uso. Encerre um programa que use uma delas e execute este comando de novo.")
        }
    }

    $created = $false
    if (-not (Test-Path $dir)) {
        $null = New-Item -ItemType Directory -Path $dir
        $created = $true
    }

    foreach ($name in 'compose.yaml', 'env.example') {
        $part = Join-Path $dir "$name.part"
        try {
            if ($env:EQUORI_INSTALL_SOURCE) {
                Copy-Item (Join-Path $env:EQUORI_INSTALL_SOURCE $name) $part -ErrorAction Stop
            } else {
                Invoke-WebRequest -UseBasicParsing -Uri "$download/$name" -OutFile $part -ErrorAction Stop
            }
        } catch {
            Remove-Item (Join-Path $dir '*.part') -ErrorAction SilentlyContinue
            if ($created) { Remove-Item $dir }
            return (Stop-Install 'i6-download-failed' 'i6-falha-no-download' `
                "The download of $download/$name failed. Check the internet connection, then run this command again." `
                "O download de $download/$name falhou. Verifique a conex${at}o com a internet e execute este comando de novo.")
        }
    }
    Move-Item -Force (Join-Path $dir 'compose.yaml.part') (Join-Path $dir 'compose.yaml')
    Move-Item -Force (Join-Path $dir 'env.example.part') (Join-Path $dir 'env.example')

    # A present .env stays byte for byte: a new key loses the credentials, a new password the volume (A163.6).
    if (-not (Test-Path $envFile)) {
        $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
        $alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
        $password = ''
        $byte = New-Object byte[] 1
        while ($password.Length -lt 32) {
            $rng.GetBytes($byte)
            # 248 is 4 times 62: a byte below it maps to the alphabet without bias.
            if ($byte[0] -lt 248) { $password += $alphabet[$byte[0] % 62] }
        }
        $keyBytes = New-Object byte[] 32
        $rng.GetBytes($keyBytes)
        $key = [Convert]::ToBase64String($keyBytes)
        $lines = foreach ($line in Get-Content (Join-Path $dir 'env.example')) {
            if ($line -eq 'POSTGRES_PASSWORD=') { "POSTGRES_PASSWORD=$password" }
            elseif ($line -eq 'EQUORI_SECRET_KEY=') { "EQUORI_SECRET_KEY=$key" }
            elseif ($line -eq 'EQUORI_PORT=') { "EQUORI_PORT=$port" }
            else { $line }
        }
        [IO.File]::WriteAllText($envFile, (($lines -join "`n") + "`n"), (New-Object Text.UTF8Encoding $false))
    }

    $null = New-Item -ItemType Directory -Force -Path (Join-Path $dir 'copies')
    Complete-Step
    Set-Content -Path $log -Value $null

    Start-Step 'Image' 'Imagem'
    if ((Invoke-Logged 'compose', 'pull', '--ignore-pull-failures') -ne 0) { return 1 }
    Complete-Step

    Start-Step 'Containers' "Cont${ec}ineres"
    if ((Invoke-Logged 'compose', 'up', '-d') -ne 0) { return 1 }
    Complete-Step

    Push-Location $dir
    try {
        Start-Step "Answer on port $port" "Resposta na porta $port"
        $ready = $false
        while (-not $ready -and (Get-Elapsed) -lt 180) {
            try {
                $r = Invoke-WebRequest -UseBasicParsing -TimeoutSec 5 -Uri "http://127.0.0.1:$port/healthz"
                $ready = $r.StatusCode -eq 200
            } catch { }
            if (-not $ready) {
                Show-Tick
                Start-Sleep -Seconds 1
            }
        }
        if (-not $ready) {
            Set-StepFailed
            docker compose logs --no-log-prefix --tail 20 app | Out-Host
            return (Stop-Install 'i8-equori-does-not-start' 'i8-equori-sem-resposta' `
                "equori did not answer on http://127.0.0.1:$port/healthz within 180 seconds; its last log lines are above." `
                "O equori n${at}o respondeu em http://127.0.0.1:$port/healthz em 180 segundos; as ${ua}ltimas linhas do log est${at}o acima.")
        }

        $url = "http://127.0.0.1:$port/"
        try { $setup = Invoke-RestMethod -TimeoutSec 5 -Uri "http://127.0.0.1:$port/api/v1/setup" } catch { $setup = $null }
        if ($setup -and $setup.required) {
            # The logged URL names the container port, so the token joins the host port (A163.11).
            $line = docker compose logs --no-log-prefix app | Select-String 'first user setup' | Select-Object -Last 1
            if ($line -and ("$line" -match '#token=([A-Za-z0-9_-]+)')) {
                $url = "http://127.0.0.1:$port/setup#token=$($Matches[1])"
            }
        }
        Complete-Step
    } finally {
        Pop-Location
    }

    Start-Process $url
    Write-Host ''
    Write-Host (Pick "equori is installed in $dir." "O equori est${aa} instalado em $dir.") -ForegroundColor Green
    Write-Host (Pick 'Address: ' "Endere${cc}o: ") -NoNewline
    Write-Host $url -ForegroundColor Cyan
    Write-Host ''
    Write-Host (Pick "Keep a copy of $dir\.env apart from the backups: it holds the secret key, without which the bank connections cannot be read." `
        "Guarde uma c${oa}pia de $dir\.env longe dos backups: ela cont${ea}m a chave secreta, sem a qual as conex${ot}es banc${aa}rias n${at}o podem ser lidas.") -ForegroundColor Yellow
    Write-Host ''
    Say "To stop:    cd $dir; docker compose stop" "Para parar:     cd $dir; docker compose stop"
    Say "To start:   cd $dir; docker compose start" "Para iniciar:   cd $dir; docker compose start"
    Say 'To upgrade: run the installation command again.' "Para atualizar: execute de novo o comando de instala${cc}${at}o."
    return 0
}

[Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12
$code = Invoke-EquoriInstall
# Under irm | iex, exit would close the terminal that shows the message.
if ($PSCommandPath) { exit $code }
$global:LASTEXITCODE = $code
