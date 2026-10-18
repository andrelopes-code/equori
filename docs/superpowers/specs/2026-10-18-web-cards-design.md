# Web track, sub-project 2: Cards

- Date: 2026-10-18
- Branch: `feat/web-ledger`
- Depends on: `docs/superpowers/specs/2026-10-17-web-foundation-ledger-design.md` (stack K1–K7, rules O1–O8, theme, navigation, data, error and i18n policy). This spec states only what differs from it or adds to it.
- Domain: `docs/domain/02-ubiquitous-language.md` 2.5, `03-domain-flows.md` F2 and F3, scenarios S05–S15 of `06-scenarios.md`, P2 amendments A1–A6 (`docs/superpowers/plans/2026-10-15-p2-credit-cards.md`).

## Intent

A card account (liability account of kind `credit_card`) gains its own screens: statements with their lines and payments, installment purchases and their schedule, refunds, disputes, installment cancellation and anticipation, statement financing, credit limit, billing cycle rules and cards. Every operation exists in the HTTP API (ledger tag); this sub-project adds the client and four read endpoints (B1–B4).

## Scope

In scope: scenarios S05–S15; billing cycle rules, credit limits and cards management; the card panel on the transaction detail.

Out of scope:

| Item | Owner |
|---|---|
| Statement reconciliation (`POST /statements/{id}/reconcile`); the `reconciled` flag shows as a tag only | sub-project 3 |
| Card statement files and aggregator card lines (S36, S46, S53, S54) | sub-project 3 |
| Committed amounts (`GET /accounts/{id}/commitments`, `GET /commitments`), projection | sub-project 4 |
| Accrual and cash views (S30) | sub-project 5 |
| Foreign purchases on a card (S16) | sub-project 5 |
| Custom per-installment amounts (`installment_amounts`) | not exposed |
| Editing or deleting billing rule and credit limit versions | no endpoint; versions are append-only |

## Decisions

