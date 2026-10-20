# Card Statements That Match the Institution Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Card statements derive the institution's figures (amount due, dates, status) for every issuer and month, and the sync reports any difference.

**Architecture:** Imported card lines carry their type (payment, refund) and bill; every card posting is billed on the statement of its cycle; the statement amount due is the card balance at closing; statements store the institution's reported dates and total as facts that take precedence over the billing rule and are compared with the derived amount.

**Tech Stack:** Go, PostgreSQL (goose, sqlc), oapi-codegen, `internal/apitest`.

**Spec:** `docs/superpowers/specs/2026-10-20-card-statements-institution-design.md` (A85–A93, S80–S89).

## Global Constraints

- `make check` passes before every commit; one vertical slice per commit; Conventional Commits, scope `ledger`, `ingestion` or `api`; the body names the amendment.
- A behaviour change starts with a failing test, run and read before the implementation.
- An existing test changes only where an amendment changes the specified behaviour; the commit body names the amendment.
- Each scenario S80–S89 has an `internal/apitest` test whose name carries its ID.
- Schema changes are new goose migrations (next: `00028_…`); `*.gen.go` regenerated with `make gen`, never edited.
- Every query on a business table filters by `user_id`.
- Amounts are integers in minor units; no `float64`.

## Review Focus

- A payment line re-imported after this change, whose transaction a rule or the owner already categorized: the sync keeps the transaction and reports `unapplied_change` (Task 1).
- A card statement with no postings between two that have postings: its amount due equals its opening (the balance carries) (Task 2).
- A statement with an amount due ≤ 0 (credit balance): status `paid`, unpaid 0, the next opening negative (Task 2).
- A bill whose `billClosingDate` is absent (Open Finance Direct connection): the statement keeps the rule's closing date and only the due date and total are facts (Task 5).
- A reconciled posting on a statement that facts re-date: it keeps its statement and the batch reports it (Task 5).

---

### Task 1: Card line roles from the source (A88; S83, S46)

**Files:**
- Create: `db/migrations/00028_ledger_transfers_in_transit.sql`
- Modify: `internal/ledger/internal/domain/account.go` (role `RoleTransfersInTransit`, class asset, name "Transfers in transit")
- Modify: `internal/ledger/internal/domain/transfer.go` (postings on the transit account are replaced like category postings)
- Modify: `internal/ledger/internal/app/imports.go` (`ImportedPosting.Kind`; payment counterpart; `UpdateImportedPosting` applies a kind change)
- Create: `internal/ledger/internal/domain/card_payment.go` (`Transaction.AsCardPayment`)
- Modify: `db/queries/ledger/transfer.sql` (`PairingCandidates` accepts the transit account as the replaceable side)
- Modify: `internal/ingestion/internal/domain/record.go` (`NormalizedRecord.Kind`), `internal/ingestion/internal/pluggy/normalize.go`, `internal/ingestion/internal/app/importer.go` (`Line.Kind`, change detection), ingestion record storage (column `line_kind`), module adapter in `internal/ingestion/ingestion.go` or `internal/server` where `Line` maps to `ledger.ImportedPosting`
- Test: `internal/ingestion/sync_scenarios_test.go` (or the file holding S53/S54), `internal/ledger/internal/domain/card_payment_test.go`, `internal/ledger/schema_test.go` (system role check)

**Interfaces:**
- Produces: `domain.LineKind` in ingestion (`""`, `"payment"`, `"refund"`); `ledger.ImportedPosting.Kind string`; `domain.RoleTransfersInTransit SystemRole = "transfers_in_transit"`; `func (t Transaction) AsCardPayment(expectedVersion int, transit Account, accounts map[uuid.UUID]Account) (Transaction, error)` returning `ErrReconciled` for a reconciled card posting and `ErrNotCategorizable` when the counterpart is not an uncategorized system account.

