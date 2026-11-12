# Brokerage clarity

Redesign of how a reader sets up a brokerage and records the first purchase. Amends `docs/specs/2026-10-23-investments-design.md` (account tree, A63, A68, A70) and `docs/specs/2026-11-07-portfolio-clarity-design.md` (PC8).

## Intent

The ledger models a brokerage as a tree: a `brokerage` account holds one cash account and one account per security (the holding). Evidence from the owner's book of 2026-11-12:

- The account form cannot create a holding. `new-account-page.tsx` limits the currency list to instruments of type `currency`, so a ticker is not offered. The owner created `AUVP11` with currency BRL: the account the selectors of a trade exclude, because a leaf in a currency counts as cash.
- The kind `brokerage` sits in the group "Reservas e investimentos" with the hint "Conta em corretora que guarda títulos e ações". Nothing tells that a cash account is needed or that a holding is created by a purchase.
- The parent field offers the checking account of the same bank, so the owner nested `Inter Investimentos` in `Banco Inter`.
- The message `trade.noSecurityAccount` says "Create one under a brokerage account". The screen offers no way to do it.
- The assistant tool `manage_accounts_and_payees` can create the holding, and the guide does not describe the tree, so the assistant gives no answer.

A reader thinks "I have an investment account at Inter and I bought AUVP11". The reader never thinks "account of kind brokerage, child of a child".

## Goals

- G1. A reader sets up a brokerage and records the first purchase through screens that name only: the brokerage, its cash balance and the investment.
- G2. No screen, message or tool asks for a step the screens cannot perform.
- G3. The web interface, the assistant and the guide use the same words for the same things.
- G4. Data in the shape of the owner's mistake (a leaf in a currency named after a ticker) is recognised and explained.

## Non-goals

- N1. The checking account does not replace the cash account of a brokerage. A trade posts its cash leg on a `brokerage` account; the return and the portfolio base (PC4, PC5) read that account.
- N2. No migration of existing books. A brokerage without a cash account is handled by BC7.
- N3. No cash account in a currency other than the base currency (`brokerageAccounts` already refuses it).

## Words

One word per concept, in the web interface, the guide and the assistant.

| Concept | en | pt-BR | Ledger |
|---|---|---|---|
| The account at the broker | Brokerage | Corretora | `brokerage` account without a parent account of kind `brokerage` |
| Money waiting in it | Cash | Caixa | child `brokerage` account in a currency |
| One security held in it | Investment | Investimento | child account in the code of an instrument (the holding) |

"Investment account" no longer names a holding: `trade.securityAccount` is replaced by `trade.investment`.

## Rules

### Setting up

**BC1 Kind chooser.** `brokerage` moves out of "Reservas e investimentos" into its own group "Investments" (pt-BR "Investimentos"). Its hint states the tree: "Where you buy stocks, ETFs and funds. It has a cash balance and one line per investment." Title: "Brokerage" (pt-BR "Corretora").

**BC2 No parent for a brokerage.** The create form draws no parent field when the kind is `brokerage`. A brokerage is a line of its own on the balance sheet. The edit form draws the field only when the account already has a parent.

**BC3 Cash is created with the brokerage.** `createAccountSteps` gains the step `cash`: after the brokerage exists it creates a child in the brokerage's currency, institution and opening date, named by the catalog key `brokerage.cashName` ("Cash", pt-BR "Caixa"). The step reuses the retry of `pending-setup.ts`, so a failure leaves a visible, resumable step and never an unnoticed brokerage without cash.

**BC4 Opening balance.** For a brokerage the opening section reads "Cash already in the brokerage" and the step `opening` posts to the cash account, never to the root.

### Recording

**BC5 Purchase form.** `TradeForm` asks, in this order: Brokerage, Investment, then the trade figures. The cash account is a read-only line "Paid from {cash name}, balance {amount}" when the brokerage has one open cash account in the base currency, and a select when it has more.

- Brokerage: preselected when the book has one; searchable select otherwise.
- Investment: a picker over the catalog by code and name. When the brokerage already holds it, the line shows the held quantity.
- A sale lists only the investments the brokerage holds.
- No holding account is shown or chosen. The holding is created by the save of the first purchase (BC6).

**BC6 Holding by purchase.** `TradeInput` and `InvestmentIncomeInput` accept either `account_id` (today) or the pair `brokerage_id` and `instrument`; exactly one form per request. With the pair, the server finds the holding or creates it as a child of the brokerage, in one database transaction with the trade. The server rejects an instrument whose quote currency differs from the brokerage's currency. `cash_account_id` becomes optional: absent, the server uses the single open cash account of the brokerage in the base currency and rejects zero or several. A sale or income with `instrument` and no holding is rejected.

Proposed `Problem.code` values, fixed in the plan: `trade_target_required` (neither or both forms), `brokerage_cash_missing`, `brokerage_cash_ambiguous`, `holding_not_found`.

**BC7 Missing cash.** A brokerage with no open cash account in the base currency shows, in `TradeForm` and on its own page, one `FormNotice`: "This brokerage has no cash account in {currency}." Its action creates the cash account, as BC3 does.

