# Bringing an existing portfolio into a book

Status: draft, 2026-11-27 (amendment A270). Owner choice of the scope on 2026-11-27.

## Intent

A person who starts with equori after years of investing holds positions, lots and carried losses that no trade of the book produced. Today every security enters through a trade that pays cash (`domain.BuildTrade`), so recording a position held for years leaves the cash of the brokerage below zero, or needs an invented deposit. A file of operations has no import: each trade, note and income is typed one by one. The monthly tax computes the losses carried only from the sales recorded, so a loss of an earlier year is lost. The movements of a bank connection's fixed income are confirmed one at a time.

## Goals

- G1. A position held before the book enters at its cost, lot by lot, on the date each lot was acquired, without moving cash.
- G2. A file of operations of one brokerage enters all at once, the same file twice creating nothing.
- G3. A loss carried from before the book's history reduces the monthly tax.
- G4. The pending movements of one fixed income investment of a bank connection are confirmed in one action.

## Non-goals

- A reader of the files of a given exchange or broker (the B3 investor area, a foreign broker's statement). The file of G2 has one neutral layout; any export enters after its columns are arranged into it, for example on the Spreadsheets screen.
- Cash in a currency other than the base currency in a brokerage. A trade keeps paying from cash in the base currency (`brokerageAccounts`); that change and its tax on currency gains abroad get their own spec.
- Incomes in the batch confirmation of G4: each needs its category and its tax withheld, and stays confirmed one by one.

## Anti-goals

- An opening that reads as income, as a deposit of cash, or as a gain.
- A file import that decides a doubtful line alone, or writes part of a file.
- A carried loss typed once and applied to a pool the region's rule does not have.

## Approaches

1. **A trade side `opening` against the opening balances (chosen).** The side follows `write_off`: a trade without cash. Its counterpart is the system account `opening_balances`, an equity account that the return already reads as money in (`TreeExternalFlows`, HR10). Lots, average cost, the lot method and the transaction page read it as a purchase with no new rule, because lots replay from posting dates (`ReplayLots`) and the cost basis is the sum of weights (`domain.Holding`).
2. **A purchase paid by a deposit from opening balances.** Two transactions per lot: a cash deposit from equity, then a buy. The cash account carries deposits that never happened, and a correction must keep two transactions in step.
3. **A new transaction kind for positions.** A second detail beside `ledger_trade`, a second reader in the portfolio and the archive, for the same fact a trade already models.

The file of G2 has two forms: a fixed header in the shape of the price import (`ParsePriceCSV`, chosen), or a column profile like the statement CSV profile. The fixed header has one contract to test and to document; a profile grows a mapping per broker, which the non-goal excludes.

Owner choice of 2026-11-27: G1 to G4 in one session, cash abroad in a later spec.

## Rules

### Opening of a position (ledger)

- OL1. `TradeSide` gains `opening`: units held before the book, at their cost, without cash. The holding is `account_id`, or `brokerage_id` with `instrument`, which creates the holding as a buy does.
- OL2. An opening takes `date` (the day the lot was acquired), `quantity`, `unit_price` above zero, and optional `fees`, which join the cost. `cash_account_id`, `taxes` and `settlement_date` are refused with 422 on the field.
- OL3. Postings: the holding receives the quantity with weight `quantity × unit_price + fees`; the system account `opening_balances` gives the same amount in the base currency. The trade detail stores side `opening`, `cash_account_id` equal to `account_id` (as `write_off` does), the gross, the fees, taxes zero and no cost.
- OL4. An opening dated before the opening date of its brokerage or of its holding moves both opening dates to the date of the opening, in the same transaction. A210 allows only an earlier date, so no posting is stranded.
- OL5. An opening adds a lot dated on its date. In the separation of day trades (`domain/day_trade.go`), it counts as a purchase of its date.
- OL6. A brokerage note refuses the side `opening`, as it refuses `write_off`.
- OL7. `POST /fixed-income-applications` gains `opening` (boolean, default false). True records the application as an opening: no cash, `cash_account_id` refused with 422, fees in the cost. The contract and its accrual follow FC11 to FC15 unchanged.
- OL8. Migration: the check `ledger_trade_side_check` accepts `opening`. A new check requires taxes zero and `cash_account_id = account_id` on an opening.

### Investment file (ledger)

- IF1. `POST /brokerages/{id}/investment-file`, `operationId: importInvestmentFile`, `x-book-role: write`, multipart: `file` (CSV), optional `cash_account_id`, optional `category_id` (the income category), optional `dry_run` (boolean). Response 200: `{ lines, created, skipped }`, integers.
- IF2. The first line is exactly `kind,date,instrument,quantity,unit_price,fees,taxes,gross,withheld,income_type`. Values are comma-separated, decimals use a dot and no thousands separator, and dates are `YYYY-MM-DD`. At most 10,000 lines after the header. An empty cell is an absent value.
- IF3. `kind` is `opening`, `buy`, `sell` or `income`.
  - `opening` and `buy` take quantity, unit price and fees.
  - `sell` also takes taxes.
  - `income` takes gross, withheld and `income_type`; an empty `withheld` is zero.
  - Each line is checked as its single operation is (OL2, `TradeInput`, the income input).
  - An error is a 422 whose field is `line N`, the header being line 1, followed by the field of the line.
- IF4. `instrument` names a defined instrument. An unknown code is refused on its line with "is not defined; define it on Instruments first".
- IF5. The lines are recorded in date order, lines of one date in file order, in one database transaction: all or nothing.
- IF6. A line equal to a recorded transaction of the brokerage is skipped, not recorded, and counted in `skipped`. Equal means:
  - for a trade: the same holding, side, date, quantity, unit price and fees;
  - for an income: the same holding, date, gross and income type.
  - Each recorded transaction answers at most one line, so two equal lines of one file against one recorded transaction record one. The same file imported twice creates nothing the second time.
- IF7. A file with an income line needs `category_id`; a file with a `buy`, `sell` or `income` line takes `cash_account_id`, or the single paying account of the brokerage, with the errors of a trade (`brokerage_cash_ambiguous`, `brokerage_cash_missing`).
- IF8. `dry_run` true runs every check and the match of IF6, writes nothing and answers the same counts.

### Opening losses (portfolio)

- LO1. Table `portfolio_opening_loss`: `books_id`, `pool` (`^[a-z0-9_]{2,40}$`), `month` (first day of a month), `amount` (minor units of the base currency, above zero). Primary key `(books_id, pool)`.
- LO2. The jurisdiction declares the pools that accept an opening loss: `LossPools() []string`. Brazil: `ordinary`, `day_trade`, `fii`. The crypto pool is left out, since its loss reduces no gain (Lei 13.259/2016). A region without a jurisdiction accepts none.
- LO3. An opening loss of pool P at month M is the loss carried into M. At the first month on or after M with a sale of P, the carried loss of P becomes the amount, in place of the loss computed from earlier sales.
- LO4. `GET /gain-tax/opening-losses` (`listOpeningLosses`, `read`) returns `{ losses: [{ pool, month, amount }] }`. `PUT /gain-tax/opening-losses` (`saveOpeningLosses`, `write`) replaces the whole set with the body of the same shape; an empty list clears it. A pool the jurisdiction does not list is a 422 on `losses[i].pool`.
- LO5. `get_tax_year` with view `gain_tax` returns `opening_losses` beside the months.

### Batch confirmation (web)

- MB1. The investments section of a connection (`connection-investments.tsx`) gives each investment with pending movements an action "Confirmar pendentes". It confirms, in date order, each pending movement whose proposal is `application`, `contribution` or `sale`. A pending income keeps its own confirmation.
- MB2. When the application is pending, the brokerage dialog opens once and its choice serves the application; the rest follow.
- MB3. The confirmations run one after another through the existing endpoint. The first failure stops the run and shows its error; each movement already confirmed keeps its undo.

### Assistant

- AS1. `record_investment` gains kind `opening` (OL1, OL2): its preview lists the quantity, the price, the fees, the cost and the date, with no cash account and no settlement.
- AS2. `record_fixed_income` gains `opening` (OL7).
- AS3. A new tool `import_investment_file`: `file_id`, `brokerage_id`, optional `cash_account_id` and `category_id`. Its preview is the dry run of IF8 with the file name and the counts. The run imports.
- AS4. `PUT /gain-tax/opening-losses` has no tool: the amount comes from the person's own tax records, typed on the Monthly tax tab. `get_tax_year` reads it (LO5).

### Web

- WB1. The trade form (`trade-entry/`) offers the side "Abertura de posição". It asks for the brokerage, the investment, the date, the quantity, the unit price or the order total, and the fees, and states the cost before Save. No cash account, no settlement.
- WB2. The fixed income form (`fixed-income-entry/`) gains a switch "Aplicação anterior ao equori". When on, the cash account is hidden and the form states that no cash moves.
- WB3. The brokerage page gains "Importar arquivo de operações". A dialog shows the header of IF2, takes a file, an income category when the file has incomes, and a cash account when the brokerage has several. It shows the counts of the dry run, then imports.
- WB4. The Monthly tax tab (`/portfolio/year?tab=gain_tax`) gains a section "Prejuízo anterior a compensar": one row per pool of the jurisdiction, with a month and an amount, and Save.

### Export

- EX1. `portfolio_opening_loss` is a fact of the archive. `ArchiveVersion` becomes 38; an archive of 37 holds no opening loss. Trades of side `opening` travel as trades.

### Guide

- GD1. Articles changed in the commit of each screen: `investment_operations.md` (OL, WB1), `fixed_income.md` (OL7, WB2), `investments.md` (IF, WB3, AS3), `equities_br.md` (LO, WB4), `imports_and_bank_connections.md` (MB), `getting_started.md` (one paragraph naming the three ways in: opening, file, connection).

## Scenarios

IDs follow S752. Each has a test through `internal/apitest` that carries its ID. Book region BR, base BRL, unless stated.

- S753 Opening of a stock. Brokerage XP opened 2026-11-01. Opening of PETR4, 100 at 20.00 with fees 5.00 on 2021-03-10: the holding holds 100 at cost 2,005.00; the cash of XP is unchanged; `opening_balances` gives 2,005.00; XP and its holding open on 2021-03-10.
- S754 Sale after an opening. S753, then a sale of 40 at 30.00 on 2026-11-20: cost removed 802.00, result 398.00.
- S755 Refused fields. An opening with `cash_account_id`, with `taxes`, with `settlement_date`, or with a unit price of zero: 422 on each field. A brokerage note with an order of side `opening`: 422.
- S756 Day trade with an opening. Opening of 10 VALE3 on 2026-11-20 and a sale of 10 the same day: the sale is a day trade of 10.
- S757 Return. S753 alone, return of XP from 2021-03-10 to 2026-11-20: net deposits 2,005.00.
- S758 Fixed income opening. `POST /fixed-income-applications` with `opening` true, CDB of 10,000.00 applied 2024-01-10: no cash moves, the holding's lot is dated 2024-01-10; with `cash_account_id`: 422.
- S759 Assistant opening. `record_investment` kind `opening` previews quantity, price, fees, cost and date, with no account and no settlement, then records S753.
- S760 File import. A file of four lines (opening, buy, sell, income) for XP: 200 with `lines` 4, `created` 4, `skipped` 0. The same file again: `created` 0, `skipped` 4. A dry run of a new file writes nothing.
- S761 Refused file. A file whose line 3 has the date 2026-13-01: 422 on `line 3`, nothing recorded. A wrong header: 422 on `line 1`. An income line without `category_id`: 422 on `category_id`. An unknown instrument: 422 on its line.
- S762 File outside Brazil. A book of the profile `apitest.Neutral` (region NZ, base NZD): a file with an opening of 10 VOO at 500.00 and a sale of 4 at 600.00 records both; the sale removes cost 2,000.00 and its result is 400.00.
- S763 Assistant file. `import_investment_file` previews the file name and the counts of the dry run, then imports.
- S764 Opening loss. Opening loss `ordinary` 1,000.00 from 2026-01; a sale of stocks in 2026-03 of 30,000.00 with a gain of 600.00: loss used 600.00, carried 400.00, tax 0.00.
- S765 Opening loss access and pools. Pool `crypto`: 422. A book of the profile `apitest.Neutral`: any pool is a 422. A reader gets 403 on PUT and 200 on GET; another book's losses are not listed.
- S766 Archive. A book with an opening of S753 and the opening loss of S764, exported and imported, keeps both.

Schema tests: an opening with taxes above zero, and an opening loss with an amount of zero or a month not on the first day, are rejected.

## Cross-cutting questions

- R1. The pools of LO2 are a value of the jurisdiction (`internal/portfolio/jurisdiction/br`, method `LossPools`). The income types of IF3 keep their regional list (`income_types`). No other regional value.
- R2. A region without a jurisdiction accepts no opening loss (LO2). Opening (OL) and the file (IF) hold no regional value and work in every region (S762).
- R3. `pool` is `^[a-z0-9_]{2,40}$` in SQL and a `pattern` in `api/openapi.yaml`. `TradeSide` is a closed enum of the ledger, not regional.
- R4. `LossPools` is an extension point: a row in `docs/contributing/regions.md`.
- R5. New keys in pt-BR and en: the side "Abertura de posição" and its cost line, the fixed income switch and its note, the file dialog (title, header line, counts, import, errors), the Monthly tax section (title, pool names, month, amount, save), "Confirmar pendentes", and the assistant labels of kind `opening` and of `import_investment_file`.
- R6. Dates and amounts on the new screens go through the month and date formatters and `useMoneyFormat()`.
- C1. Cost, fees and opening losses are integers of minor units with their currency.
- C2. The cost of an opening sums quantity × price and fees in the base currency only. No sum across currencies.
- C3. An instrument quoted in another currency opens at a cost in the base currency, as a trade does today (S637). The form states the base currency beside the price.
- C4. The currency on screen comes from the book's base currency through `useMoneyFormat()`.
- T1. Dates are calendar dates; the month of LO1 is the first day of the month.
- T2. Does not apply: an opening has no settlement, and the file takes the settlement cycle of each trade as `TradeInput` does.
- B1. `portfolio_opening_loss` holds `books_id`; each query filters by it; a schema test rejects a row without a book.
- B2. `importInvestmentFile` and `saveOpeningLosses` need `write`; `listOpeningLosses` needs `read`. HTTP tests cover each role and an access without membership (S765, S761).
- B3. Does not apply: no setting.
- D1. `portfolio_opening_loss` is a fact; `ArchiveVersion` 38 (EX1).
- D2. Two new goose migrations: the trade side (OL8) and the opening loss table (LO1).
- D3. An opening is a transaction with its versions and void, like any trade. An opening loss is a figure typed by the person and replaced as a whole.
- D4. The file decides alone only an exact match (IF6) and writes all or nothing (IF5). The same file twice creates nothing.
- D5. Does not apply: no diagnostic field.
- S1. New operations `importInvestmentFile`, `listOpeningLosses` and `saveOpeningLosses` get entries in `internal/server/tool_exposure_test.go`: `import_investment_file`, `get_tax_year`, and the exclusion of AS4. Every refusal of the rules reuses an existing `Problem.code`.
- S2. The trade form, the fixed income form and the Monthly tax tab keep their phone scope. The file dialog is a desk action under ADR 027.
- S3. GD1.
- S4. Yes: AS1 to AS3 and LO5.
- X1. S753 to S766.
- X2. S762 runs in the profile `apitest.Neutral` (region NZ, base NZD). S765 checks that profile, a region without a jurisdiction. S753 runs in each of `apitest.Profiles()`.

## Left to the builder

- The slices and their order within the plan.
- The sqlc queries of IF6 and of LO1.
- The layout of the file dialog and of the Monthly tax section within the existing patterns of their screens.