- [ ] **Step 1: Write the failing tests**
  - `TestS83PaymentLineFromAggregator`: fake Pluggy card line `{"amount": -961.85, "operationType": "PAGAMENTO_FATURA", "creditCardMetadata": {"billId": B}}` with bill B due 2026-10-05; after sync the transaction has the card posting `+96185` role `payment`, the other posting on the account with `system_role` `transfers_in_transit`; `GET` month flows for 2026-09 has no income of 96185.
  - Same test, second sync of a record stored before the change (role `credit`, counterpart `uncategorized_income`): the transaction gets version 2 with role `payment` and the transit counterpart.
  - Same test, a line with `operationType` `ESTORNO` +72.90 stays `credit`.
  - `TestS46CardFileFirst` changes: a card line typed as payment is `payment` against `transfers_in_transit`; the checking line then pairs (one transaction, card `payment`, checking −1,500.00).
  - Schema test: a second `transfers_in_transit` account for one user is rejected.
- [ ] **Step 2: Run them and read the failures** — `go test ./internal/ingestion/... ./internal/ledger/... -run 'S83|S46|TransfersInTransit'` → FAIL (role `credit`, no such system role).
- [ ] **Step 3: Implement**
  - Migration: extend the `system_role` check with `transfers_in_transit`; insert one account per existing user (`account_class` asset, instrument = user's base currency, opened on the earliest date the service uses); add `line_kind text` to `ingestion_external_record`.
  - Pluggy: `Transaction.OperationType` exists; `Normalize` sets `Kind` = `payment` for `PAGAMENTO_FATURA`, `refund` for `ESTORNO`, on card accounts only.
  - Ledger import: for a card line with `Kind == "payment"` and no transfer decision, the counterpart is the transit account and the card posting role `payment`; `Kind == "refund"` keeps `credit`.
  - Update path: `ImportedUpdate` gains `Kind`; a stored record whose `line_kind` differs from the new kind calls the ledger, which applies `AsCardPayment` (new version, outbox event as for a correction); `ErrReconciled` and `ErrNotCategorizable` become `unapplied_change` notes.
  - `Transfer` and `PairingCandidates` treat a transit-account posting as the replaceable side.
- [ ] **Step 4: Run** the tests of Step 1 → PASS; then `make check`.
- [ ] **Step 5: Commit** `feat(ingestion): record card payments from the line type` (body: A88, S83, S46 amended).

### Task 2: Statement figures and status (A89; S84, S85)

**Files:**
- Modify: `internal/ledger/internal/domain/statement.go` (`StatementLine.Date`; `Summarize` rewritten), `internal/ledger/internal/domain/statement_test.go`
- Modify: `internal/ledger/internal/adapter/postgres/repository.go` (`Statements` reads line dates), `db/queries/ledger/statement.sql` (`ListStatementLines` returns `date`)
- Modify: `internal/ledger/internal/app/billing.go` (`statementOf`: drop the A5 branch; a payment without explicit statement is billed by date)
- Modify: `internal/ledger/internal/app/card_operations.go` (`PayStatement` and `FinanceStatement` bill the payment by date; financing reads `Unpaid`)
- Modify: `api/openapi.yaml` (`StatementSummary`: add `settled`, `early_payments`, `billed_amount`, `prior_credits`; describe `payments` as payments billed in the cycle and `unpaid` as amount due − settled), `internal/ledger/internal/adapter/httpapi/statements.go`
- Test: `internal/ledger/statement_test.go`, `internal/ledger/card_scenarios_test.go`

**Interfaces:**
- Consumes: Task 1's roles.
- Produces: `domain.StatementSummary{Reference; Opening, Charges, Credits, PriorCredits, Payments, EarlyPayments, AmountDue, BilledAmount, Settled, Unpaid int64; Status string}`; `domain.StatementLine{Role string; Amount int64; Date time.Time}`.

- [ ] **Step 1: Write the failing tests**
  - Domain table test `TestSummarizeBalanceAtClosing` with the evidence lines: 2026-09 (opening 773.54 from a prior statement, charges 1,120.89, credits 86.14, payments 773.54) and 2026-10 (charges 2,281.32, credits 72.90 on 08-31 and 496.67 on 09-18, payments 961.85 on 09-05 and 1,000.00 on 09-14) and 2026-11 (payment 784.65 on 10-05); today 2026-10-20. Expect 2026-09 amount due 103475, settled 103475, unpaid 0, `paid`; 2026-10 opening 103475, amount due 78465, prior credits 7290, early payments 100000, billed amount 178465, settled 78465, `paid`.
  - `TestS84RefundBeforePayment`: the same lines through the API (manual records with explicit statements), same figures in `GET /accounts/{id}/statements`.
  - `TestS85EarlyAndPartialPayments`: S85's two cases (S10 restated).
  - Amended: `TestStatementFullPayment` (2026-11 `payments` 0, unpaid 0, `paid`; 2026-12 `payments` 150000), `TestStatementPartialPaymentCarries` (2026-12 opening 150000, amount due 56250), `TestStatementOverpaymentBecomesCredit` (2026-11 unpaid 0; 2026-12 opening 150000, amount due −9000, early payments 10000).
  - Review Focus: empty middle statement carries its opening; amount due ≤ 0 is `paid` with unpaid 0.
- [ ] **Step 2: Run** `go test ./internal/ledger/... -run 'Summarize|S84|S85|Statement'` → FAIL.
- [ ] **Step 3: Implement `func Summarize(in []StatementInput, today time.Time) []StatementSummary`**: opening = previous amount due; amount due = opening + charges − credits − payments; settlement walks the next statement's credits and payments in date order (dated ≤ today), counting toward this statement until its amount due is covered, the rest of that next statement's payments are its early payments and the rest of its credits its own credits; `PriorCredits` = the next statement's credits used for settlement, reported on the next statement; billed amount = amount due + early payments. Status per A89; `financed` first.
- [ ] **Step 4: Run** → PASS; `make gen`; `make check`.
- [ ] **Step 5: Commit** `feat(ledger)!: derive card statements from the balance at closing` with `BREAKING CHANGE: payments are billed on the statement of their cycle; unpaid never negative` (body: A89, S10 restated as S85).

### Task 3: Installment lines set their installment (A90; S86, S87)

**Files:**
- Modify: `internal/ledger/internal/app/installment_import.go` (`LinkInstallment` sets amount and statement; `RecordImportedInstallment` uses the reported total), the installment plan domain (`internal/ledger/internal/domain/installment.go`) for re-splitting and moving projections
- Modify: `internal/ingestion/internal/pluggy/normalize.go` (`Installment.Total` from `creditCardMetadata.totalAmount`), `internal/ingestion/internal/domain/record.go`, `internal/ingestion/internal/app/installments.go`
- Modify: `internal/ledger/internal/app/billing.go` or the summary input (an unconfirmed installment on a statement with aggregator facts moves to the first statement without them — implemented in Task 5 once facts exist; this task moves projections relative to the latest confirmed installment)
- Test: the ingestion sync test file holding S54

**Interfaces:**
- Consumes: none new.
- Produces: `ingestion domain.Installment.Total *int64`; `ledger.ImportedInstallment.Total *money.Money`; `LinkInstallment(ctx, userID, recordID, planID uuid.UUID, number int, amount money.Money, due *time.Time) (uuid.UUID, error)` — no `ErrAmountMismatch` for an unconfirmed, unreconciled installment.

- [ ] **Step 1: Write the failing tests**
  - `TestS86InstallmentRemainder`: sync Cea 2/3 59.99 (bill 2026-10) first, then 1/3 60.01 (bill 2026-09) and 3/3 59.99 (pending, forecast 2026-11): plan installments 6001, 5999, 5999 on 2026-09, 2026-10, 2026-11; purchase category posting 17999; no record `needs_review`.
  - `TestS87UnbilledInstallment` (projection part): plan from 1/2 86.14 (bill 2026-09); a later 2/2 line `PENDING` with no bill confirms installment 2 as `pending`.
- [ ] **Step 2: Run** → FAIL (`needs_review`, amount 5999 on installment 1).
- [ ] **Step 3: Implement**: linking sets the installment posting's amount, re-bills it on the line's bill statement, and writes a new version of the purchase whose category split totals the plan; later unconfirmed installments move to the confirmed one's statement + j.
- [ ] **Step 4: Run** → PASS; `make check`.
- [ ] **Step 5: Commit** `feat(ledger): let imported installment lines set amount and statement` (body: A90, 5.2.5).

### Task 4: Provisional lines (A91; S88)

**Files:**
- Modify: `internal/ingestion/internal/app/importer.go` (supersede pending lines before matching), `internal/ingestion/internal/domain/dedup.go` or a new `internal/ingestion/internal/domain/provisional.go`
- Test: ingestion sync tests

**Interfaces:**
- Produces: `func Superseded(lines []NormalizedRecord) map[int]int` (pending index → posted index) in ingestion domain.

- [ ] **Step 1: Write the failing test** `TestS88PendingPaymentSuperseded`: one sync returns `PENDING` −784.65 (no bill, 12:20) and `POSTED` −784.65 (bill, 03:00) of 2026-10-05: one transaction on the card; the pending record `withdrawn`; a pending charge 50.00 and a posted charge 50.00 five days apart both stay.
- [ ] **Step 2: Run** → FAIL (two transactions).
- [ ] **Step 3: Implement** pairing within one sync: same account, sign, amount, |days| ≤ 3, pending without bill, posted with bill, one-to-one in date order; an already-created pending record is released and its transaction confirmed by the posted record (S55 path); a new pending record is stored `withdrawn` without a transaction.
- [ ] **Step 4: Run** → PASS; `make check`.
- [ ] **Step 5: Commit** `feat(ingestion): supersede pending card lines by their posted line` (body: A91).

### Task 5: Statement facts, dates and check (A85, A86, A92; S80, S82)

**Files:**
- Create: `db/migrations/00029_ledger_statement_fact.sql` (`ledger_statement_fact`: `user_id`, `statement_id`, `source` in (`aggregator`,`owner`), `closing_date` null, `due_date`, `total` bigint, `minimum` bigint null, `reported_at`; unique (statement_id, source))
- Create: `db/queries/ledger/statement_fact.sql`, `internal/ledger/internal/app/statement_facts.go`, `internal/ledger/internal/domain/statement_fact.go`
- Modify: `internal/ledger/internal/domain/billing.go` (`StatementFor` against stored statements), `internal/ledger/internal/app/billing.go` (resolution and re-dating), `internal/ledger/internal/app/statements.go` (facts and differences in views), `internal/ledger/internal/app/reconciliation.go` (auto-reconcile)
- Modify: `internal/ingestion/internal/pluggy/model.go` (`Bill.MinimumPaymentAmount`), `internal/ingestion/internal/app/sync.go` (hand facts to the ledger), `internal/ingestion/internal/app/importer.go` (`Ledger.RecordStatementFacts`), the module adapter
- Modify: `api/openapi.yaml` (`StatementSummary.institution`: `closing_date`, `due_date`, `total`, `minimum`, `source`; `differences`: `amount_due`, `closing_days`, `due_days`; `POST /statements/{id}/facts` for owner facts, `DELETE` to remove them)
- Test: ledger API tests, ingestion sync tests

**Interfaces:**
- Produces: `ledger.StatementFacts{Source string; Closing *time.Time; Due time.Time; Total money.Money; Minimum *money.Money}`; `func (s *Service) RecordStatementFacts(ctx, userID int64, cardID uuid.UUID, f StatementFacts) error`; `domain.Rules.ClosingFor(...)` used by Task 6.

- [ ] **Step 1: Write the failing tests**
  - `TestS80StatementFactsFromBill`: sync with bill due 2026-09-08, closing 2026-08-29, total 1,034.75 and the evidence lines of 2026-09: statement 2026-09 closes 2026-08-29 (the `preceding` shift arrives in Task 6), due 2026-09-08, `institution.total` 103475, `differences.amount_due` 0, `reconciled` true.
  - `TestS82ManualPurchaseAfterRedating`: owner facts for 2026-10 closing 2026-09-28: manual purchase 2026-09-27 → 2026-10, 2026-09-28 → 2026-11.
  - Review Focus: bill without `billClosingDate` keeps the rule's closing; a reconciled posting keeps its statement after re-dating and the batch notes it.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement**: facts upsert per source; effective dates = owner > aggregator > rule; re-dating resolves again the postings without bill or explicit statement (new column `ledger_posting.billed_by` in (`bill`,`explicit`,`date`) set at write, or equivalent, decided here); `StatementFor` uses stored closing dates before projecting; an unconfirmed installment on a statement with aggregator facts moves to the first statement without them (A90's last paragraph); statement views carry facts and differences; the sync reconciles closed statements with zero differences (A7).
