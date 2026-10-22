# Web Accounts and Cards Implementation Plan

> **For agentic workers:** execute task by task in the main session (superpowers:executing-plans), in the shared main worktree (no `git worktree`), in slices of at most three tasks with a checkpoint in `.claude/progress/current.md`. Every screen task follows the `compose-screen` skill; every region filled by a request follows `waiting-states`; every own element follows `build-own-element`. Each screen task ends with the `review-screen` skill over the changed screen. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the placeholder pages of Accounts and Cards with complete screens that reach every account, institution, reconciliation, import, aggregator-mapping and card operation the backend offers.

**Architecture:** Feature `accounts` owns the balance sheet, the account record, the account form, institutions, reconciliation, file import and the aggregator links. Feature `cards` owns the card list, the card record, statements and installment plans. Each feature reads the API through its `api.ts` (O3). URL search parameters hold every tab, period and selection, so a link reproduces the screen.

**Tech Stack:** React 19, TanStack Router 1.170, TanStack Query 5, `@slotted/react` 0.1.0-beta.8, Vitest + Testing Library + jsdom. No new dependency.

**Spec:** none. The owner delegated every UX decision on 2026-10-21 ("telas muito bem construídas, detalhadas, sem nada básico"; "se essas coisas extras são relacionadas a accounts e já existe backend para isso, entram na mesma etapa"; cards in the same plan). The decisions below are the implementer's. Out of scope: creating, syncing settings of and deleting integrations (`/integrations`), which belong to Settings.

## Global Constraints

- `web/CLAUDE.md` rules O1–O8 and the Slotted feedback protocol; findings go in the final reply of each slice under `Slotted findings`.
- Every user-visible string in `catalog.en.ts` and `catalog.pt-BR.ts`, with the terminology table of section 1.
- Money as integer plus instrument code, formatted by instrument scale (O7). Never `Number` division for amounts.
- `accounts` never imports `transactions` or `cards` (both import `accounts`); a link to their screens is a route path.
- Mutations rely on the global invalidation of `src/api/query-client.ts` (every query stale after a successful mutation); no per-mutation invalidation lists.
- Tests through `renderApp` with `fakeApi`; fixtures in `src/testing/account-api.ts`; assert visible text and the requests sent (method, path, query, body). Check the status before reading a body. Fixed date `2026-10-17` (the harness default).
- Breakpoints 600 px and 1024 px; page widths by CP-07: destinations and records `full`, forms `wide` (owner review item 25, `b55d4f2`).
- Each `Problem.code` an operation of this plan can return has a message under the field or in the form summary (ER-01): `account_not_empty`, `system_account`, `invalid_account`, `version_conflict`, `posting_reconciled`, `statement_not_closed`, `statement_financed`, `dispute_open`, `dispute_resolved`, `already_reconciled`, `difference_remains`, `record_resolved`, `already_matched`, `integration_unavailable`, `provider_unauthorized`, `provider_unavailable`, `request_too_large`, `validation_failed`.

## Review Focus

1. An account in a currency other than the base currency: group totals exclude it and say how many are excluded (`BalanceGroup.excluded`); its own figures use its own instrument scale. Test in Task 4.
2. A parent account: the ledger draws no running balance (LG-02), the balance figure sums the subtree, the assertion form is absent (assertions are for leaf accounts). Tests in Tasks 6 and 7.
3. A card without a billing cycle rule: the card page states that statements need one and opens the rule form; placement shows the `no rule` problem in words, not a raw error. Test in Task 13.
4. A CSV import with no saved profile: the import page asks for the profile before the upload and never sends the file first. Test in Task 9.
5. An external account of a subtype with no compatible ledger account: the link drawer offers only "Create account" with the kind preselected. Test in Task 11.

---

## 1. Terminology (pt-BR catalogue)

| Concept (API) | pt-BR | en |
|---|---|---|
| booked balance | Saldo | Balance |
| settled balance | Saldo liquidado | Settled balance |
| balance assertion | Saldo informado | Reported balance |
| reconcile (account, statement) | Reconciliar | Reconcile |
| open difference | Diferença em aberto | Open difference |
| unlock | Reabrir reconciliação | Unlock reconciliation |
| unconfirmed entry | Lançamento sem confirmação | Unconfirmed entry |
| import batch | Importação | Import |
| external record | Linha importada | Imported line |
| resolve `match` | Conciliar | Match |
| external account | Conta externa | External account |
| mapping | Vínculo | Link |
| sync | Sincronizar | Sync |
| projection | Projeção | Projection |
| position | Posição | Position |
| statement | Fatura | Statement |
| billing cycle rule | Ciclo da fatura | Billing cycle |
| credit limit | Limite | Credit limit |
| card (physical/virtual) | Cartão físico / Cartão virtual | Physical card / Virtual card |
| installment plan | Parcelamento | Installment plan |
| anticipation | Antecipação | Early payment |
| statement financing | Financiamento da fatura | Statement financing |
| refund | Estorno | Refund |
| dispute | Contestação | Dispute |
| institution | Instituição | Institution |

## 2. Information architecture

