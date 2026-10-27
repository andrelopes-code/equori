# Signs PE files with Azure Artifact Signing through signtool and its dlib (W-R5 of
# docs/superpowers/specs/2026-10-27-distribution-windows-design.md). Inno Setup calls it for the
# installer and the uninstaller; the release job calls it for equori.exe and the PostgreSQL bundle.
# Credentials come from AZURE_TENANT_ID, AZURE_CLIENT_ID and AZURE_CLIENT_SECRET; the account from
# ARTIFACT_SIGNING_ENDPOINT, ARTIFACT_SIGNING_ACCOUNT and ARTIFACT_SIGNING_PROFILE.
param([Parameter(Mandatory, ValueFromRemainingArguments)][string[]]$Files)
$ErrorActionPreference = 'Stop'

$client = 'Microsoft.ArtifactSigning.Client'
$version = '1.0.146'
$sha256 = '7761e5d8f31e54b764da21d33cd8b0a2940e1b05526c7dfcb5e94b0431426f70'
$work = Join-Path ([IO.Path]::GetTempPath()) "$client.$version"
$dlib = Join-Path $work 'bin\x64\Azure.CodeSigning.Dlib.dll'
if (-not (Test-Path $dlib)) {
    New-Item -ItemType Directory -Force $work | Out-Null
    $pkg = Join-Path $work 'client.zip'
    Invoke-WebRequest -UseBasicParsing -OutFile $pkg "https://www.nuget.org/api/v2/package/$client/$version"
    $sum = (Get-FileHash $pkg -Algorithm SHA256).Hash.ToLowerInvariant()
    if ($sum -ne $sha256) { throw "SHA-256 of $client $version is $sum, want $sha256" }
    Expand-Archive -Force $pkg $work
}
$metadata = Join-Path $work 'metadata.json'
@{
    Endpoint               = $env:ARTIFACT_SIGNING_ENDPOINT
    CodeSigningAccountName = $env:ARTIFACT_SIGNING_ACCOUNT
    CertificateProfileName = $env:ARTIFACT_SIGNING_PROFILE
} | ConvertTo-Json | Set-Content $metadata
$signtool = Get-ChildItem "${env:ProgramFiles(x86)}\Windows Kits\10\bin\*\x64\signtool.exe" |
    Sort-Object { [version]$_.Directory.Parent.Name } | Select-Object -Last 1
if (-not $signtool) { throw 'no signtool.exe under Windows Kits 10' }
& $signtool.FullName sign /fd SHA256 /tr http://timestamp.acs.microsoft.com /td SHA256 /dlib $dlib /dmdf $metadata @Files
if ($LASTEXITCODE -ne 0) { throw "signtool exited with $LASTEXITCODE" }
