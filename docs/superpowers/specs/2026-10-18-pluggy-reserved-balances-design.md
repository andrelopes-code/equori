# Pluggy Reserved Balances Design

Amends phase P6 (`docs/superpowers/plans/2026-10-16-p6-pluggy.md`, amendments A33–A45). Plan:
`docs/superpowers/plans/2026-10-18-pluggy-reserved-balances.md`.

## Intent

Pluggy reports Mercado Pago "cofrinhos" inside the bank account object, not as investments:
`bankData.reservedBalances[]`, each `{ name, identification, availableAmounts: [{ amount,
currencyCode, remuneration }] }`. A reserved balance is outside the account `balance`. The P6 sync
reads accounts, bills and transactions only, so reserved balances never reach the ledger. On
2026-10-18 the owner's Mercado Pago item reported `balance` 500.05 and two reserved balances,
"Cofrinho Mercado Livre" 1,002.92 (140% CDI) and "Algum dinheiro" 8,135.94 (120% CDI). The
Nubank item reports `reservedBalances: []`.

This amendment makes each reserved balance an external account that maps to a ledger reserve,
asserts its amount on every sync, books bounded yield, books the checking lines that move money
into or out of a mapped reserve as transfers, and fixes a defect of the P6 balance assertion (D5).

## Pluggy data observed on 2026-10-18

Read-only calls to `GET /accounts?itemId=` and `GET /v2/transactions` on the owner's Mercado
Pago item, 2026-07-20 to 2026-10-18 (123 checking lines).

| Fact | Observation |
|---|---|
| Reserved balance | `bankData.reservedBalances[]` of the `CHECKING_ACCOUNT`; `identification` is a UUID; one `availableAmounts` entry in `BRL`; `hasReservedBalance` is true. |
| Transfer lines | 5 lines with `operationType` `TRANSFERENCIA_SALDO_RESERVADO`, `category` "Transfer - Internal" (`categoryId` `05060000`), `paymentData.paymentMethod` `OTHER`, no receiver name. |
| Transfer into a reserve | `type` `DEBIT`, negative amount, `description` "Dinheiro reservado " + reserve name (2026-10-08, −2,000.00, "Dinheiro reservado Cofrinho Mercado Livre"). |
| Transfer out of a reserve | `type` `CREDIT`, positive amount, `description` "Dinheiro retirado " + reserve name (2026-10-08, +1,000.00 "Cofrinho Mercado Livre"; +2,000.00 "Algum dinheiro"). |
| Deleted reserve | 2026-09-05 −1,500.00 "Dinheiro reservado Aaa" and 2026-09-09 +3,082.07 "Dinheiro retirado Aaa": no current reserved balance is named "Aaa". |
| Reserve yield | No line carries it. The 63 "Rendimentos" lines (`operationType` `RESGATE_APLIC_FINANCEIRA`, category "Proceeds interests and dividends") are checking yield: 0.23 per business day on a balance of 500.05 is 0.046%, while 9,138.86 in reserves at 120–140% CDI yields about 5.00 per business day. |
| Identifiers | Transfer lines carry no reserve `identification`; the reserve name is the only link. |

## Decisions

### D1 Reserved balance as an external account (A73)

Each reserved balance of a bank account is an external account of the connection.

- `external_account_id` is the reserve's `identification`; `type` is `BANK`; `subtype` is
  `RESERVED_BALANCE`; `name` is the reserve's `name`; `number_last4` is empty; `currency` is the
  parent account's `currencyCode`. The amount is the sum of the `availableAmounts` in that
  currency; a reserve without such an amount is not listed.
- `POST /connections` lists the reserved balances with the item's other accounts, state `pending`.
- Refinement: each sync of a connection adds, as `pending`, every account and reserved balance
  the item reports that the connection lacks. Existing external accounts are not changed or
  removed. Without this rule, a connection created before this amendment never lists its reserves.
- `PUT /connections/{id}/accounts/{external_account_id}` maps `RESERVED_BALANCE` to a leaf balance
  account of kind `reserve` and the same currency, with `sync_from`, or ignores it. Every other
  kind is rejected with 422 `validation`, field `account_id`.
- A mapped checking account must stay a leaf: a reserve ledger account is a top-level account or
  a child of a parent that the checking external account does not feed (A9, A35).

### D2 Reserve amount as a balance assertion (A74)

Each sync of a mapped reserved balance is one import batch with source `open_finance`,
`received` 0, and no `GET /v2/transactions` call. The reserve amount becomes a balance assertion
with source `open_finance` on the mapped reserve account, dated the item's last update date (A42).

