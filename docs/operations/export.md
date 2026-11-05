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
- Integration credentials and the keys of the language model providers are exported only when the owner types a passphrase of 8 to 256 characters at the export. The archive then carries them sealed by that passphrase, and the server does not keep it. The import restores them when the owner types the same passphrase, sealing each one again under the key of the receiving instance, which therefore needs `EQUORI_SECRET_KEY` (or `secret.key`). A wrong passphrase refuses the import before any write (422 `passphrase_invalid`). An archive that carries credentials is refused without the passphrase (422 `passphrase_required`) unless the owner chooses to import without them; each integration then needs its credentials again.
- Only an owner of the book exports or imports credentials.
- The passphrase is not recoverable: an archive whose passphrase is lost keeps every fact and loses only the credentials.
