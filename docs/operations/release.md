# Release

A release is a pushed tag `vX.Y.Z`; `.github/workflows/release.yml` builds the image and creates the GitHub release with generated notes.

## Checklist

1. `make check` passes on the commit to tag.
2. Read `ArchiveVersion` in `internal/reporting/internal/app/archive_steps.go`.
3. When it is above the `archive_version` of the previous release, confirm that `internal/reporting/testdata/archive-v<N>.zip` and `internal/reporting/internal/adapter/postgres/testdata/archive-v<N>.txt` exist for each version up to it (ADR 021, V6, V7).
4. Tag and push a candidate: `git tag vX.Y.Z-rc.N && git push origin vX.Y.Z-rc.N`. A tag with `-` is published as a pre-release and skips the Homebrew tap.
5. Add the line `Export archive_version: <N>` to the release notes (ADR 021, V9; `docs/operations/export.md`).
6. The job `windows` publishes the installer only when the secrets `AZURE_TENANT_ID`, `AZURE_CLIENT_ID`, `AZURE_CLIENT_SECRET`, `ARTIFACT_SIGNING_ENDPOINT`, `ARTIFACT_SIGNING_ACCOUNT` and `ARTIFACT_SIGNING_PROFILE` exist (ADR 023, W-R5, W-R6); without them its notice says so and the release carries no installer.
7. Owner check of macOS and Windows (P14 A166.4): on a fresh macOS machine and on a fresh Windows machine or virtual machine, follow the prerequisites of `docs/install/macos.md` and `docs/install/windows.md`, paste the command of the guide with `releases/latest/download` replaced by `releases/download/vX.Y.Z-rc.N`, and confirm that the setup screen opens. `latest` never serves a pre-release. The release notes name the version and the date of each check.
8. Every P16 owner check of `docs/specs/2026-11-01-test-release-design.md`, A186, is recorded in the release notes with its date; `gh issue list --state open --label data-loss,duplication,exposure` prints nothing.
9. Tag and push the release on the commit of the candidate: `git tag vX.Y.Z && git push origin vX.Y.Z`.

## Windows check from a clone

Before a candidate exists, a Windows machine with the prerequisites of `docs/install/windows.md` runs the installation command from a clone. It checks the prerequisites, the script, compose and the first access; it does not check the download of the release assets. In PowerShell, at the root of the clone:

```powershell
docker compose build app
$env:EQUORI_INSTALL_SOURCE = "$PWD"
Get-Content .\scripts\install.ps1 -Raw | iex
```

`docker compose build app` tags the image `ghcr.io/andrelopes-code/equori:dev-standalone`; the script copies `compose.yaml` and `env.example` from `EQUORI_INSTALL_SOURCE`, and `docker compose pull --ignore-pull-failures` keeps the local image.

## PostgreSQL for Windows

Within 14 days of each PostgreSQL 18 minor, a PATCH release carries it (ADR 023, W-P5); the workflow `postgres` fails every Monday until then. Update `packaging/windows/postgresql.env` with the new EDB build:

1. Open https://www.enterprisedb.com/download-postgresql-binaries and take the address of the Windows x86-64 zip of the new minor.
2. Download it and compute `sha256sum`.
3. Set `PG_VERSION`, `PG_URL` and `PG_SHA256`; the ci job `windows` builds the bundle from them and runs the managed-mode tests on it.
