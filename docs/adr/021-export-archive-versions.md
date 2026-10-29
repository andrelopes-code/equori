# ADR 021: Export archive versions

- Status: accepted
- Date: 2026-10-26
- Amends: export design E1 and E4 (`docs/specs/2026-10-26-export-design.md`), ADR 004 (members `archive_version` and `instance_version`)

## Context

equori is distributed free of charge, in versions and updates. An owner exports the books on one version and imports them on a later one, after an update or on a new instance. The archive of the export design names `schema_version`, the highest applied goose migration, and the import refuses any other value with `archive_version_mismatch`. Every migration therefore breaks every archive written before it, including migrations that touch no exported table. A release is named by its tag `vX.Y.Z` (`.github/workflows/release.yml`), which the binary reports as its version.

## Decision

| ID | Rule |
|---|---|
| V1 | The manifest carries `archive_version`, an integer from 1, independent of the app version and of the goose version. It also carries `app_version`, the version of the app that exported it. `schema_version` stays as information and no longer gates the import. A manifest without `archive_version` and with `format_version` 1 is an archive of version 1. |
| V2 | A change to any exported table (a column, a type, a meaning, a table added or removed) increments `archive_version` in the same commit and adds a migration step for the archive. |
| V3 | A migration step is a pure, forward-only function from version `v` to `v + 1` over the rows of each JSON Lines file. The steps form one ordered registry in `internal/reporting/internal/app/archive_steps.go`; the current version is the number of steps plus 1. The import applies the steps in sequence from the archive's version to the current one before any write. |
| V4 | An archive of a version above the instance's is refused with 422 `archive_too_new`; the problem names both versions in `archive_version` and `instance_version`. A version below 1, or a manifest that does not read, is 422 `archive_invalid`. |
| V5 | The import still requires books without facts. Merging an archive into books that hold facts stays out of scope. |
| V6 | A test keeps the fingerprint of each exported table (columns and types from `information_schema`) for the current `archive_version` in `testdata/`. A goose migration that changes an exported table without a new version and step fails it, and the failure says what to do. |
| V7 | Each published `archive_version` has a small fixture archive in `testdata/`, written once by a test run with `-update` and never edited by hand. A test imports it on the current version and checks exact values. |
| V8 | An archive of any earlier version imports into any later version; never the reverse. `docs/operations/export.md` states this policy for owners. |
| V9 | The release notes of each app version name its `archive_version`. |

## Consequences

- `archive_version_mismatch` is removed; an archive of an older goose version imports when its `archive_version` is not above the instance's.
- A migration that leaves every exported table unchanged needs no archive step.
- The fingerprint test reads the live schema, so a missed step fails `make check` before a release.
