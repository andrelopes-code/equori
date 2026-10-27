# Release

A release is a pushed tag `vX.Y.Z`; `.github/workflows/release.yml` builds the image and creates the GitHub release with generated notes.

## Checklist

1. `make check` passes on the commit to tag.
2. Read `ArchiveVersion` in `internal/reporting/internal/app/archive_steps.go`.
3. When it is above the `archive_version` of the previous release, confirm that `internal/reporting/testdata/archive-v<N>.zip` and `internal/reporting/internal/adapter/postgres/testdata/archive-v<N>.txt` exist for each version up to it (ADR 021, V6, V7).
4. Tag and push: `git tag vX.Y.Z && git push origin vX.Y.Z`.
5. Add the line `Export archive_version: <N>` to the release notes (ADR 021, V9; `docs/operations/export.md`).
6. The job `windows` publishes the installer only when the secrets `AZURE_TENANT_ID`, `AZURE_CLIENT_ID`, `AZURE_CLIENT_SECRET`, `ARTIFACT_SIGNING_ENDPOINT`, `ARTIFACT_SIGNING_ACCOUNT` and `ARTIFACT_SIGNING_PROFILE` exist (ADR 023, W-R5, W-R6); without them its notice says so and the release carries no installer.

## PostgreSQL for Windows

Within 14 days of each PostgreSQL 18 minor, a PATCH release carries it (ADR 023, W-P5); the workflow `postgres` fails every Monday until then. Update `packaging/windows/postgresql.env` with the new EDB build:

1. Open https://www.enterprisedb.com/download-postgresql-binaries and take the address of the Windows x86-64 zip of the new minor.
2. Download it and compute `sha256sum`.
3. Set `PG_VERSION`, `PG_URL` and `PG_SHA256`; the ci job `windows` builds the bundle from them and runs the managed-mode tests on it.