| ID | Decision |
|---|---|
| C1 | New feature `web/src/features/cards/` with `index.ts`, `api.ts`, one component per file. It imports `features/transactions` and `features/accounts` only through their `index.ts` (O2). Neither of them imports `features/cards`. |
| C2 | Card screens live under `/cards/$accountId`. `/accounts/$id` redirects in `beforeLoad` to `/cards/$id` when the account in `accountsQuery` has kind `credit_card`. Home and the accounts tree keep linking to `/accounts/$id`. |
| C3 | No new navigation destination. The bottom bar keeps its five controls (SC-05); side navigation is unchanged. Entry points: the Home "cards" group and the accounts tree. |
| C4 | The transaction detail integrates card operations by composition in `app/router.tsx`: `TransactionPage` accepts an optional `extension` component receiving the loaded `Transaction`; the router passes `CardTransactionPanel` from `features/cards`. This avoids an import cycle between `transactions` and `cards`. |
| C5 | Card query keys nest under `accountKeys.detail(accountId)` and `transactionKeys.all` (section Data). The existing `transactionMutated` therefore invalidates card data without change. |
| C6 | The overview loads statements with `from` = current month − 12 and no `to`, reading every page (`limit` 200), because `listStatements` orders by reference month ascending. "Earlier statements" moves `from` back 12 months. |
| C7 | Current statement: the earliest statement with status `open`. Later statements form the "Upcoming" group; earlier ones form "Past", newest first. Upcoming statements show future installments; no committed-amount figure is shown. |
| C8 | Signs: `StatementSummary` amounts (`opening`, `charges`, `credits`, `amount_due`, `payments`, `unpaid`) are non-negative magnitudes and display as returned. A statement line displays the negated card posting `amount`: a charge shows positive in the neutral tone; a credit or payment shows negative in the positive tone. |
| C9 | Status tag tones: `open` neutral, `closed` info, `partially_paid` warning, `overdue` danger, `paid` success, `financed` neutral. |
| C10 | Statement payment is a routed form. Defaults: amount = `unpaid`, date = today, source = last used account. The source picker lists open asset accounts of kinds `checking`, `savings`, `cash`, `wallet`. The result is a transfer transaction; the success toast links to it. |
| C11 | Statement financing is a routed form with installment count and installment amount. Interest preview = count × installment amount − `unpaid`, computed on integers (O7); a negative preview disables submit. The action shows for status `closed`, `partially_paid` or `overdue` with `unpaid` > 0. |
| C12 | Installment purchase is a routed form: date, description, payee, tags, category lines (reusing `SplitEditor`, `AmountField` and `EntityField` exported by `features/transactions/index.ts`), installment count (2–420), optional installment amount, optional first statement. With an installment amount, `interest` = count × installment amount − purchase total (integer arithmetic; must be ≥ 0); without one, no interest is sent. Save navigates to `/transactions/$id` of the created transaction. |
| C13 | The schedule shows on the transaction detail through `CardTransactionPanel`, from `GET /installment-plans/{plan_id}` (B2); `plan_id` comes from `postings[].installment`. |
| C14 | Operations with at most three inputs are dialogs: refund, open dispute, resolve dispute, cancel installments. Anticipation is a routed form. |
| C15 | Reference-month inputs are selects, never free text. Statement overrides (`statement`, `credit_statement`, `first_statement`, `target_statement`) list the card's statements from the overview query; `target_statement` lists only `open` ones. `effective_from` of a billing rule lists current month − 12 to + 24. |
| C16 | `/cards/$accountId/settings` groups billing rules, credit limits and cards. Each version list shows newest first; the version in force is tagged. |
| C17 | A card without a billing rule shows an inline-message on the overview linking to settings, and the installment purchase action is disabled with that reason. |
| C18 | The overview header shows three stat-cards (debt = account balance, credit limit, available limit, from `Account.card`) and a progress-indicator of the used share. Without a credit limit, the limit stat-card shows "No limit" and links to settings. |
| C19 | Billing rule form defaults: `closing_day_assignment` `next`, `due_date_adjustment` `following`, `calendar` `br_banking`. The calendar field shows only when the adjustment is not `none`. |
| C20 | Cards list shows holder, `•••• last_four`, a "virtual" tag; inactive cards sit in a collapsed "Inactive" section. Deactivation uses B4 through a confirmation dialog. |
| C21 | Statement detail offers previous and next statement controls, resolved from the overview statements query; a missing neighbour disables its control. |
| C22 | `format.ts` gains `formatReferenceMonth` ("2026-11" → "nov. de 2026" / "Nov 2026", `Intl.DateTimeFormat` month-year, UTC). |
| C23 | Field errors map by path: `card_account_id` and `postings[n].account_id` / `postings[n].statement` (no billing rule) show at form level with a link to settings; every other `field` attaches to the input of the same name. |

## Routes

