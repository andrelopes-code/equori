# Investments I1: instrument subtype and tax class Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A security carries an optional subtype, and the owner's jurisdiction derives its tax class and the treatment of its income from type, subtype and exchange.

**Architecture:** Market data stores `subtype` on the instrument (instance-wide, identifier pattern, no `CHECK IN`). Portfolio owns the `Jurisdiction` extension point; its interface takes the subtype and the tax class, and a new endpoint lists the subtypes the jurisdiction knows. The `br` implementation maps CRI, CRA, LCI, LCA and incentivized debentures to an exempt class.

**Tech Stack:** Go, PostgreSQL (goose, sqlc), oapi-codegen, `internal/apitest`.

**Spec:** `docs/superpowers/specs/2026-10-23-investments-design.md`, section 4.1 (slice I1).

## Global Constraints

- Identifier pattern for a subtype: `^[a-z0-9_]{2,40}$`; column `CHECK (subtype IS NULL OR subtype ~ '^[a-z0-9_]{2,40}$')`; contract `type: string, pattern: "^[a-z0-9_]{2,40}$"` (ADR 016 X7, X8, X9).
- No `CHECK (x IN (...))` for a value set that grows with regions (AG3); no `switch` on a region code outside the `br` package (AG1).
- A subtype outside the jurisdiction's list is accepted and falls back to the class of its type.
- Existing portfolio scenarios and `jurisdiction_test.go` keep passing unchanged (AG5), except where this plan names the amended rule.
- A schema change is a new goose migration (next number: `00053`); applied migrations are never edited.
- A new operation in `api/openapi.yaml` has an entry in `internal/server/tool_exposure_test.go`.
- Each `Problem.code` returned has a test through the HTTP API; each database invariant has a schema test that violates it with direct SQL.
- The tax rows are the rules in force at the date of the spec; each is checked against the Receita Federal text before the commit and cited in the commit body.
- Commit directly on `main`, one vertical slice per commit, Conventional Commits, English, no tool names.

## Review Focus

- A subtype with uppercase or a hyphen: refused with 400 `invalid_request` on `subtype`.
- A subtype the jurisdiction does not know (`xyz_bond`): accepted, class and treatment of its type.
- A subtype on a `stock`: accepted by Market data, ignored by `br` (class of the type).
- An owner whose region has no jurisdiction (`DE`): `GET /instrument-subtypes` returns an empty list; income events have no treatment.
- An instrument defined before this change (no subtype): same class and treatment as today.

---

### Task 1: Subtype on the instrument

**Files:**
- Create: `db/migrations/00053_marketdata_instrument_subtype.sql`
- Modify: `db/queries/marketdata/instrument.sql` (`InsertInstrument` takes `sqlc.narg(subtype)`)
- Modify: `internal/marketdata/internal/domain/instrument.go`, `internal/marketdata/marketdata.go`, `internal/marketdata/internal/adapter/httpapi/instruments.go`
- Modify: `api/openapi.yaml` (`InstrumentInput.subtype`, `Instrument.subtype`)
- Test: `internal/marketdata/instruments_test.go`, `internal/marketdata/schema_test.go`

**Interfaces:**
- Produces: `domain.Instrument.Subtype string` (empty when none); `marketdata.Instrument` is the same type; `GET /instruments` and `GET /instruments/{code}` return `subtype` when set.

- [ ] **Step 1: Write the failing tests.** In `instruments_test.go`: `TestInstrumentSubtype` defines a `fixed_income` instrument with `"subtype": "cri"` and reads it back from `GET /instruments/CRIXPTO` with `subtype == "cri"`; an instrument defined without subtype has no `subtype` key; `"subtype": "CRI"` and `"subtype": "a-b"` return 400 `invalid_request` with first field error `subtype`. In `schema_test.go`: a direct `UPDATE marketdata_instrument SET subtype = 'Bad-Value'` is rejected.
- [ ] **Step 2: Run** `go test ./internal/marketdata -run 'Subtype'` with `EQUORI_TEST_DATABASE_URL` set. Expected: FAIL (unknown field).
- [ ] **Step 3: Implement.** Migration adds `subtype text` with the `CHECK`; `make gen`; `Instrument.Subtype` validated in `Validate` against `^[a-z0-9_]{2,40}$` (field error `subtype`); `optional(in.Subtype)` in `DefineInstrument`; map in `toInstrument` and the HTTP adapter both ways.
- [ ] **Step 4: Run** `go test ./internal/marketdata`. Expected: PASS.