- Refinement: within one connection, a sync records every other mapped account before any
  reserved balance, so that D4 transfers are booked before the reserve assertion.
- A mapped reserved balance that the item no longer reports yields a batch with balance status
  `none`; it is not an error.

### D3 Bounded yield on reserved balances (A75)

After the D2 assertion of a mapped reserved balance, the ledger books the difference
`asserted − settled` as yield when all conditions hold:

1. The ledger account's `yield_mode` is `auto` (the default of kind `reserve`).
2. The account has a previous assertion dated before the new one; `days` is the number of days
   between the two dates, minimum 1.
3. `0 < difference ≤ B`, with `B = floor(settled × 2 × days / 3000)` in minor units (2% per 30
   days), computed with `math/big`; `B` is 0 when `settled ≤ 0`.

The yield is one transaction dated the assertion date: reserve `+difference`, system income
account "Yield" (role `yield`) `−difference`, description "Yield <first day> to <assertion
date>", where the first day is the day after the previous assertion (F6, A10). The assertion is
reconciled with resolution `yield`. A difference outside `(0, B]`, or without a previous
assertion, stays open for the owner (current behaviour). A bank account (`CHECKING_ACCOUNT`,
`SAVINGS_ACCOUNT`) never records yield from a sync (A42 unchanged).

Rationale: a transfer between checking and a reserve that is not booked as a transfer changes the
reserve amount; the bound keeps such a transfer from being booked as yield.

Known limit: the bound is 0.0667% per calendar day. At 140% CDI, consecutive business-day
assertions accrue 0.0644% per day on the 2026-10 CDI (0.046% per business day, 12.3% per year).
Above a CDI of 12.75% per year, the yield of one business day exceeds the bound of one calendar
day, and that difference stays open. The rate is one named constant of the ledger domain.

### D4 Transfers between checking and a reserved balance (A76)

Recognition is reliable from the observed data under these conditions, all required:

1. The line belongs to a mapped bank account of the same connection as the reserved balance.
2. `operationType` is `TRANSFERENCIA_SALDO_RESERVADO`.
3. The description is "Dinheiro reservado <name>" with a negative amount, or
   "Dinheiro retirado <name>" with a positive amount.
4. `<name>` equals the `name` of exactly one mapped `RESERVED_BALANCE` external account of the
   connection.
5. The line date is on or after that external account's `sync_from`.

A recognized line that creates a transaction is recorded as a transfer between the bank account
and the reserve's ledger account (`ImportDecision.TransferTo`, cause method `source`); the
classification decision is not used for it. A line that matches an existing posting keeps the
P4 match. Any other line, including one naming a deleted or renamed reserve ("Aaa"), follows the
P6 pipeline unchanged: rules, source category (A41), else uncategorized, for the owner to classify
or to turn into a transfer (P5b A28, A29).

Condition 5 prevents a double count: the reserve's opening balance covers the movements before
`sync_from`.

### D5 Synced assertion re-evaluated, not duplicated (A77)

