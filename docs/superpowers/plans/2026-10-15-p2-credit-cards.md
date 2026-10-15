# P2 Credit Cards Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver roadmap phase P2: the Brazilian banking calendar, card profiles (billing cycle rules, credit limits, cards), statements with derived amounts and status, card posting roles, installment plans, statement payments, financing, revolving credit, refunds, cancellations, anticipations, disputes and cashback, with scenarios S05–S15, the card part of S23 and the billing assertions of S19.

**Architecture:** Extends the `ledger` and `marketdata` modules of P1 (ADR 002). Billing rules are pure functions in `ledger/internal/domain` (no I/O); the application layer resolves statements inside the transaction that records the postings (I03). Statement amounts and status are always derived from postings (DM6). The calendar lives in `marketdata` and is consumed by the ledger through its module API.

**Tech Stack:** As P1. New dependency: none.

**Spec:** `docs/domain/` chapters 3 (F2, F3), 5 (5.2.4, 5.2.5), 6 (S05–S15, S19, S23), 7 (7.2, 7.6); this plan's section "Spec amendments", which the user approves with the plan.

## Spec amendments (approved with this plan)

| ID | Amendment | Reason |
|---|---|---|
| A1 | A statement's reference month is the month of its due date. The closing date falls in the reference month when `closing_day < due_day`, otherwise in the previous month. | Brazilian issuers name a statement by its due month ("fatura de novembro"); cards closing on day 28 and due on day 5 close in the previous month. |
| A2 | Only the due date is shifted by the business-day calendar; the closing date is never shifted. | Issuers close on calendar days, weekends included; payment deadlines follow banking days (Resolução CMN 4.880/2020). |
| A3 | I05 becomes: `reconciled` postings are never edited or deleted. A statement's closing date no longer freezes its postings; postings may be added to past statements (history back-fill, late issuer charges). A statement becomes immutable when it is reconciled (P3). | The closing-date rule blocked recording past purchases, opening balances (S23) and imports of history. Reconciliation is the event that confirms data against the institution. |
| A4 | Calendar `br_banking` = Saturdays, Sundays, 1 Jan, Carnival Monday and Tuesday (Easter − 48, − 47), Good Friday (Easter − 2), 21 Apr, 1 May, Corpus Christi (Easter + 60), 7 Sep, 12 Oct, 2 Nov, 15 Nov, 20 Nov (from 2024, Lei 14.759/2023), 25 Dec, plus instance-defined holidays. 2026 has 13 such holidays on weekdays and weekends. | Resolução CMN 4.880/2020 art. 6 as reproduced by FEBRABAN and secondary sources; official text not retrieved. |
| A5 | A statement payment without an explicit statement pays the oldest statement with an unpaid amount whose closing date has passed; if none, the open statement. | Matches how issuers apply a payment. |
| A6 | A refund of a purchase with several category postings is distributed over them in proportion to their amounts; the rounding remainder goes to the largest. | Same rule as the cash view (S30). |

## Global Constraints

- All P1 global constraints apply (English, Conventional Commits, no AI mentions, `make check`, UUIDv7, composite user keys, integer amounts, ADR 004/005 API rules).
- `ledger.New` gains the calendar and the clock: `ledger.New(pool, dispatcher, cal marketdata.Calendar, clk clock.Clock, log)`; `internal/server` passes `marketdata` and `clock.New(cfg.TimeZone, time.Now)`.
- "Today" for statement status is `clock.Today()` in the instance time zone (ADR 005).
- Every card posting has a statement and a role; no other posting has either (I03, I04).

## Review Focus

1. A purchase dated on the closing day under both assignments, and a purchase on the 31st with a rule closing on day 31 in a 30-day month (Task 3).
2. A billing rule changed while installments of an older purchase remain: billed installments keep their statements; future statements of the plan keep the rule in force for their reference month (Task 3, Task 7).
3. Two refunds of the same purchase recorded concurrently that together exceed the original amount: exactly one succeeds (Task 9).
4. A due date that falls on Carnival Tuesday followed by Ash Wednesday: `following` moves it to Wednesday, not Thursday (Task 1, Task 3).
5. A payment larger than the amount due: statement `paid`; the excess appears as a credit in the next statement's opening amount (Task 6).

---

## File Structure

