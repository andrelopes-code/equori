# Pluggy synchronization

equori reads bank accounts and credit cards through Pluggy, an Open Finance aggregator. The
owner connects banks in Meu Pluggy, a free Pluggy service; equori only reads what Meu
Pluggy collects and never asks a bank for an update. Phase P6 of the roadmap describes the
rules (amendments A33–A45 of `docs/superpowers/plans/2026-10-16-p6-pluggy.md`; reserved
balances and balance assertion re-evaluation: amendments A73–A77 of
`docs/superpowers/specs/2026-10-18-pluggy-reserved-balances-design.md`).

## Terms

| Term | Meaning |
|---|---|
| Integration | One Pluggy application: a client id and a client secret. A user may hold several. |
| Item | One bank connection inside a Pluggy application, identified by an item id. |
| Connection | An item registered in equori through one integration. |
| External account | An account of an item. It syncs only when mapped to a ledger account. |
| Reserved balance | An amount that a bank account holds outside its balance, such as a Mercado Pago cofrinho. Pluggy reports it in `bankData.reservedBalances` of the bank account. equori lists it as an external account of subtype `RESERVED_BALANCE`. |

## 1. Key

Integrations need `EQUORI_SECRET_KEY`: 32 random bytes in standard base64.

```sh
openssl rand -base64 32
```

Set it in the environment of the container and keep it outside the database backups
(`backup.md`). Without it, every `/integrations` and `/connections` endpoint returns 409
`integration_unavailable`. To replace the key, set the new one in `EQUORI_SECRET_KEY`, the
old one in `EQUORI_SECRET_KEY_PREVIOUS`, run `equori secrets rotate`, then remove
`EQUORI_SECRET_KEY_PREVIOUS` (ADR 008).

## 2. Meu Pluggy

1. Create an account at <https://meu.pluggy.ai> and connect each bank there. The free plan
   holds up to 5 active connections and updates each one every 24 hours.
2. In the Pluggy Dashboard (<https://dashboard.pluggy.ai>), create an application and copy
   its client id and client secret.
3. In the application, create one connection per bank with the `MeuPluggy` connector and log
   in with the Meu Pluggy account. Each connection shows an item id.

Each person of the household uses their own Meu Pluggy account and Dashboard application:
the free plan connects the accounts of its own holder only (A45). More than five banks need a
second Meu Pluggy account, registered in equori as a second integration (A34), or a paid
Pluggy plan; check Pluggy's terms before splitting banks across accounts.

## 3. Integration, connections and mapping

```sh
# Integration: Pluggy validates the credentials before equori stores them (422 provider_unauthorized otherwise).
POST /api/v1/integrations {"provider": "pluggy", "name": "Meu Pluggy", "client_id": "...", "client_secret": "..."}

# One connection per item id; the response lists the item's accounts, all pending.
POST /api/v1/connections {"integration_id": "<integration>", "item_id": "<item id>"}

# Map each account to a leaf balance account of the same currency, from a start date, or ignore it.
PUT /api/v1/connections/<connection>/accounts/<external account> {"account_id": "<ledger account>", "sync_from": "2026-10-01"}
PUT /api/v1/connections/<connection>/accounts/<external account> {"ignored": true}
```

A checking account maps to kind `checking`, a savings account to `savings` or `reserve`, a
credit card to `credit_card`, a reserved balance (`RESERVED_BALANCE`) to `reserve`. Any other
kind for a reserved balance returns 422 `validation` on `account_id`. One ledger account takes
one external account. A card needs a billing cycle rule before its first sync.

A reserve ledger account is not a child of the checking account whose reserved balance it
receives: a mapped checking account stays a leaf.

## 4. Synchronization

The scheduler checks every connection at start and then every `EQUORI_SYNC_INTERVAL`
(default `1h`) and syncs those whose item has data newer than the last sync.
`POST /api/v1/connections/<connection>/sync` syncs one now. Each sync of a mapped account is
one import batch with source `open_finance` (`GET /api/v1/import-batches`):

- The first sync reads from the start date; later syncs read from 30 days before the last
  synced date, through today.
- A line already imported is ignored, or updated when Pluggy changed its status or bill.
- A line Pluggy stops returning becomes `withdrawn`; its transaction stays.
- A bank account's balance becomes a balance assertion on the date of the item's last
  update. It never records yield: a difference stays open for the owner. Reserved balances
  are the exception (section 4.1).
- Every sync passes the balance to the ledger, also when it equals the last synced one. An
  assertion of the same date and amount that is still open is decided again against the
  current settled balance, and reconciles when the difference is 0. No new assertion is
  created.
- A sync adds, as `pending`, every account and reserved balance that the item reports and the
  connection lacks. Existing external accounts are not changed or removed.
- Within one connection, the mapped bank accounts sync before the reserved balances.
- A card installment line creates or confirms its installment purchase.
- A line that cannot be placed waits for review (`GET /api/v1/import-batches/<batch>/records?state=needs_review`).

An item in `LOGIN_ERROR`, `OUTDATED` or `WAITING_USER_INPUT` is not synced; reconnect the bank
in Meu Pluggy. The connection shows the item status in `provider_status` and the last
failure in `last_error`.

Pluggy categories appear in `GET /api/v1/source-categories` with the number of lines that
carried them. `PUT /api/v1/source-categories/<id> {"category_id": "<category>"}` makes them
categorize lines that no rule decides.

### 4.1 Reserved balances

`POST /api/v1/connections` and every later sync list each reserved balance of a bank account
as an external account with subtype `RESERVED_BALANCE`, the reserve's `name` as name, no
`number_last4` and the currency of the bank account. A reserved balance without an amount in
that currency is not listed. Mapping follows section 3:

```sh
PUT /api/v1/connections/<connection>/accounts/<reserved balance> {"account_id": "<reserve account>", "sync_from": "2026-10-19"}
```

`sync_from` is the day after the item's last update date. The opening balance of the reserve
equals the reserved amount, dated the item's last update date (a transaction between the
reserve and Opening balances, as in section 5, step 3).

