# Demo account

Goal: a second local user, `demo@equori.local`, holding 24 months of coherent personal-finance data that exercises every module of the application. The real account stays untouched.

## Decisions

- Tool: `cmd/demoseed`, a separate `main` package that drives the running application through `/api/v1` with one authenticated session. No SQL, no direct service calls: every invariant of the ledger applies.
- User creation: `equori user create --language pt --region BR --admin` (existing command): the demo user is an administrator of the instance, so it manages the market data and the other settings of the instance. `make demo` runs the command when the user is absent, then the seeder.
- Determinism: a fixed `math/rand/v2` PCG seed. The same inputs produce the same data. `--today` defaults to the current date; history starts 24 months earlier.
- Idempotency: the seeder aborts when the user already owns an account that is not a system account. Reset is `DROP`ping the user with SQL on the dev database; the seeder does not delete.
- Test: `cmd/demoseed/demoseed_test.go` runs the seeder against `apitest.New(t)` and asserts invariants (no negative checking balance, card statements settled, positions positive, every module non-empty).
- Region: persona data is Brazilian by design and lives in `cmd/demoseed` only. No product package imports it.
- Excluded: Pluggy aggregator connections (need an external provider key), assistant provider keys, paid or live tests (`eval`, `live`).

## Persona

Mariana Costa Ribeiro, 34, product analyst in São Paulo, CLT employee, renting, no children, partner who splits some bills.

| Item | Value |
|---|---|
| Gross salary | R$ 14.900,00 until 2025-12, R$ 15.800,00 from 2026-01 |
| Net salary | gross minus INSS, IRRF and health-plan discount, paid on the 5th business day |
| Extras | 13th salary (Nov first half, Dec second), vacation pay (2025-07), PLR (2025-03 and 2026-03) |
| Benefit | VR/VA credited monthly to a `benefit` account |
| Housing | rent R$ 3.450,00 (+ annual adjustment), condominium R$ 780,00, electricity, water, gas, internet, mobile |
| Institutions | Itaú (salary account, Visa card, savings, car financing), Nubank (checking, Mastercard, reserve box), XP (brokerage), Nomad (dollar account), wallet cash |
| Investments | began 60 months before today with R$ 600 a month, R$ 1.100 until 2025-08, R$ 300 from 2025-09; five groups with ideals (fixed income 30 %, domestic equities 28 %, foreign ETFs 22 %, real estate funds 15 %, gold and crypto ETFs 5 %), priced from the quotes of the instance; contribution plan of R$ 300; the PLR of 2025 and 2026 send R$ 2.000 to the dollar account beside the R$ 6.000 to the brokerage, the 13th of 2025 R$ 1.500 to the dollar account instead of the brokerage; dividends reinvested, three small trims |
| Dollars | `checking` account in USD at Nomad from 2025-03-18, filled by three remittances from PLR and 13th salary at the PTAX plus a 2 % spread; IOF on the remittance 1.1 % until 2025-05-22, 3.5 % from 2025-05-23, on the category IOF; valued at the PTAX the instance holds |
| Car | used 2021 Hyundai HB20 1.0 (`property`) bought on 2025-08-15 for R$ 61.900,00: R$ 35.900,00 from a sale of R$ 41.900,00 of Tesouro Selic, then BOVA11, IVVB11, WRLD11, NASD11 and BPAC11 as needed, whose R$ 6.000,00 more pay the costs of the first year; R$ 27.877,46 financed (`loan`) with IOF R$ 781,56, bank fee R$ 850,00 and lien registry R$ 245,90; Itaú CDC at 1.89 % a month in 48 installments of R$ 888,63 (Price table) on the 15th, interest on the system account Interest, a `transfer` schedule to the financing; FIPE value from R$ 62.500,00 less 0.7 % a month, stated at the end of each February, May, August and November as a balance assertion resolved as adjustment (A259 PA3) |
| Car costs | policy of Porto Seguro in 10x on the Itaú card each August; IPVA of each January in a single payment, 4 % of the value less 3 %; Detran-SP transfer; a service in 3x and a brake job; fuel 2 to 3 times a month, parking and the Sem Parar invoice from 2025-09; rides cut from 8–14 to 3–6 a month, coach trips end, discretionary purchases cut from 70 % to 62 % of the habit range |
| Savings rate | 15 to 20 % of net income, as monthly transfers to the brokerage and the reserve, plus lump sums from the 13th salary and PLR |
| Debt | one 12x installment purchase of electronics, one 10x trip, an anticipated installment, the car financing |

## Tasks

### Slice 1: foundation

1. `cmd/demoseed` skeleton: flags, cookie-jar client with typed helpers, login, populated-user guard, `make demo` and `make demo-user` targets.
2. Chart of accounts: institutions with identifiers, account tree per institution, cards with billing-cycle rules and credit limits, category tree (about 45 leaves), payees, opening balances.
3. Test harness for the seeder with the first assertions (accounts and categories exist, opening balances reconcile).

### Slice 2: cash flow

4. Salary with itemised withholding, extras, benefit credit, rent and fixed bills, month by month.
5. Variable spending: groceries, delivery, transport, health, leisure, shopping; amounts drawn from per-category distributions; payee and tag usage; settled-on dates for debit purchases.
6. Credit cards: charges, statement payments, installment purchases, one refund, one anticipation, one dispute, foreign purchase with fee.

### Slice 3: investments

7. Instruments, fixed-income terms, price history (monthly closes) for each security.
8. Trades by month (buy, a few sells with realized gains), investment income (dividends, FII yields, JCP with withholding), reserve yield.
9. Transfers between own accounts, tax payments, goals tied to investment accounts.

### Slice 4: planning, classification, reconciliation

10. Schedules (bills, subscriptions, income, savings), budgets with rollover, occurrences realized, skipped and moved.
11. Rules, payee aliases, uncategorized transactions left on purpose, rule run.
12. Balance assertions, statement facts and reconciliation, a CSV profile and a file import batch, attachments.

### Slice 5: verification

13. Run against the dev database; read reports (net worth, flows, categories, allocation, return) and fix incoherent data.
14. Document `make demo` in `README.md` or `docs/`; `make check`.

## Realism rules

`cmd/demoseed/demoseed_test.go` enforces these on the generated book; a change to the seeder keeps them:

- Dates follow the seeding day: the statement lines of the last three weeks, the pay days (holidays of the calendar of the book) and the schedules.
- Every schedule starts with the price in force and has its past occurrences realized by the recorded charges; only announced changes are terms.
- Yielding accounts are asserted at every month-end; the meal card, the brokerage cash and the Nubank account stay in the range their use gives them; no checking account closes a day overdrawn.
- A year of card and account lines arrives through statement files with institution descriptors; the rules match them by word and every rule can fire.
- The savings rate of the last twelve months is 14 to 22 %; goals hold 30 to 90 % of their targets; rollover budgets carry at most four months.
- Every payee and every leaf category has a transaction.

## Risks

- Business rules reject realistic sequences (settlement dates, locked statements): each rejection is fixed in the data, never by changing product code.
- Prices and rates are plausible, not historical. The data does not claim to match real quotes.