| Path | Responsibility |
|---|---|
| `db/migrations/00006_calendar.sql` | `marketdata_holiday` (instance-defined holidays) |
| `db/migrations/00007_cards.sql` | Card profile tables, statements, plans, disputes, posting columns, I03/I04/I05 triggers |
| `internal/marketdata/calendar.go` | `Calendar` interface, `br_banking` rules, Easter computus, business-day shifts |
| `internal/ledger/internal/domain/billing.go` | `ReferenceMonth`, `BillingCycleRule`, statement dates, statement assignment, installment offsets |
| `internal/ledger/internal/domain/statement.go` | `StatementSummary`, amount-due chain, status |
| `internal/ledger/internal/domain/installment.go` | Installment split (DM3), plan totals, refund ceiling (I06) |
| `internal/ledger/internal/app/cards.go` | Card profile use cases |
| `internal/ledger/internal/app/billing.go` | Statement resolution inside record/correct, statement queries |
| `internal/ledger/internal/app/card_operations.go` | Installment purchase, payment, financing, refund, cancellation, anticipation, dispute |
| `db/queries/ledger/card.sql` | sqlc queries for the new tables |
| `api/openapi.yaml` | Card endpoints (tag `ledger`), calendar endpoint (tag `marketdata`) |
| `internal/ledger/card_scenarios_test.go` | S05–S15, S19 billing assertions, S23 card part |

---

## Slice A (Tasks 1–3): calendar, schema, billing rules

### Task 1: Banking calendar

**Files:** Create `db/migrations/00006_calendar.sql`, `internal/marketdata/calendar.go`, `internal/marketdata/calendar_test.go`, `db/queries/marketdata/holiday.sql`. Modify `api/openapi.yaml` (tag `marketdata`), `internal/server/server.go`.

**Interfaces (produces):**

```go
type Adjustment string // AdjustNone, AdjustFollowing, AdjustPreceding, AdjustModifiedFollowing
type Calendar interface {
	IsBusinessDay(ctx context.Context, name string, d time.Time) (bool, error)
	Adjust(ctx context.Context, name string, d time.Time, a Adjustment) (time.Time, error)
	Holidays(ctx context.Context, name string, year int) ([]Holiday, error)
}
type Holiday struct { Date time.Time; Name string; Source string } // Source: "rule" or "instance"
const CalendarBRBanking = "br_banking"
func Easter(year int) time.Time // Gregorian computus (Meeus/Jones/Butcher)
```

`*marketdata.Module` implements `Calendar`. Unknown calendar name → `ErrUnknownCalendar`.

- [ ] **Step 1: Migration** `marketdata_holiday (calendar text, date date, name text, PRIMARY KEY (calendar, date))` for instance-defined extra holidays.
- [ ] **Step 2: Failing tests:**

| Test | Expected |
|---|---|
| `TestEaster` | 2024-03-31, 2025-04-20, 2026-04-05, 2027-03-28, 2038-04-25 |
| `TestBRBanking2026` | Holidays: 01-01, 02-16, 02-17, 04-03, 04-21, 05-01, 06-04, 09-07, 10-12, 11-02, 11-15, 11-20, 12-25 (13) |
| `TestConsciousnessDayFrom2024` | 2023-11-20 is a business day (Monday); 2024-11-20 is not |
| `TestAdjust` | 2026-12-05 (Sat) following → 12-07; preceding → 12-04; 2026-02-17 (Carnival Tue) following → 02-18 (Ash Wednesday is a business day); 2026-01-31 (Sat) modified following → 01-30 (next business day is in February) |
| `TestInstanceHoliday` | Inserting 2026-03-19 into `br_banking` makes it a non-business day; `Holidays(2026)` lists it with source `instance` |
| `TestUnknownCalendar` | `ErrUnknownCalendar` |

- [ ] **Step 3: Run** `make test`; expect FAIL (undefined).
- [ ] **Step 4: Implement** the rules of amendment A4; extras read from `marketdata_holiday`. API: `GET /api/v1/calendars/{name}/holidays?year=` → `{"items":[{"date","name","source"}]}`.
- [ ] **Step 5: Run** `make gen && make check`; PASS.
- [ ] **Step 6: Commit** `feat(marketdata): add the Brazilian banking calendar`.

### Task 2: Card schema and database invariants

**Files:** Create `db/migrations/00007_cards.sql`, `internal/ledger/card_schema_test.go`. Modify `docs/domain/03-domain-flows.md`, `05-domain-model.md`, `07-data-model.md` (amendments A1–A3, I05 text).

