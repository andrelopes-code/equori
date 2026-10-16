# P5 Classification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver roadmap phase P5: categorization rules, payee aliases, payee history, rule suggestions and categorization method statistics (SC5), with a Ledger `Categorize` command that changes only the category side of a transaction.

**Architecture:** New module `classification` (ADR 002, chapter 4, 4.3.2) owning `classification_*` tables. A pure decision function (`domain.Decide`) applies aliases, rules and payee history to a subject. Imports are decided synchronously before the Ledger records them (A19); every other uncategorized transaction is decided by the outbox reaction F5. The categorization record of each transaction is derived only from Ledger events, ordered by transaction version (A20).

**Tech Stack:** As P4. New dependency: none (text folding and RE2 use the standard library).

**Spec:** `docs/domain/` chapters 1 (G7, SC5), 2 (2.8), 3 (F5), 4 (4.3.2), 5 (5.4), 7 (7.3), 8 (N07); ADR 002, ADR 006, ADR 007; this plan's "Spec amendments" and "Scenarios".

## Spec amendments (approved with this plan)

| ID | Amendment | Reason |
|---|---|---|
| A17 | A category posting is a posting on an `income` or `expense` account. A transaction's category state is `none` (no category posting), `uncategorized` (every category posting is on `uncategorized_expense` or `uncategorized_income`) or `categorized` (otherwise). Automatic classification acts only on `uncategorized` transactions. | Makes "a manual categorization is never overwritten by a rule" (F5) a structural property instead of a check. |
| A18 | Ledger command `Categorize` (expected version; category parts; optional payee; tags to add). It replaces only the category postings, keeps their total, sets the payee, adds tags and creates a version with reason `categorized`. It is allowed when the balance-sheet postings are reconciled. It rejects a transaction without category postings (422 `not_categorizable`) and a voided one. It publishes `ledger.transaction_categorized.v1`. The owner calls it through `POST /transactions/{id}/categorize`. | I05 forbids correcting a transaction with a reconciled posting, so an imported and reconciled transaction could never be categorized; category postings are never reconciled. |
| A19 | An import decides each created line before the Ledger records it: the transaction is created with its payee, tags and category postings, at version 1. | N07 includes categorization in 5 s; a categorization per transaction after the import costs one commit per line (P4 measured 36 s for three commits per line). |
| A20 | `classification_categorization` holds one row per transaction with category postings, `method` NULL while uncategorized. Rows are written only by the Classification outbox handlers from Ledger events, which carry the transaction version, the category state and the cause of a categorization; a row changes only for a higher version. Method `source` is produced from P6. Transactions of origin `system` get no row. | Events arrive at least once and in any order across event types (ADR 006); the version makes the result independent of both. |
| A21 | Rule semantics: the fields, operators and value types of the "Rule conditions" table; text operators compare normalized text (A26); `regex` applies RE2 to the original text. Matching rules run by ascending priority: the first rule that sets a category or split decides the category, the first that sets a payee decides the payee, tags accumulate; a matching rule with `stop_processing` ends evaluation. A rule action that cannot apply on the subject (category closed on the date, currency different from the transaction's, fixed split amounts above the total) skips that rule. | Chapter 5 lists fields, operators and actions without types or the result of several matching rules. |
| A22 | Payee aliases apply to the raw description when the transaction has no payee, before rules. Order: `equals`, then `starts_with`, then `contains`, then `regex`; within a type the longer pattern first, then the older alias. | Several aliases can match one description. |
| A23 | Payee history: when no rule decides the category and the transaction has a payee, the category of the most recent non-voided transaction of that payee whose category postings are exactly one `categorized` posting of the same class applies (method `history`). | F5 names payee history without the selection rule. |
| A24 | Suggestions: the match key of a transaction is its payee, or its normalized raw description without a payee. A manual correction (A18 command, or a correction that changes the category postings) to one category creates a `pending` suggestion when another transaction with the same match key was corrected to the same category. One suggestion per fingerprint (match key and category) ever exists, so a dismissed suggestion is not proposed again. Accepting creates the rule at the last priority with the name given. | F5 says "the same manual correction twice for similar transactions" without defining similarity. |
| A25 | The actions "mark as transfer to account" and "mark reimbursable to counterparty", and the pairing of imported card payments with the checking debit (A14), move to a new phase P5b "Transfers from imports". | Both replace a category posting with a balance-sheet posting: on a card this changes the posting role and the statement billing; pairing two imported transactions moves the external record link from the transaction to the posting (I07). |
| A26 | Normalized text: Unicode lowercase, Latin letters U+00C0–U+017F without diacritics (`São` → `sao`, `Ç` → `c`), inner whitespace collapsed, trimmed. The raw description of a transaction is the description of its version 1. | Brazilian bank files mix `SAO JOAO` and `São João`; the owner may edit the description after import. |

## Rule conditions (A21)

| Field | Operators | Value |
|---|---|---|
| `description`, `raw_description` | `equals`, `contains`, `starts_with`, `regex`, `in_list` | string (≤ 200), RE2 pattern (≤ 200), list of strings (≤ 100) |
| `payee` | `equals`, `in_list` | payee id, list of payee ids |
| `amount`, `absolute_amount` | `equals`, `greater_than`, `less_than`, `between` | `Money`, two `Money` (min ≤ max); holds only in the same currency |
| `account` | `equals`, `in_list` | account id(s) of a balance-sheet posting of the transaction |
| `account_kind` | `equals`, `in_list` | account kind(s) (`checking`, `credit_card`, …) |
| `source` | `equals`, `in_list` | transaction origin(s): `manual`, `import`, `schedule` |
| `weekday` | `equals`, `in_list` | `monday` … `sunday` of the transaction date |
| `day_of_month` | `equals`, `greater_than`, `less_than`, `between`, `in_list` | 1–31 |
| `installment` | `equals` | boolean: a posting carries an installment reference |

`amount` is the negated sum of the category postings: an expense of 45.90 has amount −45.90, as on the bank statement. A rule has 1–20 conditions, all of which must hold, and 1–10 actions.

**Actions:** `set_category` (`category_id`: an `income` or `expense` account), `set_payee` (`payee_id`), `add_tags` (`tags`: 1–10 names matching `^[a-z0-9][a-z0-9-]{0,59}$`), `split` (`parts`: 2–10, each with `category_id` and exactly one of `percent` in basis points 1–9999, `amount` as `Money`, or `remainder: true`; exactly one remainder part). A rule has at most one of `set_category` and `split`. A split computes each `percent` part rounded half away from zero to the minor unit, then fixed parts; the remainder part receives the rest, so parts always sum to the total.

## Scenarios (added to chapter 6 as section 6.13 "Classification")

Data: the S32 accounts and categories Transport › Ride-hailing, Transport › Fuel, Travel, Food › Delivery, Food › Groceries, Food › Bakery, Cleaning, Salary.

| ID | Scenario |
|---|---|
| S37 | Rule "description contains `uber`" → Transport › Ride-hailing. An OFX line −23.90 "UBER *TRIP" creates a transaction at version 1 with a Ride-hailing posting of +23.90; its categorization is method `rule` with that rule. |
| S38 | Alias `starts_with` "ifd*" → payee iFood; a manual transaction of 2026-10-01 with payee iFood is categorized as Food › Delivery. An OFX line −45.00 "IFD*IFOOD SAO PAULO" creates a transaction with payee iFood and category Food › Delivery, method `history`. |
| S39 | Rule 1 "description contains `posto`" → Transport › Fuel; rule 2 "description contains `shell`" → Travel and tag `car`. "POSTO SHELL" −150.00 gets Fuel and tag `car`, method `rule` with rule 1. After rule 1 gets `stop_processing`, a second line "POSTO SHELL" gets Fuel without the tag. |
| S40 | Rule "payee equals Pão de Açúcar" → split Food › Groceries 80 % and Cleaning remainder. A −99.99 line gets Groceries +79.99 and Cleaning +20.00. |
| S41 | An S37 transaction is categorized by the owner as Travel (method `manual`). A line "UBER *EATS" −31.00 imported before the S37 rule existed is uncategorized; `POST /rules/run` categorizes it as Ride-hailing and leaves the Travel transaction unchanged. |
| S42 | Two imported lines "PADARIA SÃO JOÃO" without payee, categorized by the owner as Food › Bakery, produce one `pending` suggestion (`raw_description equals "padaria sao joao"` → Bakery). Accepting it creates a rule at the last priority; an imported line "PADARIA SAO JOAO" is categorized by that rule. |
| S43 | After S32 reconciles Nubank checking, the owner categorizes the +3,000.00 transaction as Salary: 200, the checking posting stays `reconciled`, the account stays reconciled. |
| S44 | October 2026 holds the S41 Travel transaction (manual), the S41 "UBER *EATS" transaction (rule), the S38 seed (manual) and import (history) and one uncategorized line. `GET /categorization-statistics?from=2026-10-01&to=2026-10-31` returns total 5, rule 1, history 1, manual 2, source 0, uncategorized 1. |

## Global Constraints

- All earlier constraints apply (ADR 007: contract validation, `Money`, pagination of growing lists, 201 with `Location` where a GET exists, verbs return 200).
- A classification outbox handler calls the Ledger before it writes any row that references `ledger_transaction`: the foreign key check takes a `KEY SHARE` lock that blocks the Ledger's `SELECT … FOR UPDATE` in another connection, and the handler would wait on itself.
- The P4 deduplication normalization stays unchanged; A26 normalization lives in `classification/internal/domain`.
- `decided_at` comes from the event's `occurred_at`, never from the wall clock.
- Logs never contain descriptions or rule values (N16).

## Review Focus

1. A handler that wrote its row before calling `ledger.Categorize` blocks forever; the F5 test runs `Dispatch` under a 10 s context deadline (Task 5).
2. Events of one transaction delivered out of order or twice (categorized v2 before recorded v1; recorded v1 again after v2) leave the row at version 2 with its method (Task 5).
3. A rule whose category was closed after the rule was created, or whose regex matches nothing, never fails an import: the rule is skipped and the line is still recorded (Task 6).
4. A transaction categorized manually, or split by the owner with one uncategorized part, is never changed by `POST /rules/run` or by a later event (Task 5).
5. `percent` splits of amounts that do not divide evenly (−0.01, −99.99, −100.00 at 33.33 %) sum exactly to the total, with no zero-amount posting (a zero part is dropped) (Task 3).

---

## Slice A (Tasks 1–3)

### Task 1: Ledger `Categorize` command and event payload

**Files:** `internal/ledger/internal/domain/transaction.go` (`CategoryState`, `Categorize`), `internal/ledger/internal/domain/categorize_test.go`, `internal/ledger/internal/app/categorize.go`, `internal/ledger/internal/app/service.go` (event payload), `internal/ledger/internal/adapter/postgres/repository.go` (`ReplaceCategoryPostings`), `db/queries/ledger/transaction.sql`, `internal/ledger/internal/adapter/httpapi/transactions.go`, `api/openapi.yaml` (`categorizeTransaction`, code `not_categorizable`), `internal/ledger/ledger.go`, `internal/reporting/reporting.go` (subscribes to the new event), `internal/ledger/categorize_test.go`.

**Domain:**

```go
type CategoryState string // "none", "uncategorized", "categorized" (A17)
func (t Transaction) CategoryState(accounts map[uuid.UUID]Account) CategoryState

type CategoryPart struct { AccountID uuid.UUID; Amount money.Money } // signed like the posting it becomes
type Categorization struct {
	ExpectedVersion int
	Parts           []CategoryPart // nil: category postings unchanged
	PayeeID         *uuid.UUID     // nil: payee unchanged
	AddTags         []string
}
var ErrNotCategorizable = errors.New("transaction has no category postings")
// Categorize returns the next version; balance-sheet postings keep their ids and status.
func (t Transaction) Categorize(c Categorization, accounts map[uuid.UUID]Account) (Transaction, error)
```

Rules: voided → `ErrVoided`; version mismatch → `ErrVersionConflict`; no category posting → `ErrNotCategorizable`; each part account exists, is `income` or `expense`, open on the transaction date (I09), in the instrument of the replaced postings (`parts[i].account_id`); amounts non-zero; part sum equals the replaced sum (`parts`); new postings `cleared`; tags union, sorted.

**Public API (`ledger.Module`):**

```go
const EventTransactionCategorized = "ledger.transaction_categorized.v1"
type Cause struct { Method string `json:"method"`; RuleID uuid.UUID `json:"rule_id,omitzero"` }
type Categorization struct { TransactionID uuid.UUID; ExpectedVersion int; Parts []CategoryPart; PayeeID *uuid.UUID; AddTags []string; Cause Cause }
// Categorize applies each item in one database transaction, locking transactions in id order.
// errs[i] is the item's domain error (ErrVersionConflict, ErrNotCategorizable, ErrVoided, validation); err aborts all.
func (m *Module) Categorize(ctx context.Context, userID int64, cs []Categorization) (errs []error, err error)
```

**Event payload** (`TransactionEvent`, every transaction event, additive to v1): `version int`, `origin string`, `category_state string`, `categories_changed bool` (corrected only: the multiset of category `(account, amount)` differs), `cause *Cause` (categorized; recorded from an import with a decision, Task 2).

**HTTP:** `POST /transactions/{id}/categorize`, body `{expected_version, parts: [{account_id, amount: Money}] (1–50), payee_id?}` → 200 `Transaction`; cause `manual`. Errors: 404 `not_found`, 409 `version_conflict`, 409 `transaction_voided`, 422 `not_categorizable`, 422 `validation_failed` on `parts`, `parts[i].account_id`.

**Tests:** domain table: each rule above, a card purchase keeps its card posting, role and statement, split into two parts; `CategoryState` for transfer, uncategorized, mixed (`categorized`); API: S43, each problem code, a version-history entry with reason `categorized`, reporting balance of the old and new category accounts after `Dispatch`; outbox payload of recorded, corrected (with and without category change) and categorized events read from `outbox_event`.

Commit `feat(ledger): categorize the category side of a transaction`.

### Task 2: Ledger reads and categorized imports

**Files:** `internal/ledger/internal/app/classification.go` and test, `db/queries/ledger/classification.sql`, `internal/ledger/ledger.go`, `internal/ledger/internal/app/imports.go`, `internal/ledger/internal/adapter/httpapi/transactions.go`, `api/openapi.yaml` (`uncategorized` query parameter), `internal/ledger/classification_test.go`.

**Public API:**

```go
type FactPosting struct { AccountID uuid.UUID; Class, Kind, SystemRole string; Amount money.Money; Installment bool }
type TransactionFacts struct {
	ID uuid.UUID; Version int; Date time.Time; Description, RawDescription string // RawDescription: version 1 (A26)
	PayeeID uuid.UUID; Origin string; Voided bool; CategoryState string; Postings []FactPosting
}
func (m *Module) TransactionFacts(ctx context.Context, userID int64, ids []uuid.UUID) ([]TransactionFacts, error) // order of ids; missing ids omitted

type AccountFact struct { ID uuid.UUID; Class, Kind, SystemRole string; Instrument money.Currency; OpenedOn time.Time; ClosedOn *time.Time }
func (m *Module) AccountFacts(ctx context.Context, userID int64) ([]AccountFact, error)
func (m *Module) MissingPayees(ctx context.Context, userID int64, ids []uuid.UUID) ([]uuid.UUID, error)

type PayeeClass struct { PayeeID uuid.UUID; Class string }
// LatestPayeeCategories implements A23 in one query (DISTINCT ON over ledger_transaction_payee_idx).
func (m *Module) LatestPayeeCategories(ctx context.Context, userID int64, payees []uuid.UUID) (map[PayeeClass]uuid.UUID, error)
```

`ImportedRecord` gains `Decision *ImportDecision` (`PayeeID uuid.UUID`, `AddTags []string`, `Parts []CategoryPart`, `Cause Cause`): with parts, the other side is the parts instead of the uncategorized account; the recorded event carries the cause. `GET /transactions?uncategorized=true` lists transactions in state `uncategorized`.

**Tests:** facts of a card installment purchase (kinds, roles, `Installment`), of a corrected transaction (`RawDescription` from version 1), of another user's id (omitted); `LatestPayeeCategories` skips voided, split and uncategorized transactions and picks the latest by date then id; `RecordImportedBatch` with a decision creates the parts at version 1 and a recorded event with the cause; the `uncategorized` filter excludes transfers and categorized transactions.

Commit `feat(ledger): expose classification facts and categorized imports`.

### Task 3: Classification domain

**Files:** `internal/classification/internal/domain/{text.go,rule.go,alias.go,split.go,decide.go,suggestion.go,errors.go}` with tests.

```go
func Normalize(s string) string // A26
type Field string; type Operator string
type Condition struct { Field Field; Operator Operator; Text []string; Money []money.Money; IDs []uuid.UUID; Ints []int; Bool bool; re *regexp.Regexp }
type Part struct { CategoryID uuid.UUID; Percent int; Amount *money.Money; Remainder bool }
type Action struct { Type string; CategoryID, PayeeID uuid.UUID; Tags []string; Parts []Part }
type Rule struct { ID uuid.UUID; Name string; Priority int; Enabled, StopProcessing bool; Conditions []Condition; Actions []Action }
func NewRule(r Rule) (Rule, error) // validates shapes of the tables above; FieldError paths "conditions[0].value", "actions[1].parts"
type Alias struct { ID uuid.UUID; Pattern string; MatchType string; PayeeID uuid.UUID; re *regexp.Regexp }
func NewAlias(a Alias) (Alias, error)
func ResolvePayee(raw string, aliases []Alias) (uuid.UUID, bool) // A22
type Allocation struct { CategoryID uuid.UUID; Amount money.Money }
func Allocate(total money.Money, parts []Part, category map[uuid.UUID]Category, date time.Time) ([]Allocation, bool) // false: rule skipped (A21)

type Subject struct { Date time.Time; Description, RawDescription string; PayeeID uuid.UUID; Amount money.Money; Accounts []uuid.UUID; AccountKinds []string; Source string; Installment bool; Class string }
type Category struct { Class string; Instrument money.Currency; OpenedOn time.Time; ClosedOn *time.Time }
type HistoryKey struct { PayeeID uuid.UUID; Class string }
type Catalog struct { Rules []Rule; Aliases []Alias; Categories map[uuid.UUID]Category; History map[HistoryKey]uuid.UUID }
type Decision struct { PayeeID uuid.UUID; AddTags []string; Parts []Allocation; Method string; RuleID uuid.UUID }
func Decide(s Subject, c Catalog) Decision // aliases (when PayeeID is zero), rules (A21), history (A23)
func MatchKey(payee uuid.UUID, raw string) string // A24
```

**Tests (table-driven):** `Normalize` on accented, mixed-case and whitespace input; every field × operator holding and not holding, including currency mismatch and `between` bounds; regex on original text; invalid shapes return their field path; alias order of A22; `Decide` merge of A21 (first category wins, tags accumulate, stop), skip on closed category, history only with payee and same class; `Allocate` property test over random totals and parts (sum equals total, no zero part) and Review Focus 5 cases; `MatchKey` with and without payee.

Commit `feat(classification): decide categories from rules, aliases and history`.

**Slice A ends: checkpoint.**

---

## Slice B (Tasks 4–6)

### Task 4: Classification module, rules and aliases

**Files:** `db/migrations/00011_classification.sql`, `db/queries/classification/{rule.sql,alias.sql}`, `sqlc.yaml`, `internal/classification/classification.go`, `internal/classification/internal/{app,adapter/postgres,adapter/httpapi}`, `api/openapi.yaml` (tag `classification`), `internal/server/server.go`, `internal/classification/{schema_test.go,rules_test.go,aliases_test.go}`.

**Tables:**
- `classification_rule (id, user_id, name 1–120, priority > 0, enabled, stop_processing, conditions jsonb, actions jsonb, schema_version = 1, created_at, updated_at)`; `UNIQUE (user_id, priority) DEFERRABLE INITIALLY IMMEDIATE`.
- `classification_payee_alias (id, user_id, pattern 1–200, match_type IN (equals, contains, starts_with, regex), payee_id, created_at)`; FK `(user_id, payee_id)` → `ledger_payee` `ON DELETE CASCADE`; `UNIQUE (user_id, match_type, pattern)`.
- `classification_suggestion (id, user_id, fingerprint, conditions jsonb, actions jsonb, example_transaction_ids uuid[] (2–10), state IN (pending, accepted, dismissed), rule_id, created_at, decided_at)`; `UNIQUE (user_id, fingerprint)`; FK `(user_id, rule_id)` → rule `ON DELETE SET NULL (rule_id)`; `CHECK (rule_id IS NULL OR state = 'accepted')`.
- `classification_categorization (transaction_id PK, user_id, transaction_version, transaction_date, method NULL IN (rule, source, history, manual), rule_id, corrected bool, match_key, category_id, voided bool, decided_at)`; FK `(user_id, transaction_id)` → `ledger_transaction` `ON DELETE CASCADE`; FK rule `ON DELETE SET NULL (rule_id)`; `CHECK (rule_id IS NULL OR method = 'rule')`; index `(user_id, transaction_date) WHERE NOT voided`; index `(user_id, match_key, category_id) WHERE corrected AND NOT voided`.

**HTTP:** `GET /rules` (by priority, paginated), `POST /rules` (appended at the last priority) → 201 + `Location`, `GET|PUT|DELETE /rules/{id}`, `POST /rules/reorder` (`{rule_ids}`: an exact permutation, else 422 on `rule_ids`) → 200 list; `GET /payee-aliases` (paginated), `POST` → 201 + `Location`, `GET|PUT|DELETE /payee-aliases/{id}`. Rule and alias references are checked through `AccountFacts` and `MissingPayees` (422 on the field path). Conditions and actions in the contract: `field`, `operator`, `type` enums and `additionalProperties: false`; value combinations are domain rules (422).

**Module:** `classification.New(pool, dispatcher, ledger, log)`; composed in `server.New` after the Ledger.

**Tests:** schema test per constraint above with direct SQL; rule CRUD with exact bodies; reorder swaps priorities and rejects a missing or repeated id; each field-path error (invalid regex, `between` with min > max, split without remainder, category of class `asset`, unknown payee); alias CRUD and duplicate pattern; another user's rule or alias is 404.

Commit `feat(classification): manage rules and payee aliases`.

### Task 5: Categorization records and automatic classification (F5)

**Files:** `internal/classification/internal/app/{events.go,classify.go,stats.go}` and tests, `db/queries/classification/categorization.sql`, `internal/classification/classification.go` (subscriptions, consumer `classification`), `api/openapi.yaml`, `internal/classification/{categorization_test.go,run_test.go,stats_test.go}`.

**Event handling (A20), one function for the four Ledger event types:**
1. Origin `system` → nothing.
2. Voided → set `voided` on the row (insert when absent).
3. State `none` → delete the row when its version is lower.
4. Method: `uncategorized` → NULL; with a cause → the cause; corrected without category change → the row's method (no row yet: return an error, so the delivery retries after the recorded event); otherwise `manual`.
5. Recorded, state `uncategorized`, origin not `import` → `Decide` and `ledger.Categorize` with the event version, before any write (Global Constraints).
6. Upsert with `WHERE classification_categorization.transaction_version < EXCLUDED.transaction_version`; `corrected` is true for a cause `manual` from the A18 command and for a corrected event that changed the category postings; `match_key` and `category_id` come from `TransactionFacts` for corrected rows.
7. A corrected row triggers suggestion detection (Task 7 adds it; this task leaves the hook).

**HTTP:** `GET /transactions/{id}/categorization` → `{transaction_id, method (nullable), rule_id, decided_at}` (404 without row); `POST /rules/run` → 200 `{examined, categorized}`: rows with NULL method, in pages of 500, `TransactionFacts`, `Decide`, `Categorize` with each fact's version (conflicts counted as not categorized); `GET /categorization-statistics?from&to` (both required) → `{from, to, total, rule, source, history, manual, uncategorized}` (SC5).

**Tests:** manual transaction recorded uncategorized and decided by a rule (method `rule`, version 2) under `Dispatch` with a 10 s deadline (Review Focus 1); out-of-order and repeated events through the app service with `pgtest` (Review Focus 2); owner categorization → `manual`, `corrected`; correction of the description only keeps the method; voided transaction leaves statistics; S41; S44; Review Focus 4.

Commit `feat(classification): record categorization methods and classify new transactions`.

### Task 6: Classified imports

**Files:** `internal/classification/classification.go` (`DecideImport`), `internal/ingestion/ingestion.go` (`ledgerPort` decides before `RecordImportedBatch`), `internal/server/server.go`, `internal/apitest/ofx.go` (the OFX builder of `internal/ingestion/import_test.go` moves here as `apitest.OFX` and `h.Import`), `internal/ingestion/import_bench_test.go`, `internal/classification/import_test.go`.

```go
type ImportLine struct { AccountID uuid.UUID; Date time.Time; Amount money.Money; Description string }
// DecideImport loads rules, aliases and account facts once, then payee history for the resolved payees.
func (m *Module) DecideImport(ctx context.Context, userID int64, lines []ImportLine) ([]*ledger.ImportDecision, error) // nil entry: no payee, tags or category
```

A record resolved as `create` in the review queue goes through the same port.

**Tests:** S37, S38, S39, S40, S42's third line (after Task 7), Review Focus 3; N07 benchmark with 100 rules (10 regex) and 50 aliases stays below 5 s.

Commit `feat(ingestion): classify imported lines before recording them`.

**Slice B ends: checkpoint.**

---

## Slice C (Tasks 7–8)

### Task 7: Rule suggestions

**Files:** `internal/classification/internal/app/suggestions.go` and test, `db/queries/classification/suggestion.sql`, `api/openapi.yaml` (code `suggestion_closed`), `internal/classification/suggestions_test.go`.

**Detection (A24):** a corrected row with a single `category_id` counts the corrected, non-voided rows with the same `match_key` and `category_id`; at two or more, it inserts a `pending` suggestion `ON CONFLICT (user_id, fingerprint) DO NOTHING` with conditions `payee equals` or `raw_description equals`, action `set_category`, and up to 10 example transaction ids.

**HTTP:** `GET /rule-suggestions?state=` (paginated), `POST /rule-suggestions/{id}/accept` (`{name}`) → 200 suggestion with `rule_id`, `POST /rule-suggestions/{id}/dismiss` → 200; accept or dismiss of a non-pending suggestion → 409 `suggestion_closed`.

**Tests:** S42; one correction creates nothing; a split correction creates nothing; a third correction keeps one suggestion with three examples; a dismissed fingerprint is not proposed again; `suggestion_closed`.

Commit `feat(classification): suggest rules from repeated corrections`.

### Task 8: Documentation and closing

- Chapter 3 F5 table, chapter 4 (4.3.1 `Categorize` endpoint, 4.3.2 calls), chapter 5 (5.4 with the condition table and merge rule), chapter 6 (6.13 S37–S44, coverage line), chapter 7 (7.3 columns of this plan), chapter 9 (P5 scenarios S37–S44; new row P5b "Transfers from imports": transfer and reimbursable actions, card payment pairing, posting-level external record links; depends on P5).
- README: classification endpoints in the API summary.
- `make check`, self-review against Review Focus, merge `--ff-only` into `main`, push, CI green, checkpoint, domain book republished.

Commit `docs: describe classification`.

**Exit criterion: S37–S44 pass through the API; SC5 is answered by `GET /categorization-statistics`; N07 stays below 5 s with rules and aliases.**
