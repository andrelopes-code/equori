# Fails when the pinned PostgreSQL of the Windows form is older than the current minor of its major
# (W-P4 of docs/superpowers/specs/2026-10-27-distribution-windows-design.md).
param([string]$Versions = 'https://www.postgresql.org/versions.json')
$ErrorActionPreference = 'Stop'

$pin = (Get-Content (Join-Path $PSScriptRoot '..\packaging\windows\postgresql.env') | Where-Object { $_ -match '^PG_VERSION=' }) -replace '^PG_VERSION=', ''
if ($pin -notmatch '^(\d+)\.(\d+)-\d+$') { throw "PG_VERSION '$pin' is not MAJOR.MINOR-BUILD" }
$major, $minor = $Matches[1], [int]$Matches[2]
$list = if (Test-Path $Versions) { Get-Content -Raw $Versions | ConvertFrom-Json } else { Invoke-RestMethod $Versions }
$current = $list | Where-Object { $_.major -eq $major }
if (-not $current) { throw "$Versions lists no major $major" }
if ($minor -lt [int]$current.latestMinor) {
    [Console]::Error.WriteLine("the Windows bundle pins PostgreSQL $major.$minor; $major.$($current.latestMinor) is current since $($current.relDate) (W-P5: a release within 14 days)")
    exit 1
}
"PostgreSQL $major.$minor is the current minor"