| Route | Screen | Page width |
|---|---|---|
| `/accounts` | Balance sheet (header tabs: Contas, Instituições, Vínculos with pending count) | full |
| `/accounts/institutions` | Institutions | full |
| `/accounts/links` | External accounts and their links | full |
| `/accounts/new?kind=` | Account form, create | wide |
| `/accounts/$id?tab=&from=&to=` | Account record; `tab` ∈ `activity` (default), `reconciliation`, `imports`, `scheduled`, `positions`, `sync` | full |
| `/accounts/$id/edit` | Account form, edit | wide |
| `/accounts/$id/import` | File import with CSV profile | wide |
| `/accounts/$id/imports/$batchId?state=&record=` | Import batch and review workspace | full |
| `/cards` | Card list | full |
| `/cards/$accountId?tab=` | Card record; `tab` ∈ `statements` (default), `plans`, `cards`, `settings` | full |
| `/cards/$accountId/statements/$statementId?line=` | Statement record | full |

- `/accounts/$id` of a `credit_card` account redirects (replace) to `/cards/$id`.
- Command palette adds: New account, Institutions, Account links, Import statement (opens an account chooser, then `/accounts/$id/import`), each account and each card by name (group `go`).
- The account sheet of the entry form (`features/transactions/account-sheet.tsx`) gains a foot link "Adicionar conta ou cartão" → `/accounts/new`.

## 3. Balance sheet (`/accounts`)

- Header: title; subheading "Patrimônio líquido {amount} em {date}"; date control (date-picker, default today, `?date=`), basis segmented control Saldo / Saldo liquidado (`?basis=`); actions New account (primary), Refresh (AF-07).
- Figures (stat-card grid, RP-02): Ativos, Passivos, Patrimônio líquido, each with a comparison line against the same basis 30 days earlier (RE-04: amount and percentage). A second `/balances` call at `date − 30 days` feeds the comparison.
- Pending links: an `inline-message` "{n} contas externas aguardam vínculo" leading to `/accounts/links`, drawn only when `n > 0`.
- One framed `table` per group of `groupBalances` (available, reserves, cards, loans), group total in the summary row (RP-07), excluded-currency count stated under it. Rows nest sub-accounts (indented row header, `account-tree.ts`). Columns: mark + name (row header) with institution on the second line; kind; reconciliation status (tag: "Reconciliada em {date}", "Diferença de {amount}", "Nunca reconciliada"; liability and asset leaf accounts only); 90-day `sparkline` of `/reports/balances` per top-level row, fetched per row; balance (semibold, numeric) with the settled balance on the second line when it differs. Card rows lead to `/cards/$id`, others to `/accounts/$id`.
- Switch "Mostrar encerradas" (`?closed=true`) adds closed accounts with a `Encerrada` tag; default hides them (A74).
- Empty: `result-state` "Nenhuma conta" with New account and, when a connection exists, Account links.
- Phone: each group is a `list` of rows (mark, name, balance; status under the name); figures become one list of rows (OV-02).

## 4. Account form (`/accounts/new`, `/accounts/$id/edit`)

- Create step 1, kind: tiles in four headed groups — Contas (checking, cash, wallet, benefit), Cartões (credit_card), Reservas e investimentos (savings, reserve, brokerage), Dívidas e valores a receber (loan, payable, receivable) — each tile with the account shape (`AccountMark` without logo) and one sentence of what it holds. `?kind=` preselects and skips the step. Class follows the kind (`account-kinds.ts`).
- Fields: name; institution (`InstitutionField`, section 5); currency (select of `/instruments` of type currency, default the base currency); opened on (date-picker, default today); parent (any open, non-system account of the same class, except the account itself and its descendants); yield mode switch "Rende automaticamente" (savings, reserve only; explains that a higher reported balance becomes yield, S24); colour (8 data colours, the categories `AppearancePicker` colour row without icons; the mark never draws `Account.icon`).
- Opening balance (create only, optional): amount and sign by class; on submit after `POST /accounts`, `POST /transactions` dated `opened_on` with postings `[account +x, opening_balances −x]` (S23); a card's opening balance is a charge on the open statement (`statement` = placement reference of `opened_on`, after the rule exists).
- Card section (credit_card only, create): billing cycle (closing mode day / before due, closing day or days before due, due day, adjustments with their words, `effective_from` = reference month of `opened_on`); credit limit (amount, `effective_from` = `opened_on`); cards (rows of holder, last four, virtual switch). Submit order: account, rule, limit, cards, opening balance; a failure after the account exists navigates to the record with an `inline-message` naming the step that failed and a Retry for the remaining steps.
- Live summary beside the form at 1024 px and above, under it below (FM-14): the mark as it will draw, the group it joins, and for a card "Uma compra hoje entra na fatura de {month}, que fecha em {date} e vence em {date}" computed client-side from the rule fields (`billing-preview.ts`, a port of `DatesFor` and `StatementFor` in `internal/ledger/internal/domain/billing.go` without calendar shifts, labelled "estimativa"; the reference month is the month of the due date, A1).
- Edit: name, institution, parent (`PUT /accounts/{id}/parent`, A73 cycle error under the field), yield mode, colour; FM-09 sends only moved fields; kind, class and currency read-only with one sentence each (FM-04).
- Draft in `sessionStorage` (FM-05), as `form-draft.ts` in transactions does.

## 5. Institutions (`/accounts/institutions`) and the institution field