- Sync: a mapped reserved balance is one import batch with `received` 0. equori calls neither
  `GET /v2/transactions` nor any other line endpoint for it. The reserved amount becomes a
  balance assertion with source `open_finance` on the date of the item's last update.
- Yield: when the ledger account has `yield_mode` `auto` (the default of kind `reserve`) and
  an earlier assertion exists, a positive difference up to the bound is recorded as one
  yield transaction (reserve against the system account "Yield", description "Yield
  <first day> to <assertion date>") and the assertion reconciles with resolution `yield`. The
  bound is `floor(settled × 3 × days / 3000)` in minor units: 3% of the settled balance per
  30 days, `days` being the days since the previous assertion (minimum 1). A difference above
  the bound, a negative difference, or a first assertion stays open for the owner.
- Known limit: a movement under the bound that the transfer rule below does not recognize is
  booked as yield. Voiding the yield transaction reverses it.
- Transfers: a checking line is booked as a transfer between the checking account and the
  reserve account only when all conditions hold: the checking account is mapped; the line has
  `operationType` `TRANSFERENCIA_SALDO_RESERVADO`; the description is "Dinheiro reservado
  <name>" with a negative amount, or "Dinheiro retirado <name>" with a positive amount;
  `<name>` equals the name of exactly one mapped reserved balance of the connection; the line
  date is on or after that reserved balance's `sync_from`. A line that matches an existing
  posting keeps that match. Any other line follows the rules of section 4 and waits for the
  owner to classify it or to turn it into a transfer.
- Vanished reserve: a mapped reserved balance that the item no longer reports (for example, a
  deleted cofrinho) syncs as a batch with balance status `none`. The sync does not fail. Its
  lines on the checking account (for example "Dinheiro retirado" of that name) stay ordinary
  lines.

## 5. SC1 check

The success criterion SC1 of phase P6 is checked with one real bank account:

1. Map a checking account with `sync_from` on the first day of the current month.
2. Run `POST /api/v1/connections/<connection>/sync` and read the returned batch: `received`
   equals the lines of the period in the bank's app; `balance.status` is `recorded`.
3. Read `GET /api/v1/accounts/<account>/reconciliation`. A missing opening balance appears as
   `open_difference`, whose `difference` is the bank balance minus the settled balance of the
   ledger account. Record one transaction dated the day before `sync_from` with
   `POST /api/v1/transactions`: a posting of `+difference` on the account and a posting of
   `-difference` on the system account "Opening balances". Then run the sync again: the open
   assertion is decided again and reconciles with resolution `none`.
4. Read `GET /api/v1/accounts/<account>/balance-assertions`: the assertion of the sync, with
   source `open_finance`, has `reconciled` true.
5. Run the sync again: the new batch has `created` 0 and `matched` 0, and no assertion is
   added.

A difference in step 4 means a line is missing or duplicated: compare the batch records with
the bank statement, resolve the records that need review, and assert the balance again.
