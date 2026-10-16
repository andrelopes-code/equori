# Pluggy synchronization

equori reads bank accounts and credit cards through Pluggy, an Open Finance aggregator. The
owner connects banks in Meu Pluggy, a free Pluggy service; equori only reads what Meu
Pluggy collects and never asks a bank for an update. Phase P6 of the roadmap describes the
rules (amendments A33–A45 of `docs/superpowers/plans/2026-10-16-p6-pluggy.md`).

## Terms

| Term | Meaning |
|---|---|
| Integration | One Pluggy application: a client id and a client secret. A user may hold several. |
| Item | One bank connection inside a Pluggy application, identified by an item id. |
| Connection | An item registered in equori through one integration. |
| External account | An account of an item. It syncs only when mapped to a ledger account. |

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
credit card to `credit_card`. One ledger account takes one external account. A card needs a
billing cycle rule before its first sync.

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
  update. It never records yield: a difference stays open for the owner.
- A card installment line creates or confirms its installment purchase.
- A line that cannot be placed waits for review (`GET /api/v1/import-batches/<batch>/records?state=needs_review`).

An item in `LOGIN_ERROR`, `OUTDATED` or `WAITING_USER_INPUT` is not synced; reconnect the bank
in Meu Pluggy. The connection shows the item status in `provider_status` and the last
failure in `last_error`.

Pluggy categories appear in `GET /api/v1/source-categories` with the number of lines that
carried them. `PUT /api/v1/source-categories/<id> {"category_id": "<category>"}` makes them
categorize lines that no rule decides.

## 5. SC1 check

The success criterion SC1 of phase P6 is checked with one real bank account:

1. Map a checking account with `sync_from` on the first day of the current month.
2. Run `POST /api/v1/connections/<connection>/sync` and read the returned batch: `received`
   equals the lines of the period in the bank's app; `balance.status` is `recorded`.
3. Read `GET /api/v1/accounts/<account>/balance-assertions`: the assertion of the sync, with
   source `open_finance`, has `reconciled` true.
4. Run the sync again: the new batch has `created` 0 and `matched` 0.

A difference in step 3 means a line is missing or duplicated: compare the batch records with
the bank statement, resolve the records that need review, and assert the balance again.