| Route | Content | Actions |
|---|---|---|
| `/cards/$accountId` | stat-cards (C18); current statement card: reference, status, closing date, due date, `amount_due`, `unpaid`; statement list in groups Upcoming / Past (C6, C7), each row: reference, due date, status tag, `amount_due` | new purchase (`/transactions/new?account_id=`); new installment purchase; pay current or overdue statement; open statement; settings; earlier statements |
| `/cards/$accountId/statements/$statementId` | header: reference, status, `reconciled` tag; description-list: closing date, due date, opening, charges, credits, payments, amount due, unpaid; lines from `getStatement.postings`: date, description, role, installment tag `n/N`, amount (C8) | pay (when `unpaid` > 0 and status ≠ `financed`); finance (C11); open a line (`/transactions/$transaction_id`); previous / next statement (C21) |
| `/cards/$accountId/statements/$statementId/pay` | statement reference and `unpaid`; amount, date, source account (C10) | `payStatement` |
| `/cards/$accountId/statements/$statementId/finance` | `unpaid`; date, installment count, installment amount, interest preview (C11) | `financeStatement` |
| `/cards/$accountId/purchases/new` | form of C12 | `createInstallmentPurchase`; save and add another |
| `/cards/$accountId/plans/$planId/anticipate` | plan installments not reversed; range from/to, target statement, date, amount; sum of the range and discount = sum − amount | `anticipateInstallments` |
| `/cards/$accountId/settings` | billing rules: effective month, closing day, due day, assignment, adjustment; credit limits: effective date, amount; cards (C20) | `createBillingCycleRule`; `createCreditLimit`; `createCard`; deactivate card (B4) |
| `/transactions/$id` (existing; `CardTransactionPanel`, C4) | shown when a posting has `card_role`. Schedule table (B2): number, statement, amount, reversed; plan status; refunds and chargeback (B3); disputes with outcome (B1) | refund (`refundTransaction`: date, amount defaulting to the purchase card amount, statement); open dispute (`openDispute`: `opened_on`); resolve dispute (`resolveDispute`: `resolved_on`, `outcome`, `statement` when won); cancel installments (`cancelInstallmentPlan`: date, `credit_statement`); anticipate (route above) |

Panel action availability: refund and open dispute need a `charge` posting and no `voided_at`; open dispute also needs no unresolved dispute; cancel and anticipate need a plan with status `active`.

## Phone ergonomics

Section 2 of the foundation spec applies. Card-specific rules:

- Overview: the current statement card comes first, above the stat-cards; the three stat-cards render as one row of compact values.
- Statement detail: `amount_due` and the status tag sit on the page-header line; the pay action is pinned in an action-bar at the bottom while payable; previous / next controls sit in the page-header.
- Statement line row: description and amount on the first line; date, role and installment tag on the second (LP-01).
- Transaction detail: the panel actions open in an action-sheet "Card actions"; dialogs of C14 open as bottom drawers.
- Settings: a segmented-control (Billing, Limit, Cards) replaces the three sections below 600 px.
- Day-of-month and count inputs use number-field with `inputmode="numeric"` and steppers.

## Data

Keys (`features/cards/api.ts`, `cardKeys`):

| Key | Query |
|---|---|
| `[...accountKeys.detail(a), "statements", from]` | `listStatements` (all pages) |
| `[...accountKeys.detail(a), "statement", s]` | `getStatement` |
| `[...accountKeys.detail(a), "billing-rules"]` | `listBillingCycleRules` |
| `[...accountKeys.detail(a), "credit-limits"]` | `listCreditLimits` |
| `[...accountKeys.detail(a), "cards"]` | `listCards` |
| `[...transactionKeys.detail(t), "disputes"]` | B1 |
| `["transactions", "plan", p]` | B2 |

Invalidation:

| Mutation | Invalidates |
|---|---|
| `payStatement`, `financeStatement`, `createInstallmentPurchase`, `refundTransaction`, `cancelInstallmentPlan`, `anticipateInstallments`, `resolveDispute` (won) | `transactionMutated(queryClient, [cardAccountId, ...other posting accounts])` |
| `openDispute`, `resolveDispute` (lost) | `transactionKeys.detail(t)` |
| `createBillingCycleRule` (re-dates open statements) | `accountKeys.detail(a)` |
| `createCreditLimit` | `accountKeys.detail(a)`, `accountKeys.list` |
| `createCard`, B4 | `[...accountKeys.detail(a), "cards"]` |

Routed forms persist drafts in sessionStorage under `cards.<form>.<accountId>` (foundation section 2).

## Problem codes

New catalog entries (`problem.<code>`, en and pt-BR):

| Code | Status | Operation | en message |
|---|---|---|---|
| `statement_not_closed` | 409 | `financeStatement` | Only a closed statement can be financed. |
| `statement_financed` | 409 | `financeStatement` | This statement is already financed. |
| `dispute_open` | 409 | `openDispute` | This purchase already has an open dispute. |
| `dispute_resolved` | 409 | `resolveDispute` | This dispute is already resolved. |