Evidence (owner's database, user 3, 2026-10-18):

| recorded_at (UTC) | account | date | amount | source | reconciled |
|---|---|---|---|---|---|
| 12:40:27 | Nubank | 2026-10-17 | 107.33 | open_finance (sync batch) | false |
| 12:41:18 | — | — | — | opening balances recorded, dated 2026-06-30 | — |
| 12:41:27 | — | — | — | sync: 3 batches, balance status `none` | — |
| 12:41:36 | Nubank | 2026-10-17 | 107.33 | open_finance (`POST /accounts/{id}/balance-assertions`) | true |

The same sequence holds for Mercado Pago (500.05).

Diagnosis: the first sync asserted the balance before the opening balance existed, so the
difference stayed open. The second sync skipped the assertion because the balance equalled the
stored one (`ext.Balance == b` in `syncAccount`), and the open assertion was never decided again.
The second assertion came from the API, not from the sync. Several assertions on one date are
permitted for manual and import sources; for the sync, S52 requires that a repeated sync create no
assertion. The defect is the skipped re-evaluation, which leaves a synced assertion open after
the missing history is recorded.

Rule: a sync passes the balance to the ledger on every run.

- When the account has open_finance assertions with the same date and amount, the ledger creates
  none and decides each unreconciled one again against the current settled balance: difference 0
  reconciles it with resolution `none`; for a reserved balance, D3 applies. Reconciled ones stay
  unchanged.
- Otherwise the ledger inserts a new assertion and decides it (P6 behaviour).
- The batch balance status stays `recorded` only when the date or amount differs from the last
  synced balance, else `none` (S52 unchanged).
- `POST /accounts/{id}/balance-assertions` is unchanged: it always inserts.

On the next sync after deployment, the owner's open assertions of 2026-10-17 reconcile with
resolution `none`.

## Data contract

`api/openapi.yaml`, no new operation:

- `ExternalAccount.subtype`: description lists `CHECKING_ACCOUNT`, `SAVINGS_ACCOUNT`,
  `CREDIT_CARD`, `RESERVED_BALANCE`.
- `ExternalAccount.number_last4`: absent for `RESERVED_BALANCE`.
- `mapExternalAccount` description: adds "RESERVED_BALANCE to reserve".

Generated code changes only in comments; `make gen` runs after the edit.

## Migration

None. `ingestion_external_account.subtype` has no check constraint, `number_last4` is nullable,
`UNIQUE (connection_id, external_account_id)` holds for reserve identifications, and
`ledger_categorization_event.method` already admits `source`. No new database invariant.

## Scenarios (docs/domain/06-scenarios.md, section 6.15)

The 6.15 clock is 2026-11-12. Item Mercado Pago has checking "Mercado Pago" (balance 500.05)
with reserved balances "Cofrinho Mercado Livre" and "Algum dinheiro".

### S68 Reserved balance mapped to a reserve

`POST /connections` for Mercado Pago lists three external accounts, all `pending`: the checking
account and two with subtype `RESERVED_BALANCE`. Mapping "Cofrinho Mercado Livre" to the
checking ledger account fails with 422 `validation` on `account_id`; mapping it to reserve
"MP Cofrinho" with `sync_from` 2026-11-11 succeeds. With an opening balance of 1,002.92 dated
2026-11-10 and the item updated on 2026-11-10, the sync creates a batch with `received` 0 and
balance `recorded` 1,002.92 on 2026-11-10, and an assertion with source `open_finance` that
reconciles the account. A reserved balance added to the item later appears as `pending` after
the next sync. Nubank, with `reservedBalances: []`, lists no reserve.

### S69 Bounded reserve yield

After S68, the item updated on 2026-11-11 reports 1,003.52: the difference 0.60 is within
`B = floor(100292 × 2 × 1 / 3000) = 66`, so the sync records "Yield 2026-11-11 to 2026-11-11" of
0.60 against Yield and the assertion is reconciled with resolution `yield`. On 2026-11-12 it
reports 1,004.52: the difference 1.00 exceeds `B = 66` and stays open. A reported amount below the
settled balance stays open.

### S70 Transfer to and from a reserved balance

With "Cofrinho Mercado Livre" and "Algum dinheiro" mapped from 2026-11-11, checking lines of
2026-11-11 with `operationType` `TRANSFERENCIA_SALDO_RESERVADO`: "Dinheiro reservado Cofrinho
Mercado Livre" −200.00 creates a transfer of 200.00 from Mercado Pago to MP Cofrinho;
"Dinheiro retirado Algum dinheiro" +100.00 creates a transfer of 100.00 from the "Algum dinheiro"
reserve to Mercado Pago. "Dinheiro retirado Aaa" +50.00, and "Dinheiro reservado Cofrinho Mercado
Livre" −30.00 dated 2026-11-10, are recorded as ordinary lines.

### S71 Synced assertion re-evaluated

Nubank checking mapped from 2026-11-01 with the S52 lines and balance 3,834.10, without an
opening balance: the first sync records an assertion with an open difference of 1,000.00. The
owner records an opening balance of 1,000.00 dated 2026-10-31; the next sync, with the same
balance, creates no assertion, and the existing one becomes `reconciled` with resolution `none`.
An open synced assertion with a second assertion of the same date and amount created through
`POST /accounts/{id}/balance-assertions` is reconciled by the next sync; both are `reconciled`.

## Operations doc (docs/operations/pluggy.md)

- Section 3: mapping of `RESERVED_BALANCE` to `reserve`; reserve ledger accounts are not children
  of a mapped checking account.
- New section "Reserved balances": D2 to D4 for the owner, the known limit of D3, and the
  `sync_from` and opening balance of a reserve: `sync_from` is the day after the item's last
  update; the opening balance equals the reserve amount, dated the item's last update date.
- Section 4: the bullet "never records yield" names the D3 exception; a repeated sync decides an
  open assertion again (D5); reserves sync after the other accounts.
- Section 5: new step 2, "Record the opening balance of the account, dated the day before
  `sync_from`, with the bank balance at the end of that day (`POST /api/v1/transactions` against
  Opening balances)", before the first sync. A missing opening balance is fixed by recording it
  and syncing again.