- [ ] **Step 4: Run** → PASS; `make gen`; `make check`.
- [ ] **Step 5: Commit** `feat(ledger): record institution statement facts and check them` (body: A85, A86, A92).

### Task 6: Closing relative to the due date (A87; S81)

**Files:**
- Create: `db/migrations/00030_ledger_billing_closing_mode.sql` (`closing_mode` default `day`, `closing_days_before_due` null, `closing_adjustment` default `none`; check constraints)
- Modify: `internal/ledger/internal/domain/billing.go` (`BillingCycleRule` fields; `DatesFor` returns the projected closing for `before_due`; closing adjustment applied in `ensureStatement` and to reported closings), `internal/ledger/internal/domain/billing_test.go`
- Modify: `api/openapi.yaml` (`BillingCycleRule`), `internal/ledger/internal/adapter/httpapi/cards.go`, postgres mapping
- Test: `internal/ledger/card_scenarios_test.go` (`S81`)

**Interfaces:**
- Consumes: Task 5's fact precedence.
- Produces: `BillingCycleRule.ClosingMode string`, `ClosingDaysBeforeDue int`, `ClosingAdjustment string`.

- [ ] **Step 1: Write the failing tests** `TestDatesForBeforeDue` (domain, nominal dates) and `TestS81ClosingBeforeDue` (API: closings 2026-07-29, 2026-08-28, 2026-09-28, 2026-10-29; dues 2026-08-05, 2026-09-08, 2026-10-05, 2026-11-05; purchase 2026-08-28 on 2026-10); S80 extended: with the rule `preceding`, statement 2026-09 closes 2026-08-28.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement** per A87; validation: `before_due` requires 1–28 days; `day` requires `closing_day`.
- [ ] **Step 4: Run** → PASS; `make gen`; `make check`.
- [ ] **Step 5: Commit** `feat(ledger): close card statements a number of days before the due date` (body: A87).