Existing entries reused: `validation_failed` (422 on every card operation, incl. the refund ceiling I06 on `amount`), `invalid_account` (422, unknown source or category account), `transaction_voided` (409), `not_found` (404), `invalid_request` (400). Each new code gets a web test rendering its message.

## Backend gaps

Delivered first, each with an apitest through `internal/apitest`, the OpenAPI contract and `make gen`; every query filters by `user_id` (ADR 003) and an apitest shows another user's resource returns 404.

| ID | Endpoint | Reason | apitest |
|---|---|---|---|
| B1 | `GET /transactions/{id}/disputes` → `DisputeList {items: Dispute[]}` ordered by `opened_on` | no read of disputes exists; resolving needs the dispute `id` after reload | S13: open → listed without outcome; resolve won → `outcome` and `refund_transaction_id` |
| B2 | `GET /installment-plans/{id}` → `InstallmentPlan {id, transaction_id, account_id, status: active\|cancelled\|anticipated, count, interest?, installments: [{number, statement, amount, reversed}]}` | domain read model "Installment plan view" (F3) has no endpoint; the schedule and anticipation need reversal state | S06 schedule; S14 `cancelled`, all reversed; S15 `anticipated`, 5–10 reversed |
| B3 | `Transaction.referenced_by: [{type, source}]` on `GET /transactions/{id}` (inverse of `links`) | the purchase detail lists its refunds and chargeback | S08: purchase lists two `refund_of` sources; S13: `chargeback_of` |
| B4 | `PATCH /cards/{id}` with `{active}` → `Card` | `Card.active` has no write path; a replaced card stays active | deactivate; reactivate; validation on an empty body |

## Tests

Flow tests use the fake fetch (K5), the fixture of `06-scenarios.md` 6.1 (Itaú Visa: closes day 3, due day 10, `next`, `following`) and fixed dates (no wall clock). Each test name carries its scenario ID and asserts the exact request body and the rendered values.

| Scenario | Web flow test |
|---|---|
| S05 | billing rule form with assignment `closing` posts the exact body; statement 2026-11 renders 230.00 and its dates |
| S06 | installment purchase of 1,000.00 in 3 posts `installment_count: 3` and no `interest`; panel renders 333.34 / 333.33 / 333.33 on 2026-11 / 2026-12 / 2027-01; available limit reduced by 1,000.00 |
| S07 | 10 × 222.54 over 2,000.00 posts `interest` 225.40 |
| S08 | full refund body; partial 50.00 with statement 2026-12; second refund 422 shows the message on `amount` |
| S09, S12 | annual fee renders as a charge in the neutral tone; cashback as a credit in the positive tone |
| S10 | pay defaults to `unpaid` 1,500.00 and posts it; partial 1,000.00; statuses `partially_paid` and `overdue` render their tags |
| S11 | 6 × 363.40 over 2,000.00 previews interest 180.40; `statement_not_closed` renders its message |
| S13 | open dispute body; `dispute_open` message; resolve won with statement 2026-12; outcome renders from B1 |
| S14 | cancellation body with `credit_statement` 2026-12; plan renders `cancelled` with reversed installments |
| S15 | range 5–10 sums 1,335.24; amount 1,260.00 previews discount 75.24; body matches |

Unit tests: `formatReferenceMonth` in both locales; statement grouping (C6, C7); line sign (C8); interest and discount arithmetic on integers (C11, C12, S15); field-path mapping (C23). Router test: `/accounts/$id` of a `credit_card` account redirects to `/cards/$id` (C2).

## Verification

- `make check` passes on the branch head.
- B1–B4 each have the apitest of the Backend gaps table.
- `rg -n "S(0[5-9]|1[0-5])" web/src/features/cards` lists a flow test for each scenario of the Tests table.
- Each route of the Routes table renders at 360, 768 and 1280 px with no horizontal scroll.
