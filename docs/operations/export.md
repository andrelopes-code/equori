# Export and import

An export is a ZIP archive of every fact of the owner's books (`docs/specs/2026-10-26-export-design.md`). It is requested, downloaded and imported in the data section of settings.

## Compatibility

An archive of any earlier version of equori imports into any later version. An archive never imports into an earlier version than the one that wrote it.

Each archive names its `archive_version` in `manifest.json` (ADR 021). The data section of settings shows the `archive_version` of the archive it built and of the archive it imported.

| Case | Result |
|---|---|
| The archive's `archive_version` equals the instance's | The archive imports unchanged. |
| The archive's `archive_version` is below the instance's | The instance migrates the archive's rows to its own version, then imports them. |
| The archive's `archive_version` is above the instance's | 422 `archive_too_new` with both versions. Update equori to a version whose release notes name that `archive_version` or a later one, then import again. |
| An archive written before `archive_version` existed | Reads as version 1. |

The release notes of each version name its `archive_version`.

## Conditions

- The import requires books without facts: no transaction and no account other than the system accounts created at sign-up. Merging an archive into books that hold facts is not supported.
- An archive is at most 256 MiB.
- Integration credentials are not exported; after an import, each integration needs its credentials again.