- [ ] **Step 1: Migration** (summary of objects; exact columns as chapter 7, 7.2, with amendment A3):
  - `ledger_billing_cycle_rule (user_id, account_id, effective_from date CHECK (extract(day FROM effective_from) = 1), closing_day 1–31, due_day 1–31, closing_day_assignment IN ('next','closing') DEFAULT 'next', due_date_adjustment IN ('none','following','preceding','modified_following') DEFAULT 'following', calendar DEFAULT 'br_banking')`, `UNIQUE (account_id, effective_from)`.
  - `ledger_credit_limit (user_id, account_id, effective_from date, amount bigint > 0)`, `UNIQUE (account_id, effective_from)`.
  - `ledger_card (id, user_id, account_id, holder, last_four CHECK ~ '^[0-9]{4}$', virtual bool, active bool)`.
  - `ledger_statement (id, user_id, account_id, reference_month date first day, closing_date, due_date, financed_by_plan_id)`, `UNIQUE (account_id, reference_month)`, `CHECK (due_date > closing_date)`.
  - `ledger_installment_plan (id, user_id, account_id, origin_transaction_id, plan_kind IN ('purchase','financing'), installment_count 2–420, principal bigint > 0, interest bigint >= 0, monthly_rate numeric(30,12), first_statement_id)`.
  - `ledger_posting` gains `statement_id`, `card_role IN ('charge','credit','payment')`, `installment_plan_id`, `installment_number`, `installment_count`, with composite foreign keys and the checks of chapter 7, 7.2.
  - `ledger_dispute (id, user_id, transaction_id, opened_on, resolved_on, outcome IN ('won','lost'), refund_transaction_id)`, one open dispute per transaction (partial unique index `WHERE resolved_on IS NULL`).
  - Trigger I03/I04: `statement_id` and `card_role` set if and only if the account kind is `credit_card`; the statement's `account_id` equals the posting's.
  - Trigger I05 (A3): `UPDATE` or `DELETE` of a posting whose status is `reconciled` raises `check_violation`, except the update of the `voided` copy when the transaction is voided.
  - Index `ledger_posting (statement_id) WHERE NOT voided`, `ledger_posting (installment_plan_id, installment_number)`.
- [ ] **Step 2: Failing database tests:** card posting without statement rejected; non-card posting with statement rejected; posting on another card's statement rejected; reconciled posting update and delete rejected; voiding a transaction with a reconciled posting succeeds; a second open dispute on the same transaction rejected; billing rule with `effective_from` not on day 1 rejected.
- [ ] **Step 3: Run**; FAIL then PASS once the migration exists. Update chapters 3, 5 and 7 with A1–A3 (I05 wording, statement "Closed" rule of 5.2.4).
- [ ] **Step 4: Commit** `feat(ledger): add card schema with statement and reconciliation invariants`.

### Task 3: Billing rules (pure domain)

**Files:** Create `internal/ledger/internal/domain/{billing,statement,installment}.go` and tests.

**Interfaces (produces):**

```go
type ReferenceMonth struct{ Year int; Month time.Month }
func (m ReferenceMonth) Add(n int) ReferenceMonth
func (m ReferenceMonth) FirstDay() time.Time
type BillingCycleRule struct {
	EffectiveFrom ReferenceMonth
	ClosingDay, DueDay int
	Assignment string // "next" | "closing"
	Adjustment string // "none" | "following" | "preceding" | "modified_following"
	Calendar   string
}
type Rules []BillingCycleRule // sorted by EffectiveFrom
func (r Rules) For(m ReferenceMonth) (BillingCycleRule, error) // ErrNoBillingRule
type StatementDates struct{ Reference ReferenceMonth; Closing, DueUnadjusted time.Time }
func DatesFor(m ReferenceMonth, rule BillingCycleRule) StatementDates // A1, day clamped to month length (T02)
func StatementFor(purchase time.Time, rules Rules) (ReferenceMonth, error) // T04 with assignment
func InstallmentStatement(first ReferenceMonth, k int) ReferenceMonth // T07
func SplitInstallments(total money.Money, n int) []money.Money // DM3
type StatementLine struct{ Role string; Amount int64 } // card posting amounts (negative = charge)
type StatementInput struct {
	Reference ReferenceMonth
	Closing, Due time.Time // Due already adjusted by the calendar
	Lines    []StatementLine
	Financed bool
}
type StatementSummary struct {
	Reference ReferenceMonth; Opening, Charges, Credits, AmountDue, Payments, Unpaid int64; Status string
}
func Summarize(statements []StatementInput, today time.Time) []StatementSummary // chain in reference order
```

Due-date adjustment is applied by the application layer through `marketdata.Calendar`; `StatementDates.DueUnadjusted` keeps the domain free of I/O.

- [ ] **Step 1: Failing tests** (table-driven):

