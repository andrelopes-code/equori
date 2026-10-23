# Investments I3: money-weighted return Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `GET /reports/return` returns the money-weighted annual return, in basis points, of an account tree over a period.

**Architecture:** A pure function solves the internal rate of return of dated cash flows. Ledger exposes the external flows of an account tree. Portfolio, which already holds the Ledger and Market data ports, values the flows and the opening and closing balances in the requested currency and serves the endpoint.

**Tech Stack:** Go, sqlc, oapi-codegen, `internal/apitest`.

**Spec:** `docs/superpowers/specs/2026-10-23-investments-design.md`, section 4.3 (slice I3). Deviation from the spec: the computation lives in Portfolio, not Reporting, because Portfolio already owns the Ledger and Market data ports and the investment read models; the path stays `/reports/return`.

## Global Constraints

- The result is an integer of basis points, rounded half to even; the solver may use floating point internally and nothing else does (AG2).
- An external flow is the negated sum of the weights of the postings on asset or liability accounts outside the tree, in the non-voided transactions of the period that also touch the tree. Income, expense, tax and realized-result postings are internal.
- A period has `from <= to` and at most 366 days; otherwise 400 `invalid_request` on `to`.
- `return_undefined` (422) when no money was ever invested (opening value and every contribution are zero) or the solver does not converge.
- A new operation has an entry in `internal/server/tool_exposure_test.go`; each new problem code has a test through the HTTP API.
- Do not edit scenarios S61, S67, S119 to S122 or any portfolio scenario.

## Review Focus

- Opening and closing equal with no flow (0% return): returns `annual_bp` 0, not `return_undefined`.
- Closing value zero after contributions (total loss): `return_undefined`, no panic.
- A withdrawal inside the period: a negative flow, valued with the same rule.
- An account of another user or an unknown id: 404.
- Flows in another currency than `value_in`: converted at the price of the flow date; a missing price is 422 `price_missing`.

---

### Task 1: Internal rate of return

**Files:**
- Create: `internal/portfolio/internal/domain/return.go`, `internal/portfolio/internal/domain/return_test.go`

**Interfaces:**
- Produces: `type CashFlow struct { Date time.Time; Amount int64 }` (investor view: money put in is negative, money taken out and the closing value are positive); `func AnnualReturnBP(flows []CashFlow) (bp int, ok bool)`.

- [ ] **Step 1: Write the failing tests** in `return_test.go`: `TestAnnualReturnBP` table with flows `{2025-10-31: -100000}`, `{2026-10-31: +105000}` giving 500, ok; the same with closing 100000 giving 0, ok; the same with closing 110000 giving 1000, ok; flows `-100000` at `2025-10-31`, `-100000` at `2026-04-30`, `+215000` at `2026-10-31` giving the value in the test's comment (computed independently in Python with the day-count `(date - first) / 365`, rounded half to even); a withdrawal case; and `ok == false` for a single flow, for flows without a negative one, for a zero closing value after a contribution.
- [ ] **Step 2: Run** `go test ./internal/portfolio/internal/domain -run AnnualReturnBP`. Expected: FAIL (undefined).
- [ ] **Step 3: Implement** `AnnualReturnBP` in `return.go`: sort by date, exponent `(date - first).Hours()/24/365`, solve `sum(amount / (1+r)^t) = 0` by bisection on `r` in `[-0.9999, 1000]` after a sign check at both ends (no sign change means `ok == false`), 200 iterations, result `round-half-even(r * 10000)`.
- [ ] **Step 4: Run** the same command. Expected: PASS.

### Task 2: Endpoint

**Files:**
- Modify: `db/queries/ledger/` (new query `TreeExternalFlows`), `internal/ledger/internal/app/` (service method), `internal/ledger/ledger.go` (`ExternalFlows`)
- Modify: `internal/portfolio/portfolio.go` (ledger port `ExternalFlows`, `ValuedBalance`), `internal/portfolio/internal/app/service.go` (`Return`), `internal/portfolio/internal/adapter/httpapi/server.go` (`GetReturn`), `api/openapi.yaml`, `internal/server/tool_exposure_test.go` (`getReturn: "-pending"`)
- Test: `internal/portfolio/return_test.go`

**Interfaces:**
- Consumes: `domain.AnnualReturnBP`, `domain.CashFlow` (Task 1); Ledger `ValuedBalance` (A121 parts exist).
- Produces: `GET /reports/return?account_id=&from=&to=&value_in=` returning `{annual_bp, flows: [{date, amount}], opening, closing}`; `ledger.Module.ExternalFlows(ctx, userID, accountID, from, to) ([]ExternalFlow, error)` with `ExternalFlow{Date time.Time; Value money.Money}` in the transaction's balancing currency.

- [ ] **Step 1: Write the failing scenarios** in `return_test.go`: S126 `TestS126ReturnOfBrokerage`: a checking account funds XP cash with 1,000.00 on 2025-10-15; a MXRF11 dividend of 50.00 is recorded on 2026-10-26; `GET /reports/return?account_id=<xp>&from=2025-11-01&to=2026-10-31&value_in=BRL` returns `annual_bp` 500, opening 1,000.00, closing 1,050.00 and no flow. A second case adds a contribution of 1,000.00 on 2026-04-30 and asserts the flow list (date and amount) and the Python-computed rate. S127 `TestS127ReturnUndefined`: a period before any posting is 422 `return_undefined`. Errors: a period over 366 days and `from` after `to` are 400 on `to`; an unknown account is 404; a flow in USD without a price is 422 `price_missing`.
- [ ] **Step 2: Run** `go test ./internal/portfolio -run 'S126|S127|Return'`. Expected: FAIL (404 on the endpoint).
- [ ] **Step 3: Implement** the pieces above. The query selects, per transaction touching the tree, `date`, `balancing_currency` and `-sum(weight)` of the postings on `asset` or `liability` accounts outside the tree. `Return` values the opening at `from - 1 day` and the closing at `to` with `ValuedBalance`, converts each flow with the price of its date when its currency differs from `value_in`, builds the `CashFlow` list (opening negative on `from - 1 day`, flows negated, closing positive on `to`) and calls `AnnualReturnBP`.
- [ ] **Step 4: Run** `go test ./internal/portfolio ./internal/ledger ./internal/server`. Expected: PASS.
- [ ] **Step 5: Document.** Add S126, S127 and amendment A123 to `docs/domain/06-scenarios.md` and the rule to `docs/domain/05-domain-model.md`; update spec section 4.3 with the Portfolio deviation. Run `make lint`.
