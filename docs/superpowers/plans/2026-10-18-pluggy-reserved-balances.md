# Pluggy Reserved Balances Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sync Pluggy reserved balances (Mercado Pago "cofrinhos") into ledger reserves: external accounts, balance assertions, bounded yield and recognized transfers; fix the synced assertion that stays open after the missing history is recorded.

**Architecture:** The Pluggy anti-corruption layer (`ingestion/internal/pluggy`) reads `bankData.reservedBalances` and `operationType`. The aggregator adapter (`internal/ingestion/aggregator.go`) lists each reserved balance as an external account with subtype `RESERVED_BALANCE` and reads its amount without a transactions call. The sync (`ingestion/internal/app/sync.go`) orders reserves last, resolves reserve transfer lines to a `TransferTo` decision and calls a new ledger entry point for reserve assertions. The ledger (`ledger/internal/app/reconciliation.go`) gains a synced-assertion path that re-decides an existing open assertion and applies the bounded yield.

**Tech Stack:** Go 1.27, sqlc, oapi-codegen. No new dependency (`math/big` is in the standard library).

**Spec:** `docs/superpowers/specs/2026-10-18-pluggy-reserved-balances-design.md` (D1–D5, amendments A73–A77, scenarios S68–S71). Inherited: `docs/superpowers/plans/2026-10-16-p6-pluggy.md` (A33–A45, Global Constraints).

**Start condition:** branch `feat/pluggy-reserves`; `web/vite.config.ts` carries an uncommitted owner edit that no task stages.

## Global Constraints