### Task 2: Jurisdiction by subtype and tax class

**Files:**
- Modify: `internal/portfolio/internal/domain/jurisdiction.go`, `internal/portfolio/internal/domain/rebuild.go` (`Security.Subtype`, `Treatment(in.Type, taxClass)`)
- Modify: `internal/portfolio/internal/jurisdiction/br/br.go`, `internal/portfolio/portfolio.go` (`marketPort` passes `in.Subtype`)
- Modify: `internal/portfolio/internal/app/service.go` (`Subtypes(ctx, userID, instrumentType) ([]string, error)`), `internal/portfolio/internal/adapter/httpapi/` (handler), `api/openapi.yaml` (`GET /instrument-subtypes?type=`, `SubtypeList`), `internal/server/tool_exposure_test.go` (`listInstrumentSubtypes: "-pending"`)
- Test: `internal/portfolio/subtype_test.go` (scenario S122), `internal/portfolio/jurisdiction_test.go` (region `DE`)

**Interfaces:**
- Consumes: `domain.Instrument.Subtype` from Task 1.
- Produces: `Jurisdiction` with `TaxClass(instrumentType, subtype, exchange string) string`, `Treatment(incomeType, taxClass string) string`, `Subtypes(instrumentType string) []string`.

- [ ] **Step 1: Write the failing scenario S122** in `subtype_test.go`, named `TestS122SubtypeTaxClass`: a CRI (`fixed_income`, subtype `cri`) and a CDB (`fixed_income`, subtype `cdb`), each held in a brokerage child with a `coupon` recorded through `POST /investment-income`; `GET /income-events` reads `tax_treatment` `exempt` for the CRI and `exclusive` for the CDB; a `fixed_income` instrument with no subtype reads `exclusive` (today's treatment); a `stock` with subtype `xyz_bond` reads the treatment of its type. Add `TestInstrumentSubtypesList`: `GET /instrument-subtypes?type=fixed_income` returns `["cdb","cra","cri","debenture_incentivada","lca","lci","rdb","tesouro"]`; `type=fund` returns `["equity_fund","fixed_income_fund","multimarket"]`; `type=stock` returns `[]`; after `moveToRegion(t, "DE")` every type returns `[]`; an unknown `type` is 400.
- [ ] **Step 2: Run** `go test ./internal/portfolio -run 'S122|Subtypes'`. Expected: FAIL (404 on the endpoint, treatment `exclusive` for the CRI).
- [ ] **Step 3: Implement.** The `br` rows: `fixed_income` with `cdb`, `rdb`, `tesouro` is class `fixed_income`; with `lci`, `lca`, `cri`, `cra`, `debenture_incentivada` is `fixed_income_exempt`; `fund` with `fixed_income_fund`, `multimarket` is `fund`; `equity_fund` is `fund_equity`; any other combination keeps today's `TaxClass` result. `Treatment(incomeType, taxClass)` returns `exempt` for `interest` and `coupon` when the class is `fixed_income_exempt`; every other result is today's. `Subtypes(type)` returns the sorted list of the table above, empty for other types. The service resolves the jurisdiction for the user (`juris.For`) and returns `[]` when there is none. `rebuild.go` computes the class once per security and passes it to `Treatment`.
- [ ] **Step 4: Run** `go test ./internal/portfolio ./internal/server ./internal/marketdata`. Expected: PASS, with the existing scenarios untouched.
- [ ] **Step 5: Verify the rule text.** Check the exemption of CRI, CRA, LCI, LCA and incentivized debentures for an individual against the Receita Federal source (Lei 11.033/2004, art. 3, and Lei 12.431/2011, art. 1); cite it in the commit body.
- [ ] **Step 6: Document and commit.** Add scenario S122 to `docs/domain/06-scenarios.md`, the `subtype` row to the `instrument` rule in `docs/domain/05-domain-model.md`, and amendment A122 (subtype and tax class). Run `make lint` and `pnpm exec prettier --check` on touched web files (none expected). Commit on `main`: `feat(portfolio): derive tax class and income treatment from instrument subtype`.
