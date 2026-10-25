# Demo account

Goal: a second local user, `demo@equori.local`, holding 24 months of coherent personal-finance data that exercises every module of the application. The real account stays untouched.

## Decisions

- Tool: `cmd/demoseed`, a separate `main` package that drives the running application through `/api/v1` with one authenticated session. No SQL, no direct service calls: every invariant of the ledger applies.
- User creation: `equori user create --language pt --region BR` (existing command). `make demo` runs the command when the user is absent, then the seeder.
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
| Institutions | Itaú (salary account, Visa card, savings), Nubank (checking, Mastercard, reserve box), XP (brokerage), wallet cash |
| Investments | emergency fund in Tesouro Selic and CDB 100% CDI, equities (ITUB4, WEGE3, PETR4, BBAS3), FIIs (HGLG11, KNRI11, MXRF11), ETF IVVB11, Tesouro IPCA+, small crypto |
| Savings rate | 15 to 20 % of net income, as monthly transfers to the brokerage and the reserve, plus lump sums from the 13th salary and PLR |
| Debt | one 12x installment purchase of electronics, one 10x trip, an anticipated installment |

## Tasks

Each slice is at most three tasks and ends with a checkpoint in `.claude/progress/current.md`.

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

## Risks

- Business rules reject realistic sequences (settlement dates, locked statements): each rejection is fixed in the data, never by changing product code.
- Prices and rates are plausible, not historical. The data does not claim to match real quotes.
