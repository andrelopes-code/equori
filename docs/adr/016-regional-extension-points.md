# ADR 016: Regional extension points

- Status: accepted
- Date: 2026-10-22

## Context

The code base mixes Brazilian rules, data sources and vocabulary into its universal core (`docs/specs/2026-10-22-regional-neutrality-design.md`, section 1). A contributor from another country edits Go code, the HTTP contract and the schema of several modules to add a currency, a holiday calendar, a price source, an exchange, an aggregator, a bank identifier, a tax rule or a language.

## Decision

An extension point is declared by the module that consumes it.

| ID | Rule |
|---|---|
| X1 | The interface is declared in the module's `internal/domain` (pure rules) or `internal/app` (I/O) and named by behavior (`Calendar`, `PriceSource`, `Aggregator`, `Jurisdiction`, `Lexicon`). |
| X2 | One package per implementation under `internal/<module>/internal/<point>/<id>/`. A pure data implementation is a Go value in a file named after its id. |
| X3 | An identifier matches `^[a-z0-9_]{2,40}$`. A regional implementation is prefixed by region (`br_banking`, `bcb_ptax`); an international one is not (`ecb`, `weekend`, `bic`). |
| X4 | A registry is a `registry.Registry[T]` (`internal/platform/registry`) built by a constructor in the module root. It is immutable after construction. `Get(id)` returns the implementation or an error wrapping `registry.ErrUnknown`. `New` rejects duplicate and malformed identifiers. `IDs` returns the identifiers in ascending order. |
| X5 | No `init()` registration and no package-level mutable variable. |
| X6 | The instance enables implementations by identifier through environment variables read in `internal/platform/config` as plain strings. The module validates the identifiers against its registry at startup. The process exits with the variable name and the unknown identifier. |
| X7 | A column holding an identifier has `CHECK (col ~ '^[a-z0-9_]{2,40}$')`. The registry holds the value set. |
| X8 | The contract field is `type: string, pattern: "^[a-z0-9_]{2,40}$"`. A listing endpoint returns the registered values when a form needs them. |
| X9 | A value set that grows with regions uses `pattern`. A universal and closed value set uses `enum`. A standard code uses the pattern of the standard (spec section 4.4). |
| X10 | Each extension point ships two implementations, or one implementation and a test implementation in `_test.go` files, exercised through the HTTP API. |

## Consequences

- `domain` packages import only the standard library, `internal/platform/money` and `internal/platform/textfold`. The `depguard` rule `domain` in `.golangci.yml` allows `github.com/andrelopes-code/equori/internal/platform/textfold`.
- A contributor adds a region by adding implementations and registering them in the module constructor; the checklist is written in the contributor documentation of the plan's Task 36.
- A registry misconfiguration fails at startup, not at the first request.

## Revisit criterion

An extension point that needs implementations loaded at run time without a rebuild.