- Every Global Constraint of `docs/superpowers/plans/2026-10-16-p6-pluggy.md` applies: N16 (logs, errors and problem details name no item id, account number, reserve identification or Pluggy payload) and N17 (outbound HTTP only to the configured base URL).
- Tests go through the HTTP API (`internal/apitest`) with the fake Pluggy server `internal/ingestion/internal/pluggy/pluggytest`; the fixture of `internal/ingestion/sync_test.go` (`syncFixture`) is the model. Pure functions get table tests next to them. No mock of the repository or of PostgreSQL.
- Each scenario test carries its ID in the name (`TestS68...`). Fixed clock `apitest.Today("2026-11-12")`. Assert status before decoding; assert exact amounts in minor units.
- A task starts with its failing test; run it and read the failure before implementing.
- Never edit `*.gen.go`; run `make gen` after editing `api/openapi.yaml` or `db/queries`.
- Verification: the focused `go test ... -run <Test> -count=1`, then `make check`. The pre-commit hook runs `make check`: `git commit ... >/dev/null 2>&1; echo $?`; on failure `make check 2>&1 | tail -40`.
- Stage files by name; never `git add -A` (the owner's `web/vite.config.ts` stays unstaged).
- Commit scope `ingestion` unless a task says otherwise. One commit per task.
- Execution runs in slices of at most three tasks; each slice ends by writing `.claude/progress/current.md`.

## Review Focus

- D5 must not create an assertion on a repeated sync (S52) and must leave `POST /accounts/{id}/balance-assertions` inserting as before.
- D3 applies only to `RESERVED_BALANCE` mappings with `yield_mode` `auto`; `TestSyncBalanceRecordsNoYield` (a `SAVINGS_ACCOUNT` mapped to a reserve) keeps passing unchanged.
- D4 never decides a transfer for a name shared by two mapped reserves, a deleted reserve, or a line dated before the reserve's `sync_from`.
- `B` is computed with `math/big`; no `float64`.

## File Structure

```
api/openapi.yaml                                         ExternalAccount.subtype, number_last4, mapExternalAccount descriptions
db/queries/ingestion/connection.sql                      InsertMissingExternalAccount
internal/ingestion/internal/pluggy/{model.go,normalize.go,normalize_test.go}
internal/ingestion/internal/pluggy/pluggytest/server.go  reserved balances, operationType, item update date
internal/ingestion/aggregator.go                         reserve listing and reading, AssertSyncedReserve port
internal/ingestion/ingestion.go                          ledgerPort: TransferTo decision, AssertSyncedReserve
internal/ingestion/internal/domain/{connection.go,record.go}
internal/ingestion/internal/app/{sync.go,importer.go,connection.go,ports}
internal/ingestion/internal/adapter/postgres/connection.go
internal/ingestion/{sync_test.go,reserve_test.go}
internal/ledger/ledger.go                                AssertSyncedBalance, AssertSyncedReserve
internal/ledger/internal/app/reconciliation.go           AssertSynced
internal/ledger/internal/domain/{reconciliation.go,reconciliation_test.go}
docs/domain/{05-domain-model.md,06-scenarios.md}
docs/operations/pluggy.md
```

## Slice A (Tasks 1–3)

### Task 1: Synced assertion re-evaluated (D5, A77, S71)

**Files:**
- Modify: `internal/ledger/internal/app/reconciliation.go` (new `AssertSynced`; the decision code shared with `AssertBalance`)
- Modify: `internal/ledger/ledger.go` (`AssertSyncedBalance` calls `AssertSynced`)
- Modify: `internal/ingestion/internal/app/sync.go` (`syncAccount`)
- Test: `internal/ingestion/sync_test.go`

**Interfaces:**
- Produces: `func (s *Service) AssertSynced(ctx context.Context, userID int64, accountID uuid.UUID, date time.Time, amount money.Money, reserve bool) (AssertionResult, error)`. Under the account lock: it loads the account's assertions; when open_finance assertions with `date` and `amount` exist, it inserts none and decides each unreconciled one with `domain.DecideAssertion(amount, settled, domain.YieldNone)`, reconciling with resolution `none` on difference 0; otherwise it runs the insert-and-decide path of `AssertBalance` with source `open_finance`. `reserve` is false in this task (Task 4 uses it). `CheckAssertionDate` applies to both paths.
- `syncAccount`: the ledger call runs whenever `read.Balance` is non-nil and not after today; `batch.Balance` becomes `recorded` only when `ext.Balance` is nil or differs, else stays `none`; `ext.Balance = b` as today.

- [ ] **Step 1: Write the failing test `TestS71SyncReevaluatesOpenAssertion`** with `syncFixture`: Nubank checking mapped from 2026-11-01, the S52 lines, balance `3834.10`, no opening balance. Sync → `GET /api/v1/accounts/<checking>/balance-assertions` has one item, `reconciled` false. Record an opening balance of 100000 dated 2026-10-31 (checking +100000, Opening balances −100000, `h.Record`). Sync again → the list has one item, `reconciled` true; the account's reconciliation status (the operation returning `ReconciliationStatus` in `api/openapi.yaml`) has no open difference. Subtest `second assertion through the API`: after the first sync, `POST /api/v1/accounts/<checking>/balance-assertions` with the same date, amount 383410 and source `open_finance` (201, reconciled false while the opening balance is missing); record the opening balance; `POST` again the same body (reconciled true); sync → the list has three items, all `reconciled` true.
- [ ] **Step 2: Run** `make db-up && go test ./internal/ingestion/ -run TestS71 -count=1` → FAIL (first assertion stays `reconciled` false).
- [ ] **Step 3: Implement** `AssertSynced`, switch `ledger.Module.AssertSyncedBalance` to it with `reserve` false, change `syncAccount` as stated.
- [ ] **Step 4: Run** the test → PASS; `go test ./internal/ingestion/ ./internal/ledger/... -count=1` → PASS (S52 `TestSyncBankAccount` still asserts no new assertion on a repeated sync); `make check` → exit 0.
- [ ] **Step 5: Commit** `git add <files>; git commit -m "fix(ingestion): decide an open synced balance assertion again"`; the body names D5 of the spec.

### Task 2: Reserved balances as external accounts (D1, A73, S68 mapping)

**Files:**
- Modify: `internal/ingestion/internal/pluggy/model.go` (`Account.BankData`, `BankData`, `ReservedBalance`, `ReservedAmount`, `SubtypeReserve = "RESERVED_BALANCE"`)
- Modify: `internal/ingestion/internal/pluggy/pluggytest/server.go` (`AddReservedBalance`, `SetReservedAmount`)
- Modify: `internal/ingestion/aggregator.go` (the function that lists an item's accounts for `CreateConnection`, near line 68)
- Modify: `internal/ingestion/internal/domain/connection.go` (`compatibleKinds["RESERVED_BALANCE"] = {"reserve"}`)
- Modify: `db/queries/ingestion/connection.sql` (`InsertMissingExternalAccount`), `internal/ingestion/internal/adapter/postgres/connection.go`
- Modify: `internal/ingestion/internal/app/sync.go` (`syncItem` adds missing external accounts), the app port that lists item accounts
- Modify: `api/openapi.yaml` (spec "Data contract")
- Test: `internal/ingestion/reserve_test.go` (new)

**Interfaces:**
- Pluggy model:
  ```go
  type BankData struct{ ReservedBalances []ReservedBalance `json:"reservedBalances"` }
  type ReservedBalance struct {
  	Name             string           `json:"name"`
  	Identification   string           `json:"identification"`
  	AvailableAmounts []ReservedAmount `json:"availableAmounts"`
  }
  type ReservedAmount struct {
  	Amount       Decimal `json:"amount"`
  	CurrencyCode string  `json:"currencyCode"`
  }
  ```
- pluggytest: `func (s *Server) AddReservedBalance(accountID string, r pluggy.ReservedBalance)` and `func (s *Server) SetReservedAmount(accountID, identification string, amount pluggy.Decimal)`; `GET /accounts` serves them under `bankData.reservedBalances`.
- Listing: after each bank account, one `domain.ExternalAccount{ExternalID: identification, Type: "BANK", Subtype: "RESERVED_BALANCE", Name: name, Currency: <parent currencyCode>}` per reserved balance with an amount in the parent currency.
- `-- name: InsertMissingExternalAccount :exec` `INSERT INTO ingestion_external_account (user_id, connection_id, external_account_id, type, subtype, name, number_last4, currency) VALUES (...) ON CONFLICT (connection_id, external_account_id) DO NOTHING;`. `syncItem` calls it for every listed account before syncing the mapped ones, then reloads `c.Accounts` (blocked items skip it, as they skip the sync).

- [ ] **Step 1: Write the failing test `TestS68ReservedBalanceMapping`**: item "Mercado Pago" with checking `mp-checking` (BRL, balance `500.05`) and reserved balances "Cofrinho Mercado Livre" (`1002.92`) and "Algum dinheiro" (`8135.94`). `POST /api/v1/connections` → 201 with three accounts, all `pending`; two with `subtype` `RESERVED_BALANCE` and no `number_last4`. `PUT` the "Cofrinho Mercado Livre" account with the checking ledger account → 422 `validation`, field `account_id`. Map the checking account; add a third reserved balance "Viagem" to the fake server; `POST /api/v1/connections/<id>/sync` → `GET /api/v1/connections/<id>` lists four accounts, "Viagem" `pending`, the checking account still `mapped`. Then `PUT` "Cofrinho Mercado Livre" with reserve "MP Cofrinho" (`h.Account("MP Cofrinho", "asset", "reserve", nil)`) and `sync_from` 2026-11-11 → 200 `mapped` (no reserve is mapped during the sync: reading a reserve arrives in Task 3). A Nubank item with no reserved balance lists only its own accounts. Another user's `GET` of the connection → 404.
- [ ] **Step 2: Run** `make db-up && go test ./internal/ingestion/ -run TestS68ReservedBalanceMapping -count=1` → FAIL (two accounts listed are missing).
- [ ] **Step 3: Contract and query.** Edit `api/openapi.yaml` and `connection.sql`; run `make gen`.
- [ ] **Step 4: Implement** model, fake server, listing, compatibility and the refresh in `syncItem`.
- [ ] **Step 5: Run** the test → PASS; `go test ./internal/ingestion/... -count=1` → PASS; `make check` → exit 0.
- [ ] **Step 6: Commit** `git commit -m "feat(ingestion): list pluggy reserved balances as external accounts"`.

### Task 3: Reserve amount as a balance assertion (D2, A74, S68 sync)

**Files:**
- Modify: `internal/ingestion/aggregator.go` (`ReadAccount`)
- Modify: `internal/ingestion/internal/app/sync.go` (`syncItem` order)
- Modify: `internal/ingestion/internal/pluggy/pluggytest/server.go` (`SetItemUpdatedAt(itemID, at string)` when absent)
- Test: `internal/ingestion/reserve_test.go`

**Interfaces:**
- `ReadAccount` with an `externalID` that matches no account id searches the item's bank accounts for a reserved balance with that `identification`. Found: `domain.AccountRead{ItemStatus, ItemUpdatedAt, Balance: &domain.Balance{Date: <item last update date in the configured location>, Amount: <sum of the amounts in the parent currency, pluggy.Minor>}}` and no `Transactions` call. Not found: the same without `Balance`.
- `syncItem` syncs mapped accounts whose `Subtype` is not `RESERVED_BALANCE` first, then the reserves, each group in its stored order.

- [ ] **Step 1: Write the failing test `TestS68ReservedBalanceSync`**: the Task 2 item, item updated `2026-11-10T15:00:00Z`; reserve "MP Cofrinho" with an opening balance of 100292 dated 2026-11-10; mapping with `sync_from` 2026-11-11. Sync → the reserve's batch has `received` 0, `balance` `{status: recorded, date: 2026-11-10, amount: 100292}`; `GET /api/v1/accounts/<MP Cofrinho>/balance-assertions` → one item, source `open_finance`, `reconciled` true; `pluggytest` counts no `/v2/transactions` request for the reserve (`srv.Requests("/v2/transactions")` equals the count for the checking account only). Remove the reserved balance from the fake server, set a new item update date, sync → the reserve's batch has balance status `none` and the sync returns 200.
- [ ] **Step 2: Run** `go test ./internal/ingestion/ -run TestS68ReservedBalanceSync -count=1` → FAIL.
- [ ] **Step 3: Implement** `ReadAccount` for reserves and the order in `syncItem`.
- [ ] **Step 4: Run** the test → PASS; `go test ./internal/ingestion/... -count=1` → PASS; `make check` → exit 0.
- [ ] **Step 5: Commit** `git commit -m "feat(ingestion): assert the amount of a mapped reserved balance"`.

## Slice B (Tasks 4–6)

### Task 4: Bounded yield on reserved balances (D3, A75, S69)

**Files:**
- Modify: `internal/ledger/internal/domain/reconciliation.go` (`YieldBound`, `DecideSyncedReserve`), `reconciliation_test.go`
- Modify: `internal/ledger/internal/app/reconciliation.go` (`AssertSynced` with `reserve` true)
- Modify: `internal/ledger/ledger.go` (`AssertSyncedReserve`)
- Modify: `internal/ingestion/ingestion.go` (`ledgerPort.AssertSyncedReserve`), the app port declaring `AssertSyncedBalance`, `internal/ingestion/internal/app/sync.go`
- Test: `internal/ledger/internal/domain/reconciliation_test.go`, `internal/ingestion/reserve_test.go`

**Interfaces:**
- `const reserveYieldPercentPer30Days = 2`
- `func YieldBound(settled int64, days int) int64`: 0 when `settled <= 0`; else `floor(settled × 2 × max(days, 1) / 3000)` computed with `math/big`.
- `func DecideSyncedReserve(asserted, settled int64, days int, mode YieldMode) AssertionOutcome`: `days == 0` means no previous assertion. Difference 0 → `ResolutionNone`; `mode == YieldAuto`, `days > 0` and `0 < diff ≤ YieldBound(settled, days)` → `ResolutionYield` with `Yield: diff`; else open.
- `AssertSynced(..., reserve true)`: `days` is the number of days between `date` and the latest assertion dated before `date`; the yield transaction uses `recordYield(ctx, r, a, prev.Date+1, date, diff)`. Applies to the insert path and to the re-decision path of Task 1.
- `func (m *Module) AssertSyncedReserve(ctx context.Context, userID int64, accountID uuid.UUID, date time.Time, amount money.Money) error`; ingestion port method of the same shape; `syncAccount` calls it when `ext.Subtype == "RESERVED_BALANCE"`.

- [ ] **Step 1: Write the failing table test `TestYieldBound`**: `(100000, 1) → 66`, `(100292, 1) → 66`, `(100000, 30) → 2000`, `(102000, 3) → 204`, `(100000, 0) → 66`, `(0, 5) → 0`, `(-5, 5) → 0`, `(9007199254740991, 36500) → 219175181865364114`; and `TestDecideSyncedReserve`: `(100352, 100292, 1, auto) → yield 60`, `(100392, 100292, 1, auto) → open 100`, `(100200, 100292, 1, auto) → open −92`, `(100352, 100292, 0, auto) → open 60`, `(100352, 100292, 1, none) → open 60`, `(100292, 100292, 0, auto) → none`.
- [ ] **Step 2: Write the failing test `TestS69BoundedReserveYield`** on the S68 setup after the 2026-11-10 assertion: item updated 2026-11-11, amount `1003.52` → sync → assertions list has the 2026-11-11 item `reconciled` true; the account's transactions include "Yield 2026-11-11 to 2026-11-11" with MP Cofrinho +60 and Yield −60. Item updated 2026-11-12, amount `1004.52` → the 2026-11-12 assertion is `reconciled` false and the account's reconciliation status (`ReconciliationStatus`) shows an open difference of 100. Subtest: a reserve with `yield_mode` `none` and the same amounts → no yield transaction, the 2026-11-11 difference 60 stays open.
- [ ] **Step 3: Run** `go test ./internal/ledger/internal/domain/ -run 'TestYieldBound|TestDecideSyncedReserve' -count=1` and `go test ./internal/ingestion/ -run TestS69 -count=1` → FAIL (undefined functions; no yield).
- [ ] **Step 4: Implement** the domain functions, `AssertSynced` with `reserve`, the module and port methods, the call in `syncAccount`.
- [ ] **Step 5: Run** both tests → PASS; `go test ./internal/ledger/... ./internal/ingestion/... -count=1` → PASS (`TestSyncBalanceRecordsNoYield` unchanged); `make check` → exit 0.
- [ ] **Step 6: Commit** `git commit -m "feat(ingestion): book bounded yield on synced reserved balances"`.

### Task 5: Transfers between checking and a reserved balance (D4, A76, S70)

**Files:**
- Modify: `internal/ingestion/internal/pluggy/model.go` (`Transaction.OperationType *string`), `normalize.go` (`ReserveName`, raw `operation_type`), `normalize_test.go`
- Modify: `internal/ingestion/internal/pluggy/pluggytest/server.go` only if `AddTransaction` drops the new field
- Modify: `internal/ingestion/internal/domain/record.go` (`NormalizedRecord.ReserveName string`)
- Modify: `internal/ingestion/internal/app/importer.go` (`Line.TransferTo *uuid.UUID`), `sync.go` (resolution of `ReserveName`)
- Modify: `internal/ingestion/ingestion.go` (`ledgerPort`: a line with `TransferTo` gets `&ledger.ImportDecision{TransferTo: *l.TransferTo, Cause: ledger.Cause{Method: "source"}}` instead of the classification decision)
- Test: `internal/ingestion/internal/pluggy/normalize_test.go`, `internal/ingestion/reserve_test.go`

**Interfaces:**
- `Normalize` sets `ReserveName` when `OperationType` is `TRANSFERENCIA_SALDO_RESERVADO` and the description is `"Dinheiro reservado " + name` with a negative record amount or `"Dinheiro retirado " + name` with a positive one; `name` is the remainder, not trimmed further; else empty.
- `syncAccount` (bank accounts only) builds `name → ledger account id` from the connection's mapped `RESERVED_BALANCE` external accounts, dropping names held by two of them; a record whose `ReserveName` resolves and whose date is on or after that external account's `SyncFrom` gets `Line.TransferTo`. The field travels on the path that creates transactions only; matched lines are unchanged.

- [ ] **Step 1: Write the failing table test `TestNormalizeReserveTransfer`**: (`TRANSFERENCIA_SALDO_RESERVADO`, "Dinheiro reservado Cofrinho Mercado Livre", `-2000`) → "Cofrinho Mercado Livre"; (same, "Dinheiro retirado Algum dinheiro", `2000`) → "Algum dinheiro"; (same, "Dinheiro reservado X", `10`) → ""; (`PIX`, "Dinheiro reservado X", `-10`) → ""; (nil operation type) → "".
- [ ] **Step 2: Write the failing test `TestS70ReserveTransfers`**: Mercado Pago checking mapped from 2026-11-01 with an opening balance; "Cofrinho Mercado Livre" → "MP Cofrinho" and "Algum dinheiro" → "MP Algum dinheiro", both from 2026-11-11 with opening balances dated 2026-11-10. Checking lines: 2026-11-11 "Dinheiro reservado Cofrinho Mercado Livre" −200.00; 2026-11-11 "Dinheiro retirado Algum dinheiro" +100.00; 2026-11-11 "Dinheiro retirado Aaa" +50.00; 2026-11-10 "Dinheiro reservado Cofrinho Mercado Livre" −30.00; all with `operationType` `TRANSFERENCIA_SALDO_RESERVADO`. Sync → the first line's transaction has postings Mercado Pago −20000, MP Cofrinho +20000; the second Mercado Pago +10000, MP Algum dinheiro −10000; the third and fourth have no posting on a reserve. A second sync creates no transaction (`created` 0).
- [ ] **Step 3: Run** `go test ./internal/ingestion/internal/pluggy/ -run TestNormalizeReserveTransfer -count=1` and `go test ./internal/ingestion/ -run TestS70 -count=1` → FAIL.
- [ ] **Step 4: Implement** the model field, normalization, resolution in `syncAccount`, `Line.TransferTo` and the decision in `ledgerPort`.
- [ ] **Step 5: Run** both tests → PASS; `go test ./internal/ingestion/... -count=1` → PASS; `make check` → exit 0.
- [ ] **Step 6: Commit** `git commit -m "feat(ingestion): book reserved balance movements as transfers"`.

### Task 6: Documentation (A73–A77, S68–S71)

**Files:**
- Modify: `docs/domain/06-scenarios.md` (section 6.15: the Mercado Pago item sentence and S68–S71 from the spec, after S59)
- Modify: `docs/domain/05-domain-model.md` (the "Account mapping" row: `RESERVED_BALANCE` to reserve)
- Modify: `docs/operations/pluggy.md` (spec section "Operations doc")

- [ ] **Step 1: Edit** the three files. `docs/operations/pluggy.md` gains the section "Reserved balances" after section 4, the opening-balance step in section 5 (steps renumbered), and the A73–A77 reference in the introduction next to A33–A45.
- [ ] **Step 2: Check** `grep -n 'S68\|S69\|S70\|S71' internal/ingestion/*_test.go` lists one test per scenario; `make check` → exit 0.
- [ ] **Step 3: Commit** `git commit -m "docs(ingestion): document pluggy reserved balances"`.