| Test | Cases |
|---|---|
| `TestDatesFor` | rule 3/10: 2026-11 → closing 2026-11-03, due 2026-11-10; rule 28/5: 2026-11 → closing 2026-10-28, due 2026-11-05; rule 31/10 for 2026-09 → closing 2026-08-31 (31 ≥ 10, previous month); rule 31/15 for 2026-05 → closing 2026-04-30 (April has 30 days) |
| `TestStatementFor` | rule 3/10 `next`: 2026-10-14 → 2026-11; 2026-11-03 → 2026-12; 2026-11-02 → 2026-11; same with `closing`: 2026-11-03 → 2026-11 |
| `TestStatementForRuleChange` | rules: 3/10 from 2026-01, 15/22 from 2026-12: purchase 2026-11-10 → 2026-12 (closing 2026-12-15 under the new rule, first closing after the date) |
| `TestInstallmentStatement` | first 2026-11, k = 3 → 2027-01; k = 10 → 2027-08 |
| `TestSplitInstallments` | 1,000.00 / 3 → 333.34, 333.33, 333.33; 0.10 / 3 → 0.04, 0.03, 0.03; sum always equals total |
| `TestSummarize` | S10 cases: full payment → paid; early payment 300 + 1,200 → paid; partial 1,000 of 1,500 after due → overdue, next opening 500; overpayment 1,600 of 1,500 → paid, next opening −100 (credit); financed → financed; future statement with no closing yet → open |

- [ ] **Step 2: Run**; FAIL. **Step 3: Implement.** **Step 4:** PASS, `make check`.
- [ ] **Step 5: Commit** `feat(ledger): add billing cycle, statement and installment rules`.

**Slice A ends: checkpoint (no stop if the user keeps the no-stop instruction).**

---

## Slice B (Tasks 4–6): card profile, card postings, statements

### Task 4: Card profile

**Files:** `internal/ledger/internal/app/cards.go`, `db/queries/ledger/card.sql`, repository methods, API, tests in `internal/ledger/card_profile_test.go` (apitest).

**Endpoints:** `GET/POST /accounts/{id}/billing-cycle-rules` (`effective_from` as `YYYY-MM`), `GET/POST /accounts/{id}/credit-limits`, `GET/POST /accounts/{id}/cards`. Only accounts of kind `credit_card` (otherwise 422 `validation_failed`, field `account_id`).

**Tests:** create rule, list returns versions in order; second rule with the same `effective_from` → 422; credit limit versions; available limit = latest limit − |card balance| returned by `GET /accounts/{id}` for card accounts (new optional `card` object: `credit_limit`, `available_limit`); card `last_four` validation.

- [ ] Steps: failing tests → implement → `make gen && make check` → commit `feat(ledger): add card profiles with billing rules, limits and cards`.

### Task 5: Card postings in transactions

**Files:** `internal/ledger/internal/app/billing.go`, domain `transaction.go` (statement and role fields), repository, API (`PostingInput` gains `statement` `YYYY-MM` and `card_role`; `Posting` returns them plus `installment`), tests `internal/ledger/card_postings_test.go`.

**Rules:**
- On record and correct, for each posting on a card account: statement = explicit `statement` or `StatementFor(transaction date)`; the statement row is created on demand (`INSERT ... ON CONFLICT DO NOTHING` then select) with dates from `DatesFor` and the due date adjusted through the calendar.
- Role default: negative → `charge`; positive with any posting on an income or expense account → `credit`; positive otherwise → `payment` (default statement per A5).
- A card account without billing rules → 422 `validation_failed`, field `postings[i].account_id`, message "card has no billing cycle rule".
- I03/I04 in the domain: `statement`/`card_role` on a non-card posting → `FieldError`.
- A3: corrections and voids of transactions with `reconciled` postings stay forbidden (P1 rule); no closing-date check.

**Tests:** S05 (three rows) through the API; explicit statement override; payment default statement (A5); role defaults; card without rule → 422; correcting the date of a card purchase moves its statement.

- [ ] Steps as usual; commit `feat(ledger): bill card postings on statements`.

### Task 6: Statements

**Files:** `internal/ledger/internal/app/statements.go`, queries, API, tests `internal/ledger/statement_test.go`.

**Endpoints:** `GET /accounts/{id}/statements?from=YYYY-MM&to=YYYY-MM` → items with `id, reference, closing_date, due_date, opening, charges, credits, amount_due, payments, unpaid, status`; `GET /statements/{id}` → summary plus postings (transaction id, date, description, role, amount, installment).

**Tests:** S10 full and partial payment through the API, with status at a `today` injected by the clock (`clock.New(loc, fixedNow)` in the harness); overpayment credit (Review Focus 5); statement of a reference month with no postings returns zeros and status by dates.