- `InstitutionField`: combobox; the owner's institutions first (logo, name), then the `logos-bancos-br` catalogue entries not yet created (logo, name, COMPE); choosing a catalogue entry creates `POST /institutions {name, code: COMPE, ispb}` and selects it; "Criar "{query}"" at the end creates one without ISPB.
- Page: framed `table` of institutions: logo, name, COMPE code, ISPB, number of accounts (from the account list), row menu Set logo (dialog with the catalogue search, `PUT /institutions/{id}/ispb`; Remove logo sends `null`). Header action New institution (dialog with `InstitutionField` in create mode).

## 6. Account record (`/accounts/$id`)

- Header (RP-01): `AccountMark` lg (logo, colour, goal ring when a goal covers the account), name, tags kind and health (reconciliation status as in section 3; `Encerrada`); subheading: institution · external account last four · `SyncStatus`-style line "Sincronizada {instant}" when linked. Actions: New transaction (→ `/transactions/new?account_id=`), Import statement, Record balance (opens the reconciliation tab with `?assert=1`, FM-12), menu: Edit, View in transactions (`/transactions?account_id=`), Close / Reopen, Unlock reconciliation.
- Figures: Saldo (booked, today; settled on the comparison line), Projeção em 30 dias (`/accounts/{id}/projection?to=today+30`, closing and the difference), Última reconciliação (date, or "Nunca"), and for a covered account the goal (progress, remaining, due date, leading to `/goals`).
- Chart section: balance line over the period (`?range=` 30, 90, 365 days; default 90) from `/reports/balances`, continued by the projection points to today + 30 days as a second, dashed series labelled "Projeção"; a reference line at today.
- Tabs (RP-03, counts in labels): Movimentação; Reconciliação (open difference count 0/1, unconfirmed count); Importações (count); Agendados (projection points count); Posições (brokerage only); Sincronização (linked accounts only).
- Movimentação: period control (the transactions `PeriodControl`, moved to `src/ui/period-control.tsx` with its presets so `accounts` does not import `transactions`), search; `data-grid` of transactions with a posting on the account (`GET /transactions?account_id&from&to`, cursor). Columns: date, description (payee or description; counter-account on the second line), status mark (pending, cleared, reconciled with a lock), amount of this account's postings (signed), balance after (LG-02, leaf accounts only, walked back from the booked balance at `to`). Row → `/transactions/$id`. Day groups with the day's net change, as the transactions grid does.
- Reconciliação: status block (last reconciled on; open difference with date and amount; the sentence of what each resolution does); assertion form (date, reported amount; source `manual`) in the section (FM-07), result stated from `AssertionResult` (reconciled; yield of {amount} recorded, linking the transaction; difference stays open); resolve choices Adjustment ("registra {amount} em Ajustes") and "Já lancei o que faltava" (`transactions_added`, refusal `difference_remains` states the remaining amount after re-reading, ER-02); history `table` of assertions (date, amount, source, recorded at, reconciled tag), cursor pages; unconfirmed entries `table` (date, description, amount; row → transaction) with the sentence of the A103 window; Unlock dialog (date, consequence sentence "postings settled from {date} return to cleared").
- Importações: batches of this account (client filter over `/import-batches` pages until 50 matches or the end): started at, source, file name, period, counts as `badge`s (created, matched, needs review in warning tone), balance outcome; row → batch page.
- Agendados: projection points as a `table`: date, schedule (its `description`, else its payee, from `GET /schedules/{id}`, one request per distinct schedule), kind, amount, balance after; to-date control 30/90/365 days (max today + 12 months).
- Posições: `/positions?date=today` filtered to the account's children: instrument, quantity, average cost, cost basis, market value, unrealized result (market − cost, toned); summary row in the base currency; missing price says "sem cotação".
- Sincronização: the external account (connection name, subtype, last four, sync from, last synced on), provider status in words, last error, next provider update, action Sync now (`POST /connections/{id}/sync`, result counts per batch), Change start date (re-map with a new `sync_from`), Stop syncing (`ignored: true`, confirm).
- Close dialog: date (default today); `account_not_empty` states the balance at that date; `system_account` states that the subtree holds a system account; descendants that will close are listed (A74). Reopen: confirm listing the closed ancestors that reopen.
- Errors: RP-04 (`not-found`, `error` with Try again).

## 7. Import (`/accounts/$id/import`) and batch (`/accounts/$id/imports/$batchId`)

- Import: `upload` drop zone (one file, ≤ 10 MiB checked before sending, `.ofx`, `.csv`); format from the extension, overridable. CSV: profile section prefilled from `GET csv-profile` (404 → empty): delimiter, header rows, date column + layout, amount column or debit + credit columns (segmented control), decimal separator, description column, id column, amount sign. Column fields are selects of the header names read from the file when `header_rows > 0`, else numeric positions. Live preview `table` of the first 10 parsed lines (date, description, amount) with unreadable cells marked, from `csv-preview.ts` (pure, client-side, same rules as the profile). Submit: `PUT csv-profile` when it changed, then `POST imports` (multipart) → navigate to the batch. `request_too_large` and `validation_failed` under the upload.
- Batch: header with file name or "Sincronização", account, period, started/completed; figures (RP-02): Lidas, Conciliadas, Criadas, Para revisar, Descartadas, Ignoradas (+ Atualizadas, Retiradas for `open_finance`); balance outcome sentence (recorded: "Saldo de {amount} em {date} registrado" linking the reconciliation tab; skipped: the reason). Filter pills by state (`?state=`), `data-grid` of records (date, description, amount, state tag, linked transaction).
- Review workspace (needs_review): at 1024 px and above, queue at the left, the selected record (`?record=`) in the middle, candidates at the right; below 600 px the queue only, a row opens its own region (WS-01). Record: date, description, amount, review reason in words (ambiguous, probable, changed; `unapplied_change` stated). Candidates: one row per `scored_candidates` item with the transaction read by id (date, description, payee, amount) and the score `table` of criteria (amount, date, counterparty) with their levels in words (WS-02). Actions: Match (per candidate), Create transaction, Discard; after each, the next record of the queue is selected. `record_resolved`/`already_matched` re-read the record and say so.

