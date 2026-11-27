# Assembles equori_<Version>_windows_amd64.zip: equori.exe (tray), equori-cli.exe, install.ps1 pinned
# to Version, LICENSE and the PostgreSQL bundle of scripts/windows-postgres.ps1 (PW1).
param(
    [Parameter(Mandatory)][string]$Version,
    [Parameter(Mandatory)][string]$Postgres,
    [Parameter(Mandatory)][string]$Out
)
$ErrorActionPreference = 'Stop'
$root = Resolve-Path (Join-Path $PSScriptRoot '..')
$Postgres = Resolve-Path $Postgres
New-Item -ItemType Directory -Force $Out | Out-Null
$Out = Resolve-Path $Out
$stage = Join-Path $Out "equori_${Version}_windows_amd64"
$zip = "$stage.zip"
Remove-Item -Recurse -Force $stage, $zip -ErrorAction SilentlyContinue
New-Item -ItemType Directory $stage | Out-Null

function Invoke-Native {
    & $args[0] $args[1..($args.Count - 1)]
    if ($LASTEXITCODE -ne 0) { throw "$($args -join ' ') failed with $LASTEXITCODE" }
}

Push-Location $root
try {
    $env:GOOS = 'windows'
    $env:GOARCH = 'amd64'
    $env:CGO_ENABLED = '0'

    # The .syso is linked into both executables; the build ignores it, git ignores it.
    Invoke-Native go tool '-modfile=tools/go.mod' go-winres make --in cmd/equori/winres/winres.json `
        --out cmd/equori/rsrc --arch amd64 --product-version $Version --file-version $Version
    Invoke-Native go build -trimpath -o (Join-Path $stage 'equori.exe') `
        -ldflags "-s -w -H windowsgui -X main.version=v$Version -X main.defaultCommand=tray" ./cmd/equori
    Invoke-Native go build -trimpath -o (Join-Path $stage 'equori-cli.exe') `
        -ldflags "-s -w -X main.version=v$Version" ./cmd/equori
} finally {
    Remove-Item cmd/equori/rsrc_windows_amd64.syso -ErrorAction SilentlyContinue
    Pop-Location
}

Copy-Item (Join-Path $root 'LICENSE') $stage
$pinned = Get-Content (Join-Path $root 'scripts/install.ps1') | ForEach-Object {
    if ($_ -ceq '$version = ''dev''') { "`$version = '$Version'" } else { $_ }
}
if ($pinned -cnotcontains "`$version = '$Version'") { throw "install.ps1 has no line `$version = 'dev'" }
[IO.File]::WriteAllText((Join-Path $stage 'install.ps1'), ($pinned -join "`n") + "`n",
    (New-Object Text.UTF8Encoding $false))
Copy-Item -Recurse $Postgres (Join-Path $stage 'postgresql')

Add-Type -AssemblyName System.IO.Compression.FileSystem
[IO.Compression.ZipFile]::CreateFromDirectory($stage, $zip, [IO.Compression.CompressionLevel]::Optimal, $false)
Remove-Item -Recurse -Force $stage
$archive = [IO.Compression.ZipFile]::OpenRead($zip)
try { $count = @($archive.Entries | Where-Object { $_.Name -ne '' }).Count } finally { $archive.Dispose() }
"$zip $((Get-Item $zip).Length) bytes, $count files"