**BC8 Cash shortfall.** When the cash effect of a purchase exceeds the cash balance, `TradeForm` shows a notice with the shortfall and the action "Move money into {cash name}". The action opens `/transactions/new?kind=transfer&to_account_id={cash id}`. The route `transactions/new` accepts only `account_id` and `kind` today (`app/router.tsx`); it gains `to_account_id`, validated by `validateTransactionSearch`, and the transfer form reads it. The notice does not block the save: the server decides.

### Empty and recognised states

**BC9 Empty states.** The empty state of the Positions tab (`positions.empty`) and of the portfolio list offers "Record a buy" with the brokerage preset through the search parameter `brokerage_id`, added to the route `transactions/new` beside `to_account_id`. A book with no brokerage offers "Create a brokerage" (`/accounts/new` with `kind=brokerage`) in the same place. `trade.noSecurityAccount` is deleted.

**BC10 Leaf named after a ticker.** The page of a leaf `brokerage` account whose name equals the code of a known instrument and whose currency is a currency shows a `FormNotice`: "This account is a cash account. Investments are created by recording a buy." Its action opens the purchase form with that brokerage. The account form never creates an account whose currency is an instrument.

### Assistant and guide

**BC11 Tool.** `record_investment` takes `brokerage_id` and `instrument` as an alternative to `account_id`; `cash_account_id` is optional. The tool description and the errors of BC6 name the next step in the words of the table. `manage_accounts_and_payees` creates no holding: its `currency` description restricts the field to currencies.

**BC12 Guide.** `investments.md` opens with the tree in the three words of the table and the two steps (create a brokerage, record a buy). `accounts_and_categories.md` names the kind `brokerage` and links to `investments`. The articles change in the commits of BC1 to BC10 (S3).

## Cross-cutting questions

- R1: Does not apply: instruments and currencies come from the catalog and settings; the brokerage name comes from the reader.
- R2: Same behavior in every region.
- R3: Does not apply: no value set is added.
- R4: Does not apply: no extension point is added.
- R5: Catalog keys with pt-BR and en text: `kind.group.investments`, `kind.title.brokerage`, `kind.hint.brokerage`, `brokerage.cashName`, `accountForm.cashOpening`, `trade.brokerage`, `trade.investment`, `trade.paidFrom`, `trade.noCash`, `trade.createCash`, `trade.shortfall`, `trade.moveMoney`, `positions.empty`, `positions.recordBuy`, `brokerage.create`, `brokerage.cashLeafNotice`. `trade.securityAccount*`, `trade.noSecurityAccount` are removed.
- R6: Balances through `useMoneyFormat()`; held quantity through `fmt.number` with the instrument scale.
- C1: No amount is added. The trade keeps integer minor units; the cash balance comes from `/accounts/{id}/balance`.
- C2: The shortfall compares two base-currency amounts: the cash effect and the cash balance. No conversion occurs because the cash account is in the base currency.
- C3: A brokerage whose currency is not the base currency has no cash account in the base currency; BC7 states it and offers no trade.
- C4: Currencies come from the account record and settings. The cash name is a catalog text, stored at creation.
- T1: The trade date is a calendar date of `DateInput`; "today" comes from `useToday`.
- T2: Does not apply: no business day or due date.
- B1: Does not apply: no table.
- B2: The operations keep the role `write`. HTTP tests cover the new request forms for `read`, `write`, `owner` and for a non-member.
- B3: Does not apply: no setting.
- D1: Does not apply: no table.
- D2: Does not apply: no schema change.
- D3: The creation of a holding by a trade is one transaction with the trade; a voided trade leaves the holding account, which the next purchase reuses.
- D4: A trade proposed by the assistant waits for the reader's confirmation, as today.
- D5: Does not apply: the diagnostic file is unchanged.
- S1: `TradeInput` and `InvestmentIncomeInput` change; the operations are unchanged, so `tool_exposure_test.go` keeps its entries and its coverage of `record_investment` is updated. Each `Problem.code` of BC6 has a test through the HTTP API.
- S2: The forms keep the phone scope of ADR 027 that they have today; the plan checks the new fields at 390 px.
- S3: `investments.md` and `accounts_and_categories.md` change (BC12).
- S4: `record_investment` and the guide change (BC11, BC12).
- X1: S387 a trade with `brokerage_id` and `instrument` creates the holding and the position. S388 a second trade of the same instrument reuses the holding. S389 a request with both forms or neither returns `trade_target_required`. S390 a brokerage with two cash accounts and no `cash_account_id` returns `brokerage_cash_ambiguous`. S391 a brokerage created through the form's steps has a cash child and its opening balance on that child. S392 an income with `instrument` credits the cash account and the holding's income event.
- X2: Does not apply to regions. A trade in a brokerage whose currency differs from the base currency (S390 variant) runs with base currency `USD` and a BRL brokerage.

## Open points for the plan

- `sheetRows` (`accounts/balance-sheet/balance-sheet.ts`) sums a child into its parent only when both have the same currency. A brokerage row on the Accounts screen therefore totals its cash and leaves out its holdings, which are in instrument codes. The plan states what that row shows and where it points the reader (the portfolio holds the valued total, PC2), and adds the link.
