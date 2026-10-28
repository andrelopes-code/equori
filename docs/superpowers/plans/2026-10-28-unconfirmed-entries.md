# Unconfirmed Entries (A133) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** List as unconfirmed only the postings that neither an institution line nor an institution balance confirms, dated by when the institution reports them, and make the attention item explain itself and lead to the place that resolves it.

**Architecture:** A new ledger query `ListUnconfirmedPostings` replaces `ListUnlinkedPostings` for the unconfirmed list only; matching keeps its query. Ingestion's `Service.Unconfirmed` keeps the feed window and calls the new ledger method. The API entry gains `statement_id`; the web merges the per-account rows and routes card entries to their statement.

**Tech Stack:** Go, PostgreSQL, sqlc, oapi-codegen, React + TypeScript (`web/`), Vitest.

**Spec:** `docs/superpowers/specs/2026-10-28-unconfirmed-entries-design.md`

## Global Constraints

- Every business query filters by `user_id` (ADR 003).
- `ListUnlinkedPostings` stays unchanged: matching (A98–A100) chooses candidates among postings without a record, reconciled ones included.
- Window unchanged: from the feed's start to `feed.To − MatchHardLimit − 1` day (`MatchHardLimit` = 10).
- No regional value; `docs/contributing/regions.md` unchanged.
- `*.gen.go` and `web/src/api/schema.gen.ts` are regenerated with `make gen`, never edited.
- Tests: fixed clock through `apitest.Today`; status checked before decoding; exact values.
- UI changes follow `web/CLAUDE.md`; read it before Task 3.
- Commits: Conventional Commits, no AI attribution.

## Review Focus

1. A transaction with several unconfirmed postings (an installment plan) yields one entry, the earliest expected date — the web keys rows by `transaction_id`.
2. A posting reconciled by an account assertion but on a statement that has not closed is not listed (status check precedes the date check).
3. A voided cancellation does not offset its installment: offsetting reads only non-voided postings.
4. Offsetting is one-to-one: two +100.00 postings never both offset one −100.00 (S170).
5. Matching still links a line to a reconciled posting without a record (`TestResolveRefusesAReconciledCandidate` and S91–S96 keep passing).

---

### Task 1: Confirmation by balance (S167, S168)

**Files:**
- Modify: `db/queries/ledger/import.sql` (add `ListUnconfirmedPostings`)
- Modify: `internal/ledger/internal/app/imports.go` (`UnlinkedPosting` gains `StatementID uuid.UUID`; add `Service.UnconfirmedPostings`)
- Modify: `internal/ledger/internal/app/ports.go:461` (port method)
- Modify: `internal/ledger/internal/adapter/postgres/import.go` (adapter)
- Modify: `internal/ledger/ledger.go:283-289` (module method)
- Modify: `internal/ingestion/internal/domain/match.go:34` (`LedgerPosting` gains `StatementID uuid.UUID`)
- Modify: `internal/ingestion/internal/app/importer.go:88-90` (port method), `internal/ingestion/ingestion.go:259` (port adapter)
- Modify: `internal/ingestion/internal/app/review.go:105-122` (call the new method)
- Modify: `docs/superpowers/specs/2026-10-20-record-matching-design.md` (A103 heading: append "Amended by A133, `2026-10-28-unconfirmed-entries-design.md`"), `docs/domain/06-scenarios.md` (S167–S170 entry after S91–S97, same form)
- Test: `internal/ingestion/unconfirmed_test.go` (new)

**Interfaces:**
- Produces: `func (m *Module) UnconfirmedPostings(ctx context.Context, userID int64, accountID uuid.UUID, from, to time.Time) ([]UnlinkedPosting, error)` in `ledger`; `Date` holds the expected date, `StatementID` the statement (uuid.Nil without one).
- Produces: ingestion port `UnconfirmedPostings(ctx, userID, accountID, from, to) ([]domain.LedgerPosting, error)`.

- [ ] **Step 1: Write the failing tests** in `internal/ingestion/unconfirmed_test.go`

`TestS167ReserveTransfersAreConfirmedByBalance`: build the fixture of `TestS70ReserveTransfers` (`reserve_test.go:476`) up to its first `f.sync()` (extract the setup into a helper `reserveTransfers(t) (f syncFixture, cofrinho, algum string)` and call it from both tests). Then `f.h.Restart(apitest.Today("2026-11-30"))`, `f.p.SetItemUpdatedAt(mercadoPagoItem, "2026-11-30T15:00:00.000Z")`, `f.sync()`. For each of `cofrinho`, `algum`: `GET /api/v1/accounts/{id}/unconfirmed` → 200, `items` empty.

`TestS168EntryConfirmedByBalance`: `newMatching(t, nil)`; `f.recordOpeningBalance(m.checking, 286410)`; `m.manual("2026-10-05", -3000, "", "Cinema")` (derived balance 2834.10 = the served balance); `m.sync()`; precondition: `f.assertions(m.checking)` has one reconciled assertion; `GET .../unconfirmed` → 200, `items` empty.

