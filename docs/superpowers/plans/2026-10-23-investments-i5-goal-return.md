# Investments I5: goals consume the return Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `Goal` carries `trailing_return`, the money-weighted return of its accounts over the last 12 months, and the goals page offers it as the yearly return of the what-if.

**Architecture:** Ledger's external flows take several roots, so the goal's accounts count as one tree and a transfer between two of them is internal. Ledger also gives the first posting date of the roots. Portfolio exposes `TrailingReturn` on its module; Planning reads it through a port and attaches it to each measured goal.

**Tech Stack:** Go, sqlc, oapi-codegen, `internal/apitest`; React, Vitest.

**Spec:** `docs/superpowers/specs/2026-10-23-investments-design.md`, section 4.4 (slice I5); builds on `docs/superpowers/plans/2026-10-23-investments-i3-return.md`.

## Global Constraints

- `trailing_return` is `{ period_months, annual_bp }` and is absent unless the accounts have at least three months of postings and at least one external flow in the window (AG4).
- Window: from `today - 365 days` or the first posting, whichever is later, to today; valued in the goal currency; `period_months` is the whole months of the window, at most 12.
- A missing price or an undefined return makes the field absent; any other error propagates. The goals list never fails because of the return.
- `GET /reports/return` keeps one `account_id`; only the internal API takes several roots.
- Do not edit scenarios S61, S67, S119 to S122, S126, S127 or any portfolio scenario.
- Commits are deferred while the index holds another session's work.

## Review Focus

- A transfer between two goal accounts is not a flow of the goal.
- A goal over one checking account with no history: no `trailing_return`.
- A goal whose first posting is two months old: no `trailing_return`.
- A goal with history and no flow in the window: no `trailing_return`.
- A goal of another user is never read (the service passes the user id).

---

### Task 1: Ledger roots and first posting

**Files:**
- Modify: `db/queries/ledger/balance.sql` (`TreeExternalFlows` takes `account_ids uuid[]`; new `TreeFirstPosting`), `internal/ledger/internal/app/ports.go`, `internal/ledger/internal/app/currency.go`, `internal/ledger/internal/adapter/postgres/repository.go`, `internal/ledger/ledger.go`
- Modify: `internal/portfolio/portfolio.go` and `internal/portfolio/internal/app/return.go` (callers pass a slice of one id)
- Test: `internal/portfolio/return_test.go` (existing S126 keeps passing), `internal/ledger` test for the two-root case

**Interfaces:**
- Produces: `ledger.Module.ExternalFlows(ctx, userID, accountIDs []uuid.UUID, from, to time.Time) ([]ExternalFlow, error)`; `ledger.Module.FirstPosting(ctx, userID, accountIDs []uuid.UUID) (time.Time, bool, error)`.

- [ ] **Step 1: Write the failing test** `TestExternalFlowsOfSeveralRoots` through the HTTP API of Portfolio (`GET /reports/return` with one root) is not enough; add to `internal/planning/goals_test.go` in Task 2 the two-account scenario that needs it. Here, add a Go test in `internal/ledger` that records a transfer between two asset accounts and asserts `ExternalFlows([a, b])` returns none while `ExternalFlows([a])` returns the transfer. Run it. Expected: FAIL (signature).
- [ ] **Step 2: Implement** the array parameter and the `FirstPosting` query (`min(booked_on)` over non-voided postings of the roots and their descendants).
- [ ] **Step 3: Run** `go test ./internal/ledger ./internal/portfolio`. Expected: PASS.

### Task 2: Trailing return on the goal

**Files:**
- Modify: `internal/portfolio/portfolio.go` (`TrailingReturn`), `internal/portfolio/internal/app/return.go` (multi-root `Return` core), `internal/planning/planning.go` (port), `internal/planning/internal/app/goals.go` and `ports.go`, `internal/planning/internal/adapter/httpapi/goals.go`, `internal/server/server.go` (construct Portfolio before Planning), `api/openapi.yaml` (`Goal.trailing_return`)
- Test: `internal/planning/goals_test.go`

**Interfaces:**
- Produces: `portfolio.Module.TrailingReturn(ctx, userID, accountIDs []uuid.UUID, today time.Time, in money.Currency) (bp int, months int, ok bool, err error)`; planning port `Returns` with the same shape.

- [ ] **Step 1: Write the failing scenario S130** `TestS130GoalTrailingReturn`: clock 2026-11-12; a brokerage with a cash child receives 1,000.00 on 2025-10-15 and 50.00 of income on 2026-10-26; a goal over the brokerage returns `trailing_return` with `period_months` 12 and the rate solved independently for opening 1,000.00 on 2025-11-11, closing 1,050.00 on 2026-11-12 and no flow in the window — which is undefined (no flow), so the scenario adds a contribution of 1,000.00 on 2026-04-30 and a closing of 2,050.00; a goal over one checking account with no history has no `trailing_return`; a goal whose only posting is two months old has none; a transfer between the two accounts of one goal is not a flow.
- [ ] **Step 2: Run** `go test ./internal/planning -run S130`. Expected: FAIL.
- [ ] **Step 3: Implement** the window rule, the absent cases, the port and the field.
- [ ] **Step 4: Run** `go test ./internal/planning ./internal/portfolio ./internal/server ./internal/ledger` and `make lint`. Expected: PASS.

### Task 3: Goals page

**Files:**
- Modify: `web/src/features/goals/goal-what-if.tsx`, `web/src/i18n/catalog.en.ts`, `web/src/i18n/catalog.pt-BR.ts` (`goals.trailing`, `goals.useTrailing`)
- Test: `web/src/features/goals/goals-page.test.tsx`

**Interfaces:**
- Consumes: `Goal.trailing_return` from the regenerated `web/src/api/schema.gen.ts`.

- [ ] **Step 1: Write the failing tests:** a goal with `trailing_return` `{ period_months: 12, annual_bp: 840 }` over a brokerage shows "Last 12 months: 8.4%" and a button "Use this return" that sets the return control to 8.5; a goal without the field shows neither.
- [ ] **Step 2: Run** `pnpm exec vitest run src/features/goals`. Expected: FAIL.
- [ ] **Step 3: Implement** the line and the button beside the return control, shown only when the control is shown and the field exists; the control keeps starting at zero.
- [ ] **Step 4: Run** the web suite, `pnpm exec eslint .`, `pnpm typecheck`, `pnpm format:check`. Expected: PASS.
