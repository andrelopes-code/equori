# Release

A release is a pushed tag `vX.Y.Z`; `.github/workflows/release.yml` builds the image and creates the GitHub release with generated notes.

## Checklist

1. `make check` passes on the commit to tag.
2. Read `ArchiveVersion` in `internal/reporting/internal/app/archive_steps.go`.
3. When it is above the `archive_version` of the previous release, confirm that `internal/reporting/testdata/archive-v<N>.zip` and `internal/reporting/internal/adapter/postgres/testdata/archive-v<N>.txt` exist for each version up to it (ADR 021, V6, V7).
4. Tag and push: `git tag vX.Y.Z && git push origin vX.Y.Z`.
5. Add the line `Export archive_version: <N>` to the release notes (ADR 021, V9; `docs/operations/export.md`).