- [ ] **Step 2: Run and read the failures**

Run: `go test ./internal/ingestion -run 'TestS16[78]' -race`
Expected: FAIL — S167 lists the transfers of 2026-11-11, S168 lists "Cinema".

- [ ] **Step 3: Add `ListUnconfirmedPostings`**

Same columns as `ListUnlinkedPostings` plus `statement_id`; the date column is the expected date `coalesce(p.settled_on, p.booked_on)` in this task. Conditions: `user_id`, `account_id`, `NOT p.voided`, `p.external_record_id IS NULL`, `p.status <> 'reconciled'`, expected date `BETWEEN @from_date AND @to_date`. One row per transaction (`DISTINCT ON (p.transaction_id)` ordered by expected date), final order by expected date, then transaction id. Run `make gen`.

- [ ] **Step 4: Wire the method through ledger app, adapter, module, ingestion port, and `Service.Unconfirmed`**

`Service.Unconfirmed` keeps its feed and window code and replaces only the `UnlinkedPostings` call. Update its doc comment to A133.

- [ ] **Step 5: Run the tests**

Run: `go test ./internal/ingestion ./internal/ledger -race`
Expected: PASS, S97 and S91–S96 included.

- [ ] **Step 6: Commit**

```bash
git add db/queries/ledger internal/ledger internal/ingestion docs/superpowers/specs/2026-10-20-record-matching-design.md docs/domain/06-scenarios.md
git commit -m "fix(ingestion): count a balance-reconciled posting as confirmed"
```
Body names spec A133.

### Task 2: Card postings dated by their statement, offsetting pairs, `statement_id` (S169, S170)

**Files:**
- Modify: `db/queries/ledger/import.sql` (`ListUnconfirmedPostings`)
- Modify: `api/openapi.yaml:4194-4203` (description per A133), `api/openapi.yaml:6576-6592` (`UnconfirmedEntry.statement_id`: `type: string, format: uuid`, optional; `date` description "the date by which the institution reports the line")
- Modify: `internal/ingestion/internal/adapter/httpapi/review.go:76-92` (set `StatementId` when not `uuid.Nil`)
- Test: `internal/ingestion/unconfirmed_test.go`

**Interfaces:**
- Consumes: Task 1's `UnconfirmedPostings` and `StatementID`.
- Produces: API field `statement_id` on `UnconfirmedEntry`; web type `components["schemas"]["UnconfirmedEntry"]["statement_id"]`.

- [ ] **Step 1: Write the failing tests**

`TestS169InstallmentDueAtItsStatementClosing`: `f := newSyncFixture(t)`; `card := f.h.Card("Nubank card", 3, 10, "next")`; `f.mapCard(card, "2026-08-01")`; `f.line(pluggy.SubtypeCard, installmentLine(1, "2026-08-14", "100.00", nil))`; `f.sync()`. `GET /api/v1/accounts/{card}/unconfirmed` → 200, exactly one item: the plan's transaction, `amount.amount` −10000, `date` "2026-10-03", `statement_id` = id of the card's statement with `reference_month` 2026-10-01 (read with `f.h.Pool`).

`TestS170CancelledInstallmentsOffsetTheirReversals`: same setup; plan id from `ledger_installment_plan` (as `TestInstallmentOfACancelledPlan`, `installment_test.go:177`); `POST /api/v1/installment-plans/{id}/cancellation` `{"date": "2026-09-20"}` → 201 with the cancellation's `id`. `GET .../unconfirmed` → exactly one item: `transaction_id` = cancellation id, `amount.amount` 10000, `date` "2026-10-03".

- [ ] **Step 2: Run and read the failures**

Run: `go test ./internal/ingestion -run 'TestS1(69|70)' -race`
Expected: FAIL — installments 2 to 6 listed with date 2026-08-14 (one entry, wrong date and no `statement_id`).

- [ ] **Step 3: Extend `ListUnconfirmedPostings`**

Expected date: `s.closing_date` when `p.statement_id` is set (`LEFT JOIN ledger_statement s`), else `coalesce(p.settled_on, p.booked_on)`. Exclude offset postings, one-to-one: among non-voided postings of the account without a record and with a statement, partition by `(statement_id, abs(amount), sign(amount), linked group)` and number by `id`; the k-th negative offsets the k-th positive of the same statement and absolute amount when their transactions are joined by `ledger_link` of type `cancellation_of` or `anticipation_of` (either direction); an offset posting is excluded on both sides. Run `make gen`.

- [ ] **Step 4: Emit `statement_id` in the handler; run `make gen` after the OpenAPI edit**

- [ ] **Step 5: Run the tests**

