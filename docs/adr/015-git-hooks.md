# ADR 015: Git hooks with lefthook

- Status: accepted
- Date: 2026-10-22

## Context

The pre-commit hook was `.githooks/pre-commit`, a shell script that ran `make check-commit`. That target checked the whole repository on every commit that touched `web/`: `make gen`, `golangci-lint run`, the production build of `web/`, `tsc`, ESLint and Prettier on all of `web/`, the Go tests and the 871 web tests. A commit took about three minutes. The web tests ran beside the Go tests, and a test that takes 10 seconds alone passed its 15 second timeout there twice in a row. The target read the working tree, not the staged snapshot: a partial commit was checked against changes it did not hold, and `make gen` rewrote a generated file the hook then reported as changed.

## Decision

| ID | Rule |
|---|---|
| H1 | Git hooks are declared in `lefthook.yml` and run by lefthook, pinned in `tools/go.mod` and built into `bin/` like the other tools. `make hooks` installs them. |
| H2 | `pre-commit` checks the staged files only: `golangci-lint fmt` on Go files and Prettier on web files, each restaging what it fixes, and ESLint on TypeScript files. `make gen-check` runs only when a source of generated code is staged. |
| H3 | `pre-push` checks the files the push sends: `golangci-lint run`, the Go tests (the test cache skips unchanged packages), `tsc`, `vitest related` on the pushed web files and the Node tests of the theme and of the Slotted findings registry. |
| H4 | `make check` stays the complete gate, with `-race`, the production build and the whole web suite. CI runs it on every pull request. |
| H5 | A job runs only when the commit or push holds a file its glob matches. |
| H3a | Amendment of 2026-10-29. `pre-push` no longer runs `vitest related`; the web tests run in `make check` and in CI on every push to `main` and every pull request. Reason: a push of 159 commits sent most of `web/`, and `vitest related` ran for 485 s of a 12-minute hook. |

## Consequences

- A commit takes seconds. A broken test outside the files a push touches surfaces in CI, not on the developer's machine.
- `make check-commit` and `.githooks/` are removed. `make hooks` unsets `core.hooksPath`, which the former setup wrote.
- The pre-push Go tests need the `db-test` server of `compose.dev.yaml`, as `make test` does.

## Revisit criterion

A defect that reaches CI and that the full gate would have caught on commit more than once a month.