## 8. Account links (`/accounts/links`)

- Per connection (by name): provider status, last synced, next provider update, Sync now. Table of external accounts: name, subtype in words, last four, currency, state tag (pending, linked to {account}, ignored).
- Link drawer (pending or ignored rows): choose an existing compatible account (leaf, same currency, kind compatible by the A35 table in `account-kinds.ts`, not fed by another external account) or Create account (opens `/accounts/new?kind=&name=&return=links`, returning with the new account selected); sync from (date-picker, default first day of the previous month); submit `PUT /connections/{id}/accounts/{ext}`. Ignore as a row action. `integration_unavailable`, `provider_unauthorized`, `provider_unavailable` stated per connection.

## 9. Cards (`/cards`)

- Header: title; subheading "{n} cartões"; actions New card (→ `/accounts/new?kind=credit_card`), Refresh.
- Figures: Faturas abertas (sum of open statements' `amount_due`), A pagar (sum of `unpaid` of closed, partially paid and overdue statements, with the nearest due date), Limite disponível (sum of `available_limit` over `credit_limit`).
- One card tile per credit_card account (grid, 1/2/3 columns by width; own element `card-tile.tsx`): mark (card shape, logo), name, institution; current statement amount, status tag, closing and due dates; a limit meter (used = limit − available; `meter`/`progress` family with the share in words); a closed unpaid statement adds "Vence {date}: {unpaid}" and a Pay action. Tile → `/cards/$accountId`. Closed card accounts behind "Mostrar encerrados".

## 10. Card record (`/cards/$accountId`)

- Header: mark, name, tags (status of the current statement, Encerrado), subheading institution · active cards' last four. Actions: Pay statement (the oldest unpaid closed one), New installment purchase (form dialog: date, description, payee, category, total, count, interest, first statement; `POST /installment-purchases`), menu: Edit account (`/accounts/$id/edit`), Close / Reopen. A card is reconciled by statement (section 11), not by balance assertion.
- Figures: Fatura atual (open statement `amount_due`, closing date), Próxima a pagar (unpaid, due date), Limite disponível (available of limit, meter), Comprometido em 12 meses (sum of `/accounts/{id}/commitments?month=` over the next 12 months).
- Chart section: bars of `billed_amount` of the last 12 statements and of the commitments of the next 12 months, two series (Faturado, Comprometido), month axis.
- Faturas tab: framed `table` (bounded by `from`, default 24 months back, "Carregar anteriores" moves `from`): reference, closing, due, amount due, settled, unpaid, status tag, institution difference mark; row → statement page.
- Parcelamentos tab: plans found in the postings of the open and upcoming statements (`installment.plan_id`), each read by `/installment-plans/{id}`: description, installments billed of count, amount per installment, remaining, last statement, status tag; row opens the plan drawer (section 12).
- Cartões tab: `table` of physical and virtual cards: holder, last four, virtual tag, active switch (`PATCH /cards/{id}`); Add card dialog (holder, last four, virtual).
- Configuração tab: billing cycle versions `table` (effective from, closing mode in words, due day, adjustments) with New version (FM-07 form, same fields as section 4); credit limit versions `table` with New limit; placement check: date-picker "Compra em" → "Entra na fatura {month}, fecha {date}, vence {date}" from `GET statement-placement`.
- A card with no billing rule: an `inline-message` in place of the figures states that statements need a billing cycle and opens the Configuração tab with the form open.

## 11. Statement (`/cards/$accountId/statements/$statementId`)

- Header: "Fatura de {month}" with previous / next statement steppers (`neighbours`), status tag, reconciled tag; subheading closing and due dates. Actions by status: Pay (not `financed`), Finance (`closed`, `partially_paid`, `overdue`), Reconcile (closed statuses, not reconciled), Record institution facts; menu Remove institution facts (when `institution.source = owner`).
- Figures: Saldo anterior, Compras, Créditos, Pagamentos, Total da fatura (`amount_due`), Em aberto (`unpaid`); when the institution reported the statement, a comparison line "Instituição: {total} (diferença {amount_difference})" and the minimum payment.
- Breakdown sentence (RP-06 style): "Total = anterior + compras − créditos − pagamentos", each term with its amount.
- Lines: framed `table` grouped by day: date, description, installment "{n}/{count}", role tag (charge, credit, payment), amount (credits and payments toned positive); summary row of the totals. Row menu on charges: Refund, Dispute (open; or Resolve when open), Installment plan (when `installment` is present), Open transaction.
- Pay dialog: date (today), from account (`AccountField` from `transactions`, balance accounts), amount with presets Em aberto, Mínimo (institution facts), Outro; consequence lines (FM-14): statement status after, account balance after.
- Finance form (dialog): date, installment count, installment amount; total and interest (`financingInterest`) shown live; `statement_not_closed`, `statement_financed` stated.
- Reconcile dialog: amount due reported by the institution, prefilled with `institution.total` when present; equal → reconciled; `difference_remains` states the difference and offers Record institution facts.
- Institution facts dialog: closing date, due date, total, minimum; consequence sentence that postings may move to another statement (A86).

## 12. Line actions and installment plans

- Refund dialog: date, amount (≤ charge, default full), statement (default the placement of the date); `POST /transactions/{id}/refunds`.
- Dispute: open (date) → `POST /transactions/{id}/disputes`; the line shows a "Em contestação" tag from `/transactions/{id}/disputes`; resolve (date, won/lost, statement for the refund) → `POST /disputes/{id}/resolve`; `dispute_open`, `dispute_resolved` stated.
- Plan drawer: schedule `table` (number, statement, amount, reversed tag), interest, status; Cancel (date, credit statement; consequence: remaining installments credited) and Anticipate (date, from, to, target statement, amount; discount shown with `anticipation` of `card-math.ts`).

---

## File structure

`web/src/features/accounts/`: `api.ts` (extended), `account-kinds.ts` (+test), `accounts-page.tsx`, `balance-sheet-figures.tsx`, `balance-group-table.tsx`, `account-row-status.tsx`, `accounts-search.ts` (+test), `institutions-page.tsx`, `institution-field.tsx` (+test), `institution-catalogue.ts` (+test), `account-form-page.tsx`, `account-form.tsx`, `kind-chooser.tsx`, `card-setup-section.tsx`, `account-draft.ts` (+test), `billing-preview.ts` (+test), `create-account-steps.ts` (+test), `account-page.tsx`, `account-header.tsx`, `account-figures.tsx`, `balance-chart.tsx`, `account-search.ts` (+test), `account-ledger.tsx`, `running-balance.ts` (+test), `reconciliation-tab.tsx`, `assertion-form.tsx`, `assertion-result.ts` (+test), `unlock-dialog.tsx`, `close-account-dialog.tsx`, `imports-tab.tsx`, `scheduled-tab.tsx`, `positions-tab.tsx`, `sync-tab.tsx`, `import-page.tsx`, `csv-profile-section.tsx`, `csv-preview.ts` (+test), `batch-page.tsx`, `review-workspace.tsx`, `candidate-score.tsx`, `links-page.tsx`, `link-drawer.tsx`, `link-candidates.ts` (+test), page tests `accounts-page.test.tsx`, `account-form-page.test.tsx`, `account-page.test.tsx`, `import-page.test.tsx`, `batch-page.test.tsx`, `links-page.test.tsx`, `institutions-page.test.tsx`.

`web/src/features/cards/`: `api.ts` (extended), `cards-page.tsx`, `card-tile.tsx`, `card-page.tsx`, `card-figures.tsx`, `statements-chart.tsx`, `statements-tab.tsx`, `plans-tab.tsx`, `plastic-cards-tab.tsx`, `card-settings-tab.tsx`, `billing-rule-form.tsx`, `statement-page.tsx`, `statement-lines.tsx`, `pay-dialog.tsx`, `finance-dialog.tsx`, `reconcile-dialog.tsx`, `facts-dialog.tsx`, `refund-dialog.tsx`, `dispute-dialog.tsx`, `plan-drawer.tsx`, `installment-purchase-dialog.tsx`, `card-plans.ts` (+test), `card-figures-math.ts` (+test), page tests `cards-page.test.tsx`, `card-page.test.tsx`, `statement-page.test.tsx`. `card-overview-page.tsx` is replaced by `card-page.tsx`.

Shared: `web/src/ui/period-control.tsx` and `web/src/ui/period-presets.ts` (moved from `transactions`), `web/src/testing/account-api.ts`, `web/src/app/router.tsx`, `web/src/app/shell/command-menu.tsx`, `web/src/features/transactions/account-sheet.tsx`, both catalogues.

---

## Tasks

Each task: write the failing tests first and run them (`pnpm vitest run <files>` from `web/`), read the failure, implement, run the tests, `pnpm typecheck`, `pnpm lint`, then `make check-commit` from the root, then commit one vertical slice. Screen tasks end with `review-screen` over the changed screen.

### Task 1: Account foundations

**Files:** `features/accounts/api.ts`, `account-kinds.ts` (+test), `src/testing/account-api.ts`, `src/ui/period-control.tsx`, `src/ui/period-presets.ts` (+test moved), `features/transactions/*` imports updated.

**Interfaces — Produces:**
- `account-kinds.ts`: `type Kind = NonNullable<Account["kind"]>`; `classOf(kind: Kind): "asset" | "liability"`; `kindGroups: readonly { key: "accounts" | "cards" | "reserves" | "debts"; kinds: readonly Kind[] }[]`; `kindLabel: Record<Kind, MessageKey>`; `kindHint: Record<Kind, MessageKey>`; `compatibleKinds(subtype: string): readonly Kind[]` (A35: CHECKING_ACCOUNT → checking; SAVINGS_ACCOUNT → savings, reserve; CREDIT_CARD → credit_card; RESERVED_BALANCE → reserve); `yieldCapable(kind: Kind): boolean` (savings, reserve).
- `api.ts` queries: `accountQuery(api, id)`, `institutionsQuery(api)`, `reconciliationQuery(api, id)`, `assertionsQuery(api, id)` (infinite), `unconfirmedQuery(api, id)`, `projectionQuery(api, id, to)`, `positionsQuery(api, date)`, `csvProfileQuery(api, id)` (404 → `null`), `importBatchesQuery(api, accountId)` (pages until 50 matches), `importBatchQuery(api, id)`, `batchRecordsQuery(api, id, state?)` (infinite), `accountTransactionsQuery(api, id, from, to)` (infinite).
- `api.ts` mutations: `useReopenAccount`, `useSetParent`, `useSetAppearance`, `useCreateInstitution`, `useSetInstitutionISPB`, `useCreateAssertion`, `useResolveAssertion`, `useUnlockAccount`, `useSaveCsvProfile`, `useImportFile` (multipart `FormData` with `format`, `file`), `useResolveRecord`, `useMapExternalAccount`, `useSyncConnection`, `useCreateOpeningBalance`.
- `account-api.ts`: ids `checkingID`, `reserveID`, `cardID`, `brokerageID`, `parentID`; `accountFixtures`; `money(amount, currency = "BRL")`; `accountRoutes(overrides?)` covering every GET the account screens read with fixed answers.

- [ ] Tests: `account-kinds.test.ts` table: every kind has a class, a group and a label; `compatibleKinds("SAVINGS_ACCOUNT")` equals `["savings", "reserve"]`; unknown subtype returns `[]`. `api.test.ts`: `csvProfileQuery` resolves `null` on a 404 problem; `useImportFile` sends `multipart/form-data` with fields `format=csv` and `file`; `importBatchesQuery` reads a second page when the first holds fewer than 50 of the account's batches and a `next_cursor`.
- [ ] Move `PeriodControl` and presets to `src/ui/`; transactions tests stay green unchanged.
- [ ] Commit `feat(web): add the account kinds and the account and import requests`

### Task 2: Institutions and the institution field

**Files:** `institution-catalogue.ts` (+test), `institution-field.tsx` (+test), `institutions-page.tsx` (+test), `router.tsx` (route), catalogues.

**Interfaces — Produces:** `catalogueEntries(index: LogoIndex): { ispb: string; code: string | undefined; name: string }[]` sorted by name with the pt-BR collator; `InstitutionField({ value, onChange, name }: { value: string | null; onChange: (id: string | null) => void; name: string })`.

- [ ] Tests: catalogue entries skip owner institutions with the same ISPB; choosing a catalogue entry sends `POST /institutions` with `{name, code, ispb}` and the field shows the created institution; "Criar "Banco X"" sends `{name: "Banco X"}`; page lists logo, name, ISPB and account count 2 for an institution of two accounts; Set logo sends `PUT /institutions/{id}/ispb {ispb: "00000000"}`; Remove logo sends `{ispb: null}`.
- [ ] Commit `feat(web): manage institutions with the bank logo catalogue`

### Task 3: Account form

**Files:** `account-form-page.tsx`, `account-form.tsx`, `kind-chooser.tsx`, `card-setup-section.tsx`, `account-draft.ts` (+test), `billing-preview.ts` (+test), `create-account-steps.ts` (+test), `account-form-page.test.tsx`, `router.tsx` (`/accounts/new`, `/accounts/$id/edit`), `features/transactions/account-sheet.tsx` (foot link).

**Interfaces — Produces:** `billingPreview(rule: BillingCycleRule, purchase: string): { reference: string; closing: string; due: string }`; `createAccountSteps(draft: AccountDraft, ids: { openingBalances: string }): Step[]` where `type Step = { key: "account" | "rule" | "limit" | "card" | "opening"; run: (api: Client<paths>, accountId: string) => Promise<void> }`; `AccountDraft` (all fields of section 4).

- [ ] Tests: `billingPreview` table: rule `day` 5 / due 12, purchase 2026-10-04 → reference 2026-10, closing 2026-10-05, due 2026-10-12; purchase 2026-10-05 with `closing_day_assignment: "next"` → reference 2026-11; `before_due` 7 days with due 10, purchase 2026-10-01 → reference 2026-10, closing 2026-10-03, due 2026-10-10; closing day 25 / due 5, purchase 2026-10-20 → reference 2026-11, closing 2026-10-25. Steps: a checking draft with opening 1 240,55 yields `account`, `opening`, and the opening body has postings `[{account_id: new, amount: 124055}, {account_id: openingBalancesID, amount: -124055}]`; a card draft yields `account`, `rule`, `limit`, `card` ×2, `opening`. Page: kind tiles grouped in four headings; `?kind=credit_card` opens on the card section; the yield switch exists only for savings and reserve; a 422 with `errors: [{field: "name"}]` stands under Name and in the summary; a failed `rule` step lands on `/accounts/{id}` with the retry message naming "Ciclo da fatura"; edit sends only the moved field (`PATCH {name}`); parent change sends `PUT /parent` and an A73 problem stands under Parent; draft survives leaving and reopening.
- [ ] Commit `feat(web): create and edit accounts and cards with their setup`

### Task 4: Balance sheet

**Files:** `accounts-page.tsx`, `accounts-search.ts` (+test), `balance-sheet-figures.tsx`, `balance-group-table.tsx`, `account-row-status.tsx`, `accounts-page.test.tsx`.

**Interfaces — Consumes:** `groupBalances`, `buildAccountTree`, `reconciliationQuery`, `seriesQuery`, `connectionsQuery`. **Produces:** `validateAccountsSearch(raw): { date?: string; basis?: Basis; closed?: true }`.

- [ ] Tests: figures Ativos, Passivos, Patrimônio líquido equal the fixture sums and the comparison line uses the second `/balances` call at `date − 30`; a USD account is excluded from the group total and "1 conta em outra moeda" stands under it; sub-account rows nest under the parent; card row links to `/cards/{cardID}`; `?basis=settled` sends `basis=settled`; closed accounts appear only with the switch; pending-links message shows "2 contas externas aguardam vínculo"; empty state; phone (390 px) renders lists, not tables.
- [ ] Commit `feat(web): read the accounts as a balance sheet`

### Task 5: Account record shell

**Files:** `account-page.tsx`, `account-header.tsx`, `account-figures.tsx`, `balance-chart.tsx`, `account-search.ts` (+test), `close-account-dialog.tsx`, `account-page.test.tsx`, `router.tsx`.

**Interfaces — Produces:** `validateAccountSearch(raw): { tab: AccountTab; range: 30 | 90 | 365; from?: string; to?: string; assert?: true }`; `type AccountTab = "activity" | "reconciliation" | "imports" | "scheduled" | "positions" | "sync"`.

- [ ] Tests: header name, kind tag and "Reconciliada em 30/09/2026"; card account redirects to `/cards/{id}`; 404 → not-found result-state with the back control; transport error → Try again re-requests; figures read balance, projection closing at today + 30 and goal progress; chart requests `/reports/balances` with `from = today − 90`; Positions tab only for brokerage, Sync tab only for a linked account; close dialog sends `{closed_on}` and states `account_not_empty` with the balance; reopen confirm lists ancestors.
- [ ] Commit `feat(web): show an account with its figures and balance chart`

### Task 6: Account ledger

**Files:** `account-ledger.tsx`, `running-balance.ts` (+test), `account-page.test.tsx`.

**Interfaces — Produces:** `runningBalances(rows: { id: string; amount: number }[], closing: number): Map<string, number>` (rows newest first; the balance after each row).

- [ ] Tests: `runningBalances([{a,-50},{b,+100}], 1000)` → `a: 1000, b: 1050`; ledger sends `account_id`, `from`, `to`; the amount column sums only this account's postings of a split transaction; reconciled posting shows the lock mark with its label; parent account draws no balance column; day header carries the day's net change; row opens `/transactions/{id}`.
- [ ] Commit `feat(web): read an account's movements with the balance after each`

### Task 7: Reconciliation

**Files:** `reconciliation-tab.tsx`, `assertion-form.tsx`, `assertion-result.ts` (+test), `unlock-dialog.tsx`, `account-page.test.tsx`.

**Interfaces — Produces:** `assertionOutcome(result: AssertionResult): { kind: "reconciled" | "yield" | "open"; difference: Money; transactionId?: string }`.

- [ ] Tests: form sends `{date, amount: {amount: 1008341, currency: "BRL"}, source: "manual"}`; a `yield` result states "Rendimento de R$ 83,41 registrado" with a link to the transaction (S24); an open difference of −10,00 shows both resolutions; Adjustment sends `{resolution: "adjustment"}` (S26); `difference_remains` re-reads the status and states the remaining amount; history pages by cursor; unconfirmed table lists entries oldest first; unlock sends `{from}`; `?assert=1` opens the form focused; parent accounts show no form.
- [ ] Commit `feat(web): reconcile an account against the institution's balance`

### Task 8: Account tabs: imports, scheduled, positions, sync

**Files:** `imports-tab.tsx`, `scheduled-tab.tsx`, `positions-tab.tsx`, `sync-tab.tsx`, `account-page.test.tsx`.

- [ ] Tests: imports tab lists only this account's batches with counts badges and leads to the batch page; scheduled tab rows from projection points with the balance after, range control sends `to`; positions filter the brokerage children, unrealized result toned, "sem cotação" without `market_value`; sync tab shows provider status in words, Sync now sends `POST /connections/{id}/sync` and states the batch counts; Stop syncing sends `{ignored: true}` after confirm.
- [ ] Commit `feat(web): show an account's imports, schedules, positions and sync`

### Task 9: File import

**Files:** `import-page.tsx`, `csv-profile-section.tsx`, `csv-preview.ts` (+test), `import-page.test.tsx`, `router.tsx`.

**Interfaces — Produces:** `previewCsv(text: string, profile: CsvProfile, scale: number, limit = 10): { headers: string[]; rows: { date?: string; description?: string; amount?: number; problems: ("date" | "amount")[] }[] }`.

- [ ] Tests: `previewCsv` with `;`, header 1, `DD/MM/YYYY`, `,` decimal reads `"1.234,56"` as `123456`; debit/credit columns give a negative debit; `inverted` flips the sign; an unreadable date marks `date`. Page: a CSV without a saved profile shows the profile section and disables Import until the required fields hold values (Review Focus 4: no `POST imports` is sent); a changed profile sends `PUT csv-profile` before `POST imports`; a file over 10 MiB is refused before any request; success navigates to `/accounts/{id}/imports/{batchId}`; `request_too_large` from the server stands under the upload.
- [ ] Commit `feat(web): import OFX and CSV statements with a live CSV preview`

### Task 10: Import batch and review workspace

**Files:** `batch-page.tsx`, `review-workspace.tsx`, `candidate-score.tsx`, `batch-page.test.tsx`, `router.tsx`.

- [ ] Tests: figures equal the batch counts; balance outcome sentence for `recorded` and `skipped`; state pill sends `state=needs_review`; selecting a record sets `?record=` and lists candidates best first with criteria in words; Match sends `{action: "match", transaction_id}` and selects the next record; Create and Discard bodies; `record_resolved` re-reads and states it; 390 px shows only the queue and a record opens its own region.
- [ ] Commit `feat(web): review imported lines against their candidate transactions`

### Task 11: Account links

**Files:** `links-page.tsx`, `link-drawer.tsx`, `link-candidates.ts` (+test), `links-page.test.tsx`, `router.tsx`.

**Interfaces — Produces:** `linkCandidates(external: ExternalAccount, accounts: Account[], fed: Set<string>): Account[]`.

- [ ] Tests: candidates are leaf, same currency, compatible kind, not fed; a RESERVED_BALANCE with no reserve account yields `[]` and the drawer offers only Create account with `kind=reserve` (Review Focus 5); link sends `{account_id, sync_from}`; Ignore sends `{ignored: true}`; `provider_unauthorized` stated on its connection; returning from create with `?account=` preselects it.
- [ ] Commit `feat(web): link external accounts to ledger accounts`

### Task 12: Card list

**Files:** `cards-page.tsx`, `card-tile.tsx`, `card-figures-math.ts` (+test), `cards-page.test.tsx`, `cards/api.ts`.

**Interfaces — Produces:** `cardTotals(cards: { account: Account; current?: Statement; unpaid: Statement[] }[]): { open: Money; due: Money; nearestDue?: string; available: Money; limit: Money }`.

- [ ] Tests: totals over two cards; tile shows current amount, status tag, closing and due dates and the limit share in words; a closed unpaid statement shows "Vence 25/10/2026" and Pay; New card leads to `/accounts/new?kind=credit_card`; closed cards behind the switch; empty state.
- [ ] Commit `feat(web): list the cards with their statements and limits`

### Task 13: Card record

**Files:** `card-page.tsx`, `card-figures.tsx`, `statements-chart.tsx`, `statements-tab.tsx`, `plastic-cards-tab.tsx`, `card-settings-tab.tsx`, `billing-rule-form.tsx`, `installment-purchase-dialog.tsx`, `card-page.test.tsx`, `router.tsx` (replace `cards/$accountId` search), `cards/index.ts`.

- [ ] Tests: figures (current, next to pay, available, committed over 12 `commitments` calls); statements tab rows lead to the statement page and "Carregar anteriores" moves `from` by 12 months; add card sends `{holder, last_four, virtual}`; active switch sends `PATCH /cards/{id} {active: false}`; new billing rule version body; new limit body; placement check states the answer and the no-rule problem in words (Review Focus 3); a card without a rule shows the message and opens Configuração; installment purchase body with `installment_count` and `splits`.
- [ ] Commit `feat(web): show a card with its statements, cards and billing setup`

### Task 14: Statement record

**Files:** `statement-page.tsx`, `statement-lines.tsx`, `pay-dialog.tsx`, `finance-dialog.tsx`, `reconcile-dialog.tsx`, `facts-dialog.tsx`, `statement-page.test.tsx`, `router.tsx`.

- [ ] Tests: figures and breakdown sentence match the summary fields; institution comparison line; lines grouped by day with "2/10"; steppers lead to neighbours; actions per status (open: Pay, Facts; closed: Pay, Finance, Reconcile, Facts; financed: none); pay body `{date, from_account_id, amount}` with the Em aberto preset; finance body and live interest; `statement_not_closed` stated; reconcile equal amount → reconciled tag; `difference_remains` offers Facts; facts body and the A86 sentence; Remove facts sends `DELETE`.
- [ ] Commit `feat(web): read a statement and pay, finance and reconcile it`

### Task 15: Line actions and installment plans

**Files:** `refund-dialog.tsx`, `dispute-dialog.tsx`, `plan-drawer.tsx`, `plans-tab.tsx`, `card-plans.ts` (+test), `statement-page.test.tsx`, `card-page.test.tsx`.

**Interfaces — Produces:** `planIDs(statements: StatementDetail[]): string[]` (unique, first appearance order).

- [ ] Tests: refund body; dispute open body and the "Em contestação" tag; resolve won body with statement; `dispute_open` stated; plan drawer schedule with reversed tags; cancel body `{date, credit_statement}`; anticipation body and the discount line; plans tab lists plans from open and upcoming statements once each.
- [ ] Commit `feat(web): refund, dispute and manage installment plans`

### Task 16: Palette and review pass

**Files:** `app/shell/command-menu.tsx`, tests of the shell.

- [ ] Tests: palette lists New account, Institutions, Account links, Import statement and each account and card by name; Import statement asks for an account and leads to its import page.
- [ ] Run `review-screen` over every screen of tasks 2–15; fix each finding; run `make check`; report Slotted findings.
- [ ] Commit `feat(web): reach accounts and cards from the command palette`, then `fix(web): ...` per finding group when any.