Run: `go test ./internal/ingestion ./internal/ledger ./internal/server -race`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add db/queries/ledger internal api/openapi.yaml web/src/api/schema.gen.ts
git commit -m "fix(ingestion): date a card posting by its statement closing"
```

### Task 3: Attention item: one row per account, card destination

**Files:**
- Modify: `web/src/features/overview/attention.ts`, `web/src/features/overview/attention-block.tsx`
- Modify: `web/src/i18n/catalog.pt-BR.ts:1848`, `web/src/i18n/catalog.en.ts` (same key)
- Test: `web/src/features/overview/attention.test.ts`, `web/src/features/overview/overview-page.test.tsx`

**Interfaces:**
- Consumes: `statement_id` (Task 2).
- Produces: `AttentionItem` gains `unconfirmed?: number` (on a `difference` item) and `statementId?: string` (on an `unconfirmed` item); `attentionItems` input `unconfirmed` entries become `{ account, count, statementId?: string }`.

- [ ] **Step 1: Write the failing tests**

In `attention.test.ts`, replace the expectation of the first case (the specified behavior changes; commit body names A133): account `a` has 2 unconfirmed and a difference → items `[["uncategorized",3,undefined],["connections",2,undefined],["difference",1,"a"]]` and the difference item has `unconfirmed: 2`. New case: account `b` with 1 unconfirmed, `statementId: "s1"`, no difference → one `unconfirmed` item with `statementId: "s1"`.

In `overview-page.test.tsx`: a card account with one unconfirmed entry whose `statement_id` is `s1` renders the row "Lançamentos que o banco não informou" (pt-BR) linking to `/cards/{id}/statements/s1`.

- [ ] **Step 2: Run and read the failures**

Run: `cd web && pnpm vitest run src/features/overview`
Expected: FAIL on the merged row and the destination.

- [ ] **Step 3: Implement**

`attentionItems` drops the `unconfirmed` item of an account that has a difference item and puts its count on that item. `attention-block.tsx` passes the earliest entry's `statement_id` (entries come oldest first), shows the count as the row's line on a difference row, and `destination()` returns `{ to: "/cards/$accountId/statements/$statementId", params }` for a card item with a `statementId`. Copy: pt-BR `"overview.attention.unconfirmed": "Lançamentos que o banco não informou"`, en `"Entries the bank did not report"`; new key `"overview.attention.unconfirmedCount"`: pt-BR `"{count} sem confirmação do banco"`, en `"{count} not confirmed by the bank"`.

- [ ] **Step 4: Run `make web-check` and the tests of Step 2**

Expected: PASS.

- [ ] **Step 5: Commit** — `fix(web): name the unconfirmed attention row by what to do`

### Task 4: Reconciliation note and statement line tag

**Files:**
- Modify: `web/src/i18n/catalog-accounts.pt-BR.ts:316-317`, `web/src/i18n/catalog-accounts.en.ts` (same key)
- Modify: `web/src/features/accounts/reconciliation-tab.tsx:436-438`
- Modify: `web/src/features/cards/statement-lines.tsx` (prop `unconfirmed?: ReadonlySet<string>` of transaction ids), `web/src/features/cards/statement-page.tsx:286` (pass the set from `unconfirmedQuery(api, accountId)`)
- Modify: the cards catalogs that hold `statement.*` keys
- Test: `web/src/features/accounts/reconciliation-tab.test.tsx`, `web/src/features/cards/statement-page.test.tsx`

**Interfaces:**
- Consumes: `unconfirmedQuery` from `@/features/accounts` (already exported).

- [ ] **Step 1: Write the failing tests**

Reconciliation tab: `reconciliation.unconfirmedNote` reads, pt-BR `"Estes lançamentos não têm linha do banco. Um lançamento duplicado ou digitado errado se resolve anulando ou corrigindo a transação. Um lançamento correto se confirma quando o saldo informado pelo banco bate."`; en `"The bank reported no line for these entries. A duplicated or mistyped entry is resolved by voiding or correcting the transaction. A correct entry is confirmed when the balance the bank reports matches."`

Statement page: a line whose transaction is in the unconfirmed list shows a tag "Sem linha do banco" (en "No bank line").

- [ ] **Step 2: Run and read the failures**

Run: `cd web && pnpm vitest run src/features/accounts/reconciliation-tab.test.tsx src/features/cards/statement-page.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement** the copy and the tag (Slotted `Tag`, `size="sm"`, `tone="warning"`, beside `DisputeTag` in the row header `Inline`).

- [ ] **Step 4: Run `make web-check` and the tests of Step 2**

Expected: PASS.

- [ ] **Step 5: Commit** — `fix(web): say why an entry lacks a bank line and how it resolves`

### Task 5: Final verification

- [ ] **Step 1:** Run `make check`. Expected: exit 0.
- [ ] **Step 2:** With `make dev` on the development database, `GET /api/v1/accounts/{id}/unconfirmed` for "Algum dinheiro", "Cofrinho Mercado Livre" and "Nubank Gold" returns empty `items` (spec, Intent table). Record the result in `.claude/progress/current.md`.