### Task 7: Card sync start and opening (A93; S89)

**Files:**
- Modify: `internal/ingestion/internal/app/sync.go` (card window starts after the effective closing of the last bill before `sync_from`; opening balance from that bill), the ledger port and `internal/ledger/internal/app` opening balance for a card billed on an explicit statement
- Test: ingestion sync tests

**Interfaces:**
- Consumes: `RecordStatementFacts` (Task 5).
- Produces: `Ledger.RecordCardOpening(ctx, userID int64, cardID uuid.UUID, due time.Time, total money.Money) (created bool, err error)` — no-op when the account has an opening balance transaction.

- [ ] **Step 1: Write the failing test** `TestS89CardSyncStart`: mapping from 2026-07-01, bills 2026-07 (closing 2026-06-28, total 701.48) and 2026-08 (closing 2026-07-29, total 773.54), a line on 2026-06-30 of 26.90: the line is imported; an opening balance of 70148 billed on 2026-07; statement 2026-08 difference 0 when its lines sum to 773.54; a second sync creates no second opening.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement** per A93.
- [ ] **Step 4: Run** → PASS; `make check`.
- [ ] **Step 5: Commit** `feat(ingestion): start a card sync at its cycle and open it from the bill` (body: A93).

### Task 8: Documentation and the owner's data

**Files:**
- Modify: `docs/domain/05-domain-model.md` (5.2.4, 5.2.5, 5.5 per A85–A93), `docs/domain/06-scenarios.md` (S10, S46 amended; S80–S89 added), `docs/domain/07-data-model.md` (new columns and table)
- Modify: `web/src/features/admin/statement-headline.tsx`, `statement-breakdown.tsx` (billed amount, early payments, prior credits, institution total and difference), admin tests

- [ ] **Step 1:** Update the domain documents; commit `docs: record amendments A85 to A93`.
- [ ] **Step 2:** Admin headline: test that the cards tab shows "Institution total" and "Difference" for a statement with facts and the breakdown lines of A89; implement; `make web-check`; commit `feat(web): show institution facts on the admin statement`.
- [ ] **Step 3:** Owner's data (dev database, user 3): set the Nubank Gold rule to due 5 `following`, `before_due` 7 `preceding`; void the opening balance 453.53 ("Opening balance Nubank Gold"); set the mapping's `sync_from` so the sync covers from 2026-06-29; run a sync; list every statement with facts and its `differences`.
- [ ] **Step 4:** Every difference is 0, or each non-zero one is diagnosed (phase 1 of systematic debugging) and becomes a new task before the work is reported done.
