# ADR 035: Backend file organization

- Status: accepted
- Date: 2026-11-12
- Amends: the limits table of ADR 033 (file size)

## Decision

Every Go file holds one concept and carries the name of that concept. Every function body has at most 50 lines. The design, with the decision IDs BO1 to BO13, is in `docs/specs/2026-11-12-backend-organization-design.md`. The findings that motivated it are in `docs/specs/2026-11-12-backend-organization-audit.md`.

## Rules

| Rule | Enforcement |
|---|---|
| A `Config` type lives in `config.go` of its package | review |
| `cmd/equori/config.go` converts `config.Config` to `server.Config`; `internal/server/modules.go` converts `server.Config` to each module `Config` | review |
| A module root holds `<module>.go`, optionally `config.go`, `types.go`, `adapters.go`, `region_defaults.go` and one file per group of exported methods | review; module README states a deviation |
| `cmd/equori/main.go` has at most 80 lines | `internal/platform/layout` |
| A directory holds at most 40 hand-written non-test Go files; a directory above 40 has an entry in `long_dirs.txt` with its limit and reason, and an entry whose directory holds at most 40 files is removed | `internal/platform/layout`, `TestGoDirectorySize` |
| A hand-written non-test Go file has at most 400 lines | `internal/platform/layout`, `TestGoFileSize` |
| A hand-written non-test function body has at most 50 lines | `internal/platform/layout`, `TestGoFunctionSize` |
| An allow-list entry is removed when its file or function no longer exceeds the limit | `internal/platform/layout`; a stale entry fails the test |
| A line holds at most 100 columns (golines, `max-len: 100`, `tab-len: 4`); a `//nolint` directive sits on its own line above the statement | `golangci-lint fmt`; the pre-commit hook |
| `app` declares every port in `app/ports.go`; above 400 lines the file keeps the repository and clock ports and the other groups move to `app/ports_<group>.go` | review |
| A package is not named `util`, `helpers`, `misc`, `common`, `types` or `base`; `types.go` exists only in a module root | review |

## Long functions

A function above 50 lines is split into named steps in the same file, below its caller. A table of data is exempt and enters `long_functions.txt` with the reason `table of data`. A tool definition separates its schema, its argument decoding and its action.

## Allow-lists

`internal/platform/layout/long_files.txt` and `long_functions.txt` list the offenders that exist when the limits take effect. Each entry has a reason. The lists only shrink.

## Refused moves

| Move | Reason |
|---|---|
| `platform/httpserver` handler helpers to `platform/httphandler` | 71 importers change for a rename; ADR 034 names `httpserver` as the home of the helpers; the package comment is amended |
| `pgtest` identity fixtures to `identity/identitytest` | a package of a module other than its root breaks the `depguard` rule of ADR 033 |
| Deletion of `Tool.ValidateOutput` | removes an exported method used by a test in package `tool` |
| A new `app/` for `marketdata` or `domain/` for `reporting` | design change, left open by ADR 033 |
| A `Deps` struct for `planning.New` | changes an exported signature |

## Formatting

Wrapping lines to 100 columns lengthens function bodies and files. The gate lists were regenerated once after golines ran: 32 files and 105 functions carry the reason `pending: split after the 100-column reformatting`, and 1 file and 10 functions carry `table of data`. The lists only shrink from that baseline.

## Consequences

`platform/apidoc` moves into `internal/server`. `docs/contributing/map.md`, `CONTRIBUTING.md` (Layout) and the module READMEs describe the new files in the commits that create them.
