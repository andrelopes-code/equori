# Builds the PostgreSQL bundle of the Windows form from the pinned EDB zip (W-P1, W-P2 of
# docs/specs/2026-10-27-distribution-windows-design.md).
param([Parameter(Mandatory)][string]$Out)
$ErrorActionPreference = 'Stop'

$pin = @{}
foreach ($line in Get-Content (Join-Path $PSScriptRoot '..\packaging\windows\postgresql.env')) {
    if ($line -match '^([A-Z0-9_]+)=(.*)$') { $pin[$Matches[1]] = $Matches[2] }
}
$work = Join-Path ([IO.Path]::GetTempPath()) "equori-pg-$($pin.PG_VERSION)"
New-Item -ItemType Directory -Force $work | Out-Null
$zip = Join-Path $work 'pg.zip'
curl.exe -sSfL -o $zip $pin.PG_URL
if ($LASTEXITCODE -ne 0) { throw "download $($pin.PG_URL) failed" }
$sum = (Get-FileHash $zip -Algorithm SHA256).Hash.ToLowerInvariant()
if ($sum -ne $pin.PG_SHA256) { throw "SHA-256 of $($pin.PG_URL) is $sum, want $($pin.PG_SHA256)" }
tar -xf $zip -C $work pgsql/bin pgsql/lib pgsql/share pgsql/server_license.txt pgsql/commandlinetools_3rd_party_licenses.txt
if ($LASTEXITCODE -ne 0) { throw 'extract failed' }
$src = Join-Path $work 'pgsql'

New-Item -ItemType Directory -Force (Join-Path $Out 'bin'), (Join-Path $Out 'lib') | Out-Null
foreach ($p in 'postgres', 'initdb', 'pg_ctl', 'pg_dump', 'pg_restore', 'pg_upgrade') {
    Copy-Item (Join-Path $src "bin\$p.exe") (Join-Path $Out 'bin')
}
foreach ($d in 'icudt77', 'icuin77', 'icuuc77', 'libcrypto-3-x64', 'libiconv-2', 'libintl-9', 'liblz4', 'libpq',
    'libssl-3-x64', 'libwinpthread-1', 'libxml2', 'libxslt', 'libzstd', 'zlib1') {
    Copy-Item (Join-Path $src "bin\$d.dll") (Join-Path $Out 'bin')
}
# plperl, plpython3 and pltcl load interpreters the zip does not hold.
Get-ChildItem (Join-Path $src 'lib\*.dll') | Where-Object { $_.BaseName -notin 'plperl', 'plpython3', 'pltcl' } |
    Copy-Item -Destination (Join-Path $Out 'lib')
Copy-Item -Recurse (Join-Path $src 'share') (Join-Path $Out 'share')
Remove-Item -Recurse (Join-Path $Out 'share\locale')
Copy-Item (Join-Path $src 'server_license.txt'), (Join-Path $src 'commandlinetools_3rd_party_licenses.txt') $Out

# The Visual C++ runtime the programs import, from the redistributable folder of Visual Studio (F4).
$vs = & "${env:ProgramFiles(x86)}\Microsoft Visual Studio\Installer\vswhere.exe" -latest -property installationPath
$crt = Get-ChildItem -Directory (Join-Path $vs 'VC\Redist\MSVC\*\x64\Microsoft.VC*.CRT') |
    Where-Object { $_.Parent.Parent.Name -match '^\d+(\.\d+)+$' } |
    Sort-Object { [version]$_.Parent.Parent.Name } | Select-Object -Last 1
if (-not $crt) { throw "no Microsoft.VC*.CRT folder under $vs\VC\Redist\MSVC" }
foreach ($d in 'vcruntime140', 'vcruntime140_1', 'msvcp140') {
    Copy-Item (Join-Path $crt.FullName "$d.dll") (Join-Path $Out 'bin')
}
"bundle $($pin.PG_VERSION) from $($crt.FullName): $((Get-ChildItem -Recurse -File $Out).Count) files"