- [ ] Steps; commit `feat(ledger): expose statements with derived amounts and status`.

**Slice B ends: checkpoint.**

---

## Slice C (Tasks 7–9): installments, payments, refunds

### Task 7: Installment purchases

**Endpoint:** `POST /installment-purchases` `{card_account_id, date, description, payee_id, tags, splits: [{account_id, amount}], installment_count, interest?: Money, first_statement?: YYYY-MM, installment_amounts?: [Money]}` → `201 {transaction, plan}`. `installment_amounts`, when given (import), overrides DM3 and must sum to splits + interest.

**Rules:** expense postings = splits; `interest` → posting on the `interest` system account (DM2); card postings = `SplitInstallments(total, n)` with roles `charge`, statements `first + (k − 1)`, installment numbers; plan row with principal, interest, rate when given.

**Tests:** S06 and S07 exact postings and statements; committed amount query for a future month (`GET /accounts/{id}/commitments?month=`) = unbilled installments of that month (S06: 2026-12 → 333.33); Review Focus 2: plan created, rule changed from 2027-01, installments 3/3 keep the reference month 2027-01 with dates of the new rule.

- [ ] Steps; commit `feat(ledger): add installment purchases`.

### Task 8: Payments, financing and revolving credit

**Endpoints:** `POST /statements/{id}/payments {date, from_account_id, amount}`; `POST /statements/{id}/financing {date, installment_count, installment_amount}`.

**Rules:** payment = transaction from the balance account to the card, role `payment`, billed on the statement. Financing (S11): card `payment` posting of the unpaid amount on the financed statement, `charge` installments on the next statements, interest posting = n × installment − unpaid; statement `financed_by_plan_id` set; plan kind `financing`. Revolving interest is a generic card transaction (role `charge`, `interest` category, origin `system` or `import`); no endpoint.

**Tests:** S10 (four rows), S11 exact postings and `financed` status; financing a statement that is not closed → 409 `statement_not_closed`; financing twice → 409 `statement_financed`.

- [ ] Steps; commit `feat(ledger): add statement payments, financing and revolving charges`.

### Task 9: Refunds, cancellations, anticipations

**Endpoints:** `POST /transactions/{id}/refunds {date, amount, statement?}`; `POST /installment-plans/{id}/cancellation {date, credit_statement?}`; `POST /installment-plans/{id}/anticipation {date, from_installment, to_installment, target_statement, amount}`.

**Rules:** refunds follow A6 and I06 under `SELECT ... FOR UPDATE` on the origin transaction (Review Focus 3); cancellation = S14 (reverses unbilled installments on their original statements, credits billed ones on `credit_statement`, default the next open statement); anticipation = S15 (discount on `discounts` system account; amount must be ≤ the sum of the selected installments). Plan status derived: `active`, `completed`, `cancelled`, `anticipated`.

**Tests:** S08 (three rows), S14, S15 exact postings and statement nets; concurrent refunds (Review Focus 3); anticipation amount above the installments → 422.

- [ ] Steps; commit `feat(ledger): add refunds, installment cancellation and anticipation`.

**Slice C ends: checkpoint.**

---

## Slice D (Tasks 10–11): disputes and acceptance

### Task 10: Disputes and cashback

**Endpoints:** `POST /transactions/{id}/disputes {opened_on}`; `POST /disputes/{id}/resolution {resolved_on, outcome, statement?}`. Cashback is a generic transaction (card posting role `credit`, income category); no endpoint.

**Tests:** S12, S13 (won creates refund linked `chargeback_of`; lost creates nothing); dispute on a non-card transaction → 422; resolving twice → 409.

- [ ] Steps; commit `feat(ledger): add card disputes`.

### Task 11: Acceptance scenarios and documentation

**Files:** `internal/ledger/card_scenarios_test.go`; modify `internal/ledger/scenarios_test.go` (S19 billing assertions: card posting billed on 2026-11 with role `charge`), `docs/domain/06-scenarios.md` (fixture: Itaú Visa rule rows), `docs/domain/09-roadmap.md` (P2 done marker not needed), `README.md` (card API groups).

- [ ] **Step 1:** S05–S15 and the card part of S23 through the API with the chapter 6 fixture, each as `t.Run("Sxx")`.
- [ ] **Step 2:** `make check`; push; CI green.
- [ ] **Step 3: Commit** `test(ledger): add P2 acceptance scenarios` and `docs: document card endpoints`.

**Slice D ends: checkpoint. P2 exit criterion (chapter 9): scenarios pass; I03–I06 enforced in the database where chapter 7.6 places them (I06 in the domain under row lock).**
