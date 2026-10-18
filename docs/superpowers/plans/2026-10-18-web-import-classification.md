# Web Import and Classification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver file import, the review queue, classification rules, reconciliation, attachments and Pluggy connections in the web interface, with the five endpoints (B1–B5) and the per-path CSP (W14) they need.

**Architecture:** Five backend tasks come first: B1, B4 and B5 in `ingestion`, B2 in `ingestion` with the Pluggy client, B3 in `ledger`; then the W14 header in `internal/platform/spa` with the ADR amendments. The web part adds `web/src/features/{imports,classification,reconciliation,connections}/`, each importing `@/features/accounts` and `@/features/transactions` through `index.ts` only; `app/` composes cross-feature screens (`/review`, transaction extensions). Pure logic lands in one task before the screens.

**Tech Stack:** Go 1.27, sqlc, oapi-codegen; web stack of sub-projects 1–2 unchanged, plus `pluggy-connect-sdk` `2.14.2` (exact pin; dependencies `zoid` `9.0.63`, `jwt-decode` `4.0.0`; optional peer `pluggy-js` not installed).

**Spec:** `docs/superpowers/specs/2026-10-18-web-import-classification-design.md` (I1–I34, Routes, Phone ergonomics, Data, Problem codes, Backend gaps, Tests). Inherited: `docs/superpowers/specs/2026-10-17-web-foundation-ledger-design.md`, `docs/superpowers/specs/2026-10-18-web-cards-design.md`.

**Start condition:** every task of `docs/superpowers/plans/2026-10-18-web-cards.md` is committed. Task 7 relies on `web/src/app/transaction-route.tsx` and `CardTransactionPanel`; Task 18 relies on `web/src/features/cards/statement-page.tsx`; Task 22 relies on `web/src/app/routes-responsive.test.tsx`.

## Global Constraints

- Every Global Constraint of `docs/superpowers/plans/2026-10-18-web-cards.md` applies (Slotted docs and skills read before a screen, O1 `react/no-multi-comp`, O6 no literal JSX text, kebab-case files, pt-BR test strings with `writeLocale("pt-BR")`, fixed `today`, draft rules, verification commands, pre-commit handling, execution slices).
- I1: `features/{imports,classification,reconciliation,connections}` import only `@/features/accounts` and `@/features/transactions` among features; none of the four imports another of the four or `@/features/cards`. Task 18 edits `features/cards`, which imports none of the four. Cross-feature composition lives in `web/src/app/`.
- Every new route is registered in `web/src/app/router.tsx` under `authedRoute`; search params are validated with `validateSearch`.
- Query keys and invalidations are exactly the Data tables of the spec. I34: suggestion and categorization queries set `staleTime: 0`, `refetchOnMount: "always"`, `refetchOnWindowFocus: true`.
- Routed form drafts: `classification.rule.<ruleId | "new">`, `reconciliation.assertion.<accountId>`; the import wizard and credential forms write no storage (I4, I30).
- Client file limit: `10 * 1024 * 1024` bytes (A16), checked before any request, message `problem.request_too_large`.
- New dependency: only `pluggy-connect-sdk` `2.14.2`, added with `pnpm add -E` from inside `web/` (Task 21), recorded in ADR 010 (Task 5).
- Backend: every new query filters by `user_id` (ADR 003); each endpoint has an apitest where another user receives 404. Commit scope `ingestion` (Tasks 1–3), `ledger` (Task 4), `platform` (Task 5), `web` otherwise.
- Each spec scenario ID appears in the name of the web flow test that covers it.
- Each screen task ends with a jsdom responsive test at 360, 768 and 1280 (`setViewport` from `@/testing/viewport`) and a manual note: the route at the three widths in devtools, no horizontal scroll.

## Review Focus

1. A file named `EXTRATO.OFX` or `extrato.Csv` selects its format by extension case-insensitively; `extrato` (no extension) shows the format select. Test: Task 6, `importFormat` rows `upper case`, `no extension`.
2. A CSV exported with a UTF-8 BOM yields a first header option `Data`, not `﻿Data`. Test: Task 6, `columnOptions` row `strips BOM`.
3. A double tap on Confirm sends one `importFile` request. Test: Task 9, `confirms once`.
4. With more rules than one page, reorder posts every rule id; move up on the first row and move down on the last row are disabled. Test: Task 14, `reorders across pages`.
5. Pluggy Connect calling `onClose` after `onSuccess` posts `createConnection` once and navigates to the connection, not back. Test: Task 21, `close after success`.

## Spec ambiguities resolved

| Topic | Resolution |
|---|---|
| apitest Pluggy option | Present: `apitest.Pluggy(url)` (`internal/apitest/apitest.go:89`) with `pluggytest.New` (`internal/ingestion/internal/pluggy/pluggytest/server.go`). Task 3 adds `/connect_token` to `pluggytest`; no harness change. |
| W14 directives | Read from `pluggy-connect-sdk@2.14.2`: the iframe loads `https://connect.pluggy.ai` (`dist/module/pluggy-connect.js:22`); the container template appends a `<style>` element without nonce (`pluggy-connect.js:212`), which `default-src 'self'` blocks. W14 = W12 + `frame-src https://connect.pluggy.ai` + `style-src 'self' 'unsafe-inline'`. No `script-src` or `connect-src` change: the SDK is bundled, `utils/oauth.js` only compares URL prefixes, and `zoid/dist/zoid.frameworks.frame.js` contains no `eval(` or `new Function`. |
| SDK API | `new PluggyConnect(props).init(): Promise<void>`; `destroy()` on unmount; `onSuccess({ item })`, `onError(error)`, `onClose()`; update mode prop `updateItem`. Types import `pluggy-js` (absent); `skipLibCheck: true` makes them `any`, so `connections/pluggy-widget.ts` declares `ConnectItem = { id: string; connector: { name: string } }`. |
| I11 `source` values | The backend accepts `manual\|import\|schedule` (`internal/classification/internal/domain/rule.go:79`); the select lists those three. |
| I11 operators | From `conditionShape` (`rule.go:241`): `description`, `raw_description` → `equals, contains, starts_with, regex, in_list`; `payee`, `account`, `account_kind`, `source`, `weekday` → `equals, in_list`; `amount`, `absolute_amount` → `equals, greater_than, less_than, between`; `day_of_month` → `equals, greater_than, less_than, between, in_list`; `installment` → `equals`. `in_list` on `payee`/`account` renders repeated entity pickers with an add control; on `day_of_month`, a tag input of integers 1–31. |
| I7 header names | `csvfile.Parse` keeps the last header row (`internal/ingestion/internal/csvfile/csvfile.go:28-33`), that is row `header_rows`: I7 holds unchanged. |
| B1 outcomes | A line whose dedup key exists in a state other than `received` or `withdrawn` → `ignore`; every other line is matched against unlinked postings as `importRecords` does: 0 candidates → `create`, 1 → `match` with `transaction_id`, more → `needs_review` with `candidates`. `balance` is `recorded` with the file balance when present, otherwise `none`; preview never asserts, so `skipped` does not occur. |
| B1 body limit | `internal/ingestion/ingestion.go:121` gains `POST /api/v1/accounts/{id}/import-previews` at `11 << 20`. |
| B2 Pluggy call | `POST /connect_token`, header `X-API-KEY`, body `{"itemId": "<item>"}` in update mode and `{}` otherwise; response `{"accessToken": "..."}`. Another user's integration → 404; a connection of another integration or another user → 422 field `connection_id`. |
| B3 amount | Equal to the A29 query amount (the opposite side on `account_id`); currency of `account_id`. Validation errors of `domain.Transaction.Transfer` (voided, no category posting, invalid account) return as `transferTransaction` returns them. |
| B4 unknown account | `ListBatches` calls `Ledger.ImportTarget` first: another user's account → 404 `not_found`. |
| B5 order and currency | `booked_on DESC, id DESC`, keyset cursor on both; `amount.currency` from the joined batch. |
| `formatFileSize` | Below 1024 → `"<n> B"`; below 1024² → integer KB (`"230 KB"`); otherwise one decimal in the locale (`"12.0 MB"`, `"12,0 MB"`). |
| `/review` composition | `web/src/app/review-page.tsx` composes `ReviewRecords` (imports), `UncategorizedReview` and `SuggestionReview` (classification); I9 default tab uses `reviewRecordsQuery`, `uncategorizedCountQuery` and `suggestionsQuery("pending")`. |
| Problem pt-BR | `request_too_large` "O arquivo excede 10 MB."; `record_resolved` "Esta linha já foi resolvida."; `already_matched` "Essa transação já está vinculada a outra linha."; `not_categorizable` "Esta transação não tem categoria a definir."; `pairing_ambiguous` "Várias transações importadas podem formar par com esta. Escolha uma."; `suggestion_closed` "Esta sugestão já foi aceita ou descartada."; `already_reconciled` "A conta já está conciliada após esta data. Desbloqueie-a primeiro."; `difference_remains` "O saldo ainda difere do valor da instituição."; `integration_unavailable` "Conexões bancárias indisponíveis: o servidor não tem EQUORI_SECRET_KEY."; `integration_in_use` "Desconecte primeiro os bancos desta integração."; `provider_unauthorized` "A Pluggy rejeitou estas credenciais."; `provider_unavailable` "A Pluggy não respondeu. Tente novamente mais tarde." |

## File Structure

```
api/openapi.yaml                                   B1–B5 operations and schemas
db/queries/ingestion/{batch.sql,record.sql}        ListBatches account filter, ListReviewRecords
db/queries/ledger/transfer.sql                     PairingCandidates returns rows
internal/ingestion/ingestion.go                    body limit
internal/ingestion/aggregator.go                   ConnectToken
internal/ingestion/internal/app/{service.go,review.go,importer.go,preview.go,integration.go,connect_token.go}
internal/ingestion/internal/adapter/postgres/{batch.go,record.go}
internal/ingestion/internal/adapter/httpapi/{server.go,review.go,import.go,integration.go}
internal/ingestion/internal/pluggy/{client.go,pluggytest/server.go}
internal/ingestion/{import_history_test.go,review_queue_test.go,preview_test.go,connect_token_test.go}
internal/ledger/internal/app/{ports.go,transfer.go,pairing.go}
internal/ledger/internal/adapter/{postgres/import.go,httpapi/server.go}
internal/ledger/pairing_candidates_test.go
internal/platform/spa/{spa.go,spa_test.go}; internal/server/web_test.go
docs/adr/{008-web-interface.md,008-integration-credentials.md,010-web-ui-stack.md}
web/src/i18n/{format.ts,format.test.ts,catalog.en.ts,catalog.pt-BR.ts}
web/src/testing/{import-api.ts,classification-api.ts,connection-api.ts}
web/src/app/{router.tsx,transaction-route.tsx,review-page.tsx,review-page.test.tsx,shell/*,routes-responsive.test.tsx}
web/src/features/transactions/{transaction-page.tsx,transfer-dialog.tsx,attachment-section.tsx,attachment-row.tsx,api.ts,index.ts}
web/src/features/imports/        index.ts, api.ts, import-format.ts, csv-columns.ts, wizard and batch screens
web/src/features/classification/ index.ts, api.ts, rule-fields.ts, reorder.ts, panel, review tabs, rules screens
web/src/features/reconciliation/ index.ts, api.ts, reconciliation-page and dialogs
web/src/features/connections/    index.ts, api.ts, provider-tone.ts, document-guard.ts, pluggy-widget.ts, screens
web/src/features/cards/{statement-page.tsx,reconcile-statement-dialog.tsx}
```

---

### Task 1: B4 and B5, import history by account and the review queue

**Files:**
- Modify: `api/openapi.yaml` (`listImportBatches` gains query `account_id` uuid; path `/external-records` `get`, `operationId: listExternalRecords`, query `state` enum `[needs_review]` required, `limit`, `cursor`, response `ExternalRecordList`)
- Modify: `db/queries/ingestion/batch.sql` (`ListBatches`: `AND (sqlc.narg(account_id)::uuid IS NULL OR account_id = sqlc.narg(account_id)::uuid)`), `db/queries/ingestion/record.sql` (`ListReviewRecords`)
- Modify: `internal/ingestion/internal/app/{service.go,review.go}`, `internal/ingestion/internal/adapter/postgres/{batch.go,record.go}`, `internal/ingestion/internal/adapter/httpapi/{server.go,review.go}`
- Test: `internal/ingestion/import_history_test.go`, `internal/ingestion/review_queue_test.go`

**Interfaces:**
- Produces: `(*Service).ListBatches(ctx context.Context, userID int64, accountID uuid.UUID, p page.Request[BatchKey])` (`uuid.Nil` = all accounts); `Repository.ListBatches` gains `accountID uuid.UUID`.
- Produces: `type ReviewKey struct { Date time.Time \`json:"rd"\`; ID uuid.UUID \`json:"ri"\` }`, `type ReviewRecord struct { Record domain.ExternalRecord; Currency string }`, `(*Service).ReviewRecords(ctx, userID int64, p page.Request[ReviewKey]) ([]ReviewRecord, *ReviewKey, error)`, `Repository.ReviewRecords` with the same shape.
- Produces (web): `GET /import-batches?account_id=`, `GET /external-records?state=needs_review`.

- [ ] **Step 1: Write the failing tests.** `TestImportHistoryByAccount`: import one OFX into checking and one into savings (`apitest.UploadWith` through `internal/apitest/ofx.go`); `?account_id=<checking>` → exactly the checking batch; no parameter → both; `h.Login("other@example.com")` with `?account_id=<checking>` → 404 `not_found`. `TestReviewQueueS35`: the S35 setup of `internal/ingestion/review_test.go` → `GET /external-records?state=needs_review` lists the record with both `candidates`; after `POST /external-records/{id}/resolve` `{action: "match", transaction_id}` → `items` is `[]`; another user → `items` is `[]`; `state=matched` → 400 `invalid_request`. Two review records on different dates list newest first; `limit=1` returns `next_cursor` and the second page holds the other record.
- [ ] **Step 2: Run** `make db-up && go test ./internal/ingestion/ -run 'TestImportHistoryByAccount|TestReviewQueueS35' -count=1` → FAIL.
- [ ] **Step 3: Contract and queries.** `ListReviewRecords :many`: `SELECT r.*, b.currency FROM ingestion_external_record r JOIN ingestion_batch b ON b.id = r.batch_id AND b.user_id = r.user_id WHERE r.user_id = @user_id AND r.state = 'needs_review' AND (sqlc.narg(after_date)::date IS NULL OR (r.booked_on, r.id) < (sqlc.narg(after_date)::date, sqlc.narg(after_id)::uuid)) ORDER BY r.booked_on DESC, r.id DESC LIMIT @row_limit;`. Run `make gen`.
- [ ] **Step 4: Implement** the service, repository and handlers; `ListBatches` with a non-nil account calls `s.ledger.ImportTarget` first; records map through `toRecordAPI(r.Record, r.Currency)`.
- [ ] **Step 5: Run** the tests → PASS; `make check` → exit 0.
- [ ] **Step 6: Commit** `git commit -m "feat(ingestion): filter import batches by account and list records to review"`.

### Task 2: B1, import preview

**Files:**
- Modify: `api/openapi.yaml` (path `/accounts/{id}/import-previews` `post`, `operationId: previewImport`, multipart as `importFile`; 200 `ImportPreview`; 413, 422, 404)
- Create: `internal/ingestion/internal/app/preview.go`
- Modify: `internal/ingestion/internal/app/importer.go` (extract `checkFile(f ImportFile) error` from `Import`), `internal/ingestion/internal/app/service.go` (`Repository.RecordsByKeys`), `internal/ingestion/internal/adapter/postgres/record.go`, `internal/ingestion/internal/adapter/httpapi/import.go`, `internal/ingestion/ingestion.go` (body limit)
- Test: `internal/ingestion/preview_test.go`

**Interfaces:**
- Produces: `ImportPreview { counts: ImportCounts, balance: ImportBalance, lines: PreviewLine[] }`, `PreviewLine { date, amount: Money, description, external_id?, outcome: ignore|match|create|needs_review, transaction_id?, candidates: uuid[] }`, all required except `external_id`, `transaction_id`; lines in file order.
- Produces: `app.Preview { Counts domain.Counts; Balance domain.FileBalance; Currency money.Currency; Lines []PreviewLine }`, `app.PreviewLine { Record domain.NormalizedRecord; Outcome string; TransactionID uuid.UUID; Candidates []uuid.UUID }`, `(*Service).Preview(ctx context.Context, f ImportFile) (Preview, error)`; `Repository.RecordsByKeys(ctx, userID int64, keys [][]byte) (map[string]domain.ExternalRecord, error)` over the existing `ListRecordsByKeys` query.

- [ ] **Step 1: Write the failing test `TestImportPreview`** (fixture of `scenarios_test.go`):

| Row | Setup | Expected |
|---|---|---|
| S32 | checking with the S32 manual transaction; preview the S32 OFX | outcomes `match` (its `transaction_id`), `create`, `create`; `balance` `{status: "recorded", amount: 283410}`; batch count (`GET /import-batches`), `GET /import-batches/{id}/records` and transaction count unchanged before and after |
| S33 | import S32, then preview the same file | three `ignore`; `counts.ignored: 3` |
| S35 | the two-candidate setup of `review_test.go` | `needs_review` with both ids in `candidates` |
| CSV without profile | `format=csv` | 422, field `format` |
| other user | another user's account | 404 |
| too large | 11 MiB body | 413 `request_too_large` |

- [ ] **Step 2: Run** `go test ./internal/ingestion/ -run TestImportPreview -count=1` → FAIL (404 on the path).
- [ ] **Step 3: Implement `Preview`.** `checkFile`, `ImportTarget`, `read`; dedup keys with `domain.Ordinals` exactly as `importRecords`; `RecordsByKeys`; postings from `UnlinkedPostings` over the date span of the non-ignored lines ± `domain.MatchWindow`; `domain.Candidates` with a local `taken` map. No `LockAccountImports`, no write. Run `make gen`; handler `PreviewImport` reuses `readForm`.
- [ ] **Step 4: Run** → PASS; `go test ./internal/ingestion/ -count=1` → PASS (Import unchanged after the `checkFile` extraction); `make check` → exit 0.
- [ ] **Step 5: Commit** `git commit -m "feat(ingestion): preview a file import without writing"`.

### Task 3: B2, Pluggy connect tokens

**Files:**
- Modify: `api/openapi.yaml` (path `/integrations/{id}/connect-tokens` `post`, `operationId: createConnectToken`, body `{ connection_id?: uuid }`, 201 `{ connect_token: string }`; 404, 409, 422, 502)
- Modify: `internal/ingestion/internal/pluggy/client.go` (`(*Session).post`, `(*Session).ConnectToken`), `internal/ingestion/internal/pluggy/pluggytest/server.go` (`/connect_token`, `ConnectTokenItems() []string`)
- Modify: `internal/ingestion/aggregator.go`, `internal/ingestion/internal/app/integration.go` (`Aggregator.ConnectToken`)
- Create: `internal/ingestion/internal/app/connect_token.go`
- Modify: `internal/ingestion/internal/adapter/httpapi/integration.go`
- Test: `internal/ingestion/connect_token_test.go`, `internal/ingestion/internal/pluggy/client_test.go`

**Interfaces:**
- Produces: `(*Session).ConnectToken(ctx context.Context, itemID string) (string, error)` (label `POST /connect_token`); `Aggregator.ConnectToken(ctx, integrationID uuid.UUID, c domain.Credentials, itemID string) (string, error)` through `pluggyPort.session`; `(*Service).ConnectToken(ctx, userID int64, integrationID, connectionID uuid.UUID) (string, error)` (`connectionID` `uuid.Nil` = create mode): `available()`, `Integration`, `credentials`, then `Connection` when given and `IntegrationID` check.
- Produces: `pluggytest` answers `POST /connect_token` with `{"accessToken":"connect-<n>"}` and records the `itemId` of each request (empty string when absent).

- [ ] **Step 1: Write the failing tests.** `TestConnectToken` (setup `newAggregatorSetup` style of `connection_test.go`): create mode → 201 `connect_token` `"connect-1"`, `ConnectTokenItems()` = `[""]`, `Requests("/connect_token")` = 1; update mode with the Nubank connection → `itemId` recorded equal to `nubankItem`; a connection of a second integration → 422 field `connection_id`; another user's integration → 404; harness without `apitest.Pluggy` → 409 `integration_unavailable`; `p.SetCredentials` to other values (rejected) → 422 `provider_unauthorized`; `p.FailNext(503, 3)` → 502 `provider_unavailable`; the response body does not contain the client secret or the API key. `client_test.go`: `TestConnectToken` asserts header `X-API-KEY` and body `{"itemId":"item-1"}`.
- [ ] **Step 2: Run** `go test ./internal/ingestion/... -run TestConnectToken -count=1` → FAIL.
- [ ] **Step 3: Implement** the client method, fake route, port, service and handler; `make gen`.
- [ ] **Step 4: Run** → PASS; `make check` → exit 0.
- [ ] **Step 5: Commit** `git commit -m "feat(ingestion): create Pluggy connect tokens for the Connect widget"`.

### Task 4: B3, transfer pairing candidates

**Files:**
- Modify: `api/openapi.yaml` (path `/transactions/{id}/pairing-candidates` `get`, `operationId: listPairingCandidates`, required query `account_id`; 200 `PairingCandidateList { items: [{ transaction_id, date, amount: Money, description }] }`)
- Modify: `db/queries/ledger/transfer.sql` (`PairingCandidates` selects `t.id, t.date, t.description`)
- Modify: `internal/ledger/internal/app/{ports.go,transfer.go}`, `internal/ledger/internal/adapter/postgres/import.go`, `internal/ledger/internal/adapter/httpapi/server.go`
- Create: `internal/ledger/internal/app/pairing.go`
- Test: `internal/ledger/pairing_candidates_test.go`

**Interfaces:**
- Produces: `app.PairingCandidate { ID uuid.UUID; Date time.Time; Description string }`; `Repository.PairingCandidates(ctx, q PairingQuery) ([]PairingCandidate, error)` (`pairingCandidate` in `transfer.go` reads `.ID`); `(*Service).PairingCandidates(ctx context.Context, userID int64, transactionID, accountID uuid.UUID) ([]PairingCandidate, int64, money.Currency, error)`: loads the transaction, `transferAccounts`, `t.Transfer(t.Version, target, uuid.Nil, accounts)` and builds the same `PairingQuery`; returns the query amount and the target currency.

- [ ] **Step 1: Write the failing test `TestPairingCandidates`** (setups of `internal/ledger/transfer_test.go`): S47 → one item with the imported card transaction's `transaction_id`, `date`, `description`, `amount` equal to its card posting; S48 → two items ordered by `date`; S50 → `items: []`; a voided transaction → 409 `transaction_voided`; another user's transaction → 404; `account_id` missing → 400 `invalid_request`. After the test, `go test ./internal/ledger/ -run TestTransfer -count=1` still passes.
- [ ] **Step 2: Run** `go test ./internal/ledger/ -run 'TestPairingCandidates|TestTransfer' -count=1` → FAIL on the new test.
- [ ] **Step 3: Implement**; `make gen`.
- [ ] **Step 4: Run** → PASS; `make check` → exit 0.
- [ ] **Step 5: Commit** `git commit -m "feat(ledger): list the pairing candidates of a transfer"`.

### Task 5: W14 policy on the connect page and ADR amendments

**Files:**
- Modify: `internal/platform/spa/spa.go`, `internal/platform/spa/spa_test.go`, `internal/server/web_test.go`
- Modify: `docs/adr/008-web-interface.md` (W14), `docs/adr/008-integration-credentials.md` (K5), `docs/adr/010-web-ui-stack.md` (dependency row)

**Interfaces:**
- Produces: `spa.ConnectPath = "/connections/connect"`, `spa.ConnectPolicy = "default-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'; frame-src https://connect.pluggy.ai; style-src 'self' 'unsafe-inline'"`. `Handler` sets `Content-Security-Policy` to `ConnectPolicy` before writing `index.html` when `path.Clean("/"+r.URL.Path) == ConnectPath`; the header set by `internal/platform/httpserver/middleware.go:52` stays for every other path.

- [ ] **Step 1: Read the package source.** `mkdir -p /tmp/claude-1000/pluggy-probe && cd /tmp/claude-1000/pluggy-probe && npm pack pluggy-connect-sdk@2.14.2 zoid@9.0.63`, extract each into its own directory, then `grep -rhoE "https?://[a-zA-Z0-9._/-]+" dist` and `grep -n "createElement('style')\|nonce" dist/module/pluggy-connect.js`. Expected: the only loaded origin is `https://connect.pluggy.ai`; the container `<style>` carries no nonce. A different result changes `ConnectPolicy` to the list found, recorded in the commit body.
- [ ] **Step 2: Write the failing tests.** `spa_test.go` `TestConnectPolicy`: with a header pre-set to the W12 value, `GET /connections/connect` and `/connections/connect/` → `ConnectPolicy` and the `index.html` body; `GET /`, `/connections`, `/connections/connect-x`, `/assets/app.js` keep the pre-set value. `internal/server/web_test.go`: `/connections/connect` through the full handler carries `frame-src https://connect.pluggy.ai`; `/` carries the W12 value.
- [ ] **Step 3: Run** `go test ./internal/platform/spa/ ./internal/server/ -run 'TestConnectPolicy|TestWeb' -count=1` → FAIL.
- [ ] **Step 4: Implement** in `spa.go`.
- [ ] **Step 5: ADRs.** 008-web-interface row `W14`: path `/connections/connect`, the two added directives, origin `https://connect.pluggy.ai`, reason (Pluggy Connect iframe and its unnonced container style), every other path W12. 008-integration-credentials K5 appends: "A Pluggy connect token, valid for one Connect session, is returned to the owner's browser; the client secret and API keys are not." 010 table row: `pluggy-connect-sdk` | 2.14.2 | dependency | Pluggy Connect widget (I23).
- [ ] **Step 6: Run** → PASS; `make check` → exit 0.
- [ ] **Step 7: Commit** `git commit -m "feat(platform): allow the Pluggy Connect frame on the connect page"`.

### Task 6: Web logic, format and catalog

**Files:**
- Create: `web/src/features/imports/{import-format.ts,import-format.test.ts,csv-columns.ts,csv-columns.test.ts}`, `web/src/features/classification/{rule-fields.ts,rule-fields.test.ts,reorder.ts,reorder.test.ts}`, `web/src/features/connections/{provider-tone.ts,provider-tone.test.ts,document-guard.ts,document-guard.test.ts}`
- Modify: `web/src/i18n/{format.ts,format.test.ts,catalog.en.ts,catalog.pt-BR.ts}`

**Interfaces:**
- Produces:
  - `importFormat(fileName: string): "ofx" | "csv" | undefined` (I5, extension lower-cased); `maxFileBytes = 10 * 1024 * 1024`.
  - `columnOptions(text: string, delimiter: string, headerRows: number): { value: string; label: string }[]` (I7: names of line `headerRows` with BOM stripped and trimmed; `"1".."n"` when 0, n = fields of line 1); `sampleRows(text: string, delimiter: string, count = 6): string[][]`; `delimiterChar(d: "comma" | "semicolon" | "tab" | "pipe"): string`.
  - `operatorsFor(field: RuleField): RuleOperator[]` and `valueInput(field: RuleField, operator: RuleOperator): "text" | "tags" | "payee" | "payees" | "currency" | "currency-range" | "account" | "accounts" | "account-kind" | "source" | "weekday" | "day" | "days" | "day-range" | "switch"` (resolved table); `ruleSources = ["manual", "import", "schedule"]`.
  - `moveID(ids: string[], id: string, delta: -1 | 1): string[]` (I13; unchanged array at a boundary).
  - `providerTone(status: string | undefined): { tone: "positive" | "neutral" | "warning"; busy: boolean; reconnect: boolean }` (I28).
  - `needsDocumentLoad(entries: PerformanceEntryList, path: string): boolean` (I25: true when the first navigation entry's URL path differs from `path` or no entry exists).
  - `formatFileSize(bytes: number, locale: Locale): string`.
  - Catalog: the twelve `problem.<code>` keys with the spec's en messages and the resolved pt-BR messages.

- [ ] **Step 1: Write the failing tests.**
  - `importFormat`: `extrato.ofx`, `extrato.qfx` → `ofx`; `extrato.csv`, `extrato.txt` → `csv`; **upper case** `EXTRATO.OFX` → `ofx`; **no extension** `extrato` → `undefined`; `extrato.pdf` → `undefined`.
  - `columnOptions`: S34 sample `"Data;Descrição;Valor\n05/10/2026;PADARIA;-12,50"`, `";"`, `1` → labels `Data`, `Descrição`, `Valor`; `headerRows 0` → `1`, `2`, `3`; `headerRows 2` with two header lines → names of line 2; **strips BOM** `"﻿Data;Valor"` → first label `Data`.
  - `operatorsFor`: one row per field of the resolved table; `valueInput("amount", "between")` → `currency-range`; `("payee", "in_list")` → `payees`; `("day_of_month", "in_list")` → `days`; `("description", "in_list")` → `tags`; `("installment", "equals")` → `switch`.
  - `moveID(["a","b","c"], "b", -1)` → `["b","a","c"]`; `("a", -1)` and `("c", 1)` → unchanged.
  - `providerTone`: `UPDATED` → positive; `UPDATING` → neutral, busy; `LOGIN_ERROR`, `OUTDATED`, `WAITING_USER_INPUT` → warning, reconnect; `MERGING` and `undefined` → neutral.
  - `needsDocumentLoad`: entry `http://x/connections/connect?integration_id=1` with path `/connections/connect` → false; entry `http://x/connections` → true; `[]` → true.
  - `formatFileSize`: `512` → `"512 B"`; `235520` → `"230 KB"`; `12582912` → `"12.0 MB"` (en), `"12,0 MB"` (pt-BR).
- [ ] **Step 2: Run** `cd web && pnpm vitest run src/features/imports src/features/classification src/features/connections src/i18n/format.test.ts` → FAIL.
- [ ] **Step 3: Implement.** `RuleField` and `RuleOperator` come from `components["schemas"]["RuleCondition"]` in `@/api/schema.gen`.
- [ ] **Step 4: Run** → PASS; `make web-check` → exit 0.
- [ ] **Step 5: Commit** `git commit -m "feat(web): add import, rule and connection logic"`.

### Task 7: Transaction extensions and the transfer dialog

**Files:**
- Create: `web/src/features/transactions/{transfer-dialog.tsx,transfer-dialog.test.tsx}`
- Modify: `web/src/features/transactions/{transaction-page.tsx,transaction-actions.tsx,api.ts,index.ts}`, `web/src/app/transaction-route.tsx`, catalogs

**Interfaces:**
- Consumes: B3 (`listPairingCandidates`), `transferTransaction`.
- Produces: `TransactionPage` prop `extensions: ComponentType<{ transaction: Transaction }>[]` rendered in array order (I2); `transaction-route.tsx` passes `[CardTransactionPanel]` (Task 12 appends `CategorizationPanel`). `pairingCandidatesQuery(api, transactionId, accountId)` (key `[...transactionKeys.detail(t), "pairing-candidates", a]`); `useTransferTransaction()` with the spec's invalidation; `TransferDialog` props `{ transaction: Transaction; open: boolean; onOpenChange(open: boolean): void }`, exported from `index.ts`.

- [ ] **Step 1: Write the failing tests** (`today` 2026-10-20).
  - **S47**: one candidate is shown preselected; submit posts `{"expected_version":1,"account_id":"<card>","pair_with":"<id>"}`; the result `voided_transaction_id` shows a toast naming the paired description.
  - **S48**: two candidates in date order, none selected, submit disabled until a choice; then the body carries the chosen `pair_with`. **`pairing_ambiguous`** 409 renders its catalog message.
  - **S50**: zero candidates → the "a transfer posting is created" text; body `{"expected_version":1,"account_id":"<savings>"}` without `pair_with`.
  - The account picker excludes the transaction's own accounts and category accounts; changing the account clears the selected candidate. The Transfer action is absent on a voided transaction and on one without category postings.
  - Extensions: two stub components render in order after the details.
  - Responsive: at 360 the dialog renders as a bottom `Drawer`; at 768 and 1280 a `Dialog`.
- [ ] **Step 2: Run** `cd web && pnpm vitest run src/features/transactions src/features/cards` → FAIL on the new tests.
- [ ] **Step 3: Implement** (`Dialog`/`Drawer`, `RadioGroup`, entity picker of `accountsQuery`).
- [ ] **Step 4: Run** → PASS (card panel tests unchanged); `make web-check` → exit 0; responsive manual note.
- [ ] **Step 5: Commit** `git commit -m "feat(web): turn a transaction into a transfer with pairing"`.

### Task 8: Attachments

**Files:**
- Create: `web/src/features/transactions/{attachment-section.tsx,attachment-row.tsx,attachment-section.test.tsx}`
- Modify: `web/src/features/transactions/{transaction-page.tsx,api.ts}`, catalogs

**Interfaces:**
- Produces: `attachmentsQuery(api, transactionId)`, `useCreateAttachment()` (multipart `file`), `useDeleteAttachment()`; `AttachmentSection` props `{ transactionId: string }`; thumbnail `src` from `URL.createObjectURL` of `getAttachmentContent`, revoked on unmount; open link `href="/api/v1/attachments/<id>/content"` `target="_blank"` `rel="noopener"`.

- [ ] **Step 1: Write the failing tests.** **S31**: a 235520-byte `recibo.pdf` posts multipart with field `file` and the list renders `recibo.pdf`, `application/pdf`, `230 KB`; a 12 MiB file renders `problem.request_too_large` and `fetch.calls` holds no attachment request; a server 413 renders the same message; `image/png` rows render an `img`; delete opens an `AlertDialog` and confirm sends `DELETE /attachments/<id>`; the upload input `accept` equals `application/pdf,image/jpeg,image/png,image/webp,text/plain`. Responsive at 360/768/1280: rows stack name over metadata at 360.
- [ ] **Step 2–4:** Run `cd web && pnpm vitest run src/features/transactions/attachment-section.test.tsx` → FAIL; implement (`upload` family, `List`, `AlertDialog`); run → PASS; `make web-check` → exit 0; responsive manual note.
- [ ] **Step 5: Commit** `git commit -m "feat(web): upload, open and delete transaction attachments"`.

### Task 9: Imports data layer and the wizard (File, Preview, Done)

**Files:**
- Create: `web/src/features/imports/{index.ts,api.ts,import-wizard-page.tsx,import-wizard-page.test.tsx,file-step.tsx,preview-step.tsx,preview-lines.tsx}`
- Create: `web/src/testing/import-api.ts`
- Modify: `web/src/app/router.tsx`, catalogs

**Interfaces:**
- Consumes: `importFormat`, `maxFileBytes`, `formatFileSize` (Task 6); `accountsQuery`, `accountKeys` (accounts); `transactionMutated`.
- Produces in `imports/api.ts`: `importKeys = { batches(a | "all"), batch(b), records(b, state), review, csvProfile(a) }`; `batchesQuery(api, accountId?)` (infinite), `batchQuery`, `recordsQuery`, `reviewRecordsQuery`, `csvProfileQuery`; `usePreviewImport()`, `useImportFile()`, `useResolveRecord()`, `useSaveCsvProfile()` with the spec's invalidations.
- Produces in `testing/import-api.ts`: S32 OFX text, S34 CSV text, `previewFixture(lines)`, `batchFixture(over)`, `recordFixture(over)`, `importRoutes(over?)` = `sharedRoutes` + import routes.
- Produces: route `/_authed/imports/new` (search `{ account_id?: string; step?: "file" | "mapping" | "preview" }`); `ImportWizardPage`; wizard state type `WizardState = { file?: File; format?: "ofx" | "csv"; accountId?: string }` local to the page.

- [ ] **Step 1: Write the failing tests** (`today` 2026-10-20).
  - **S32**: account checking, file `extrato.ofx` → no format select; Next posts B1 with `format=ofx`; Preview groups needs review, create (2), match (1), ignored collapsed, and the balance `R$ 2.834,10`; Confirm posts `importFile` with `format=ofx` and navigates to `/imports/<batchId>`.
  - **S33** (preview): the repeated file renders three ignored lines in the collapsed group.
  - **confirms once**: two clicks on Confirm → one `POST /accounts/<id>/imports`.
  - Unknown extension shows the format select; a 12 MiB file renders `problem.request_too_large` with no request; a reload at `?step=preview&account_id=<id>` restarts at File with the account kept.
  - Responsive: at 360 the stepper shows "1 de 3" in the page-header and Next sits in the bottom action-bar; at 1280 the footer is inline.
- [ ] **Step 2–4:** Run `cd web && pnpm vitest run src/features/imports/import-wizard-page.test.tsx` → FAIL; implement (`wizard`, `stepper`, `upload`, `Select`, `List`, `Collapsible`); run → PASS; `make web-check` → exit 0; responsive manual note.
- [ ] **Step 5: Commit** `git commit -m "feat(web): import a file through a previewed wizard"`.

### Task 10: CSV mapping step and CSV profile page

**Files:**
- Create: `web/src/features/imports/{csv-profile-form.tsx,csv-profile-form.test.tsx,csv-profile-page.tsx,csv-sample-table.tsx}`
- Modify: `web/src/features/imports/{import-wizard-page.tsx,index.ts}`, `web/src/app/router.tsx`, catalogs

**Interfaces:**
- Consumes: `columnOptions`, `sampleRows`, `delimiterChar`, `csvProfileQuery`, `useSaveCsvProfile`.
- Produces: `CsvProfileForm` props `{ accountId: string; sample?: string; onSaved(): void }`, used by the wizard step Mapping and by route `/_authed/accounts/$id/csv-profile`. The wizard inserts Mapping when `getCsvProfile` returns 404 for `format` `csv`; the stepper becomes "n de 4".

- [ ] **Step 1: Write the failing tests.**
  - **S34**: CSV file, profile 404 → step Mapping; delimiter `semicolon`, header rows `1`, date `Data`, layout `DD/MM/YYYY`, decimal `,`, description `Descrição`, amount mode one column `Valor` → `PUT /accounts/<id>/csv-profile` body equals exactly the S34 profile (`"delimiter":"semicolon"`, `"date_layout":"DD/MM/YYYY"`, `"decimal_separator":","`, `"header_rows":1`, `"date_column":"Data"`, `"description_column":"Descrição"`, `"amount_column":"Valor"`), then B1 is posted and Preview renders.
  - Amount mode debit/credit shows two selects and omits `amount_column`; header rows `0` lists `1`, `2`, `3`; the sample table shows at most six rows; a 422 with field `date_column` attaches to that select.
  - `/accounts/<id>/csv-profile` loads the saved profile into the form; without a file, the sample table is absent.
  - Responsive: at 360 the sample table scrolls inside its container and the page has no horizontal scroll.
- [ ] **Step 2–4:** Run → FAIL; implement (`SegmentedControl` for amount mode, `Select`, `NumberField`, `Table`); run → PASS; `make web-check` → exit 0; responsive manual note.
- [ ] **Step 5: Commit** `git commit -m "feat(web): map CSV columns during import and per account"`.

### Task 11: Import history, batch detail and record resolution

**Files:**
- Create: `web/src/features/imports/{imports-page.tsx,imports-page.test.tsx,batch-page.tsx,batch-page.test.tsx,batch-header.tsx,batch-records.tsx,resolve-record-drawer.tsx}`
- Modify: `web/src/features/imports/index.ts`, `web/src/app/router.tsx`, catalogs

**Interfaces:**
- Consumes: `batchesQuery`, `batchQuery`, `recordsQuery`, `useResolveRecord`, `transactionQuery` (transactions) through `useQueries` for candidates (I8).
- Produces: routes `/_authed/imports` (search `{ account_id?: string }`), `/_authed/imports/$batchId` (search `{ state?: RecordState | "all" }`); `ImportsPage`, `BatchPage`; `ReviewRecords` (list of B5 rows linking to `/imports/<batch_id>?state=needs_review`) exported for Task 16.

- [ ] **Step 1: Write the failing tests.**
  - **S32** (batch): counts received 3, created 2, matched 1, needs review 0 render; balance recorded links `/accounts/<id>/reconciliation`; a `skipped` balance renders its `reason`.
  - **S33** (batch): ignored 3.
  - **S35**: default filter Needs review; the record opens the drawer with both candidates (date, description, amount); choosing one posts `{"action":"match","transaction_id":"<id>"}`; Create posts `{"action":"create"}`; **`record_resolved`** and **`already_matched`** 409 render their messages.
  - **S36**: the card batch's created transaction opens at `/transactions/<id>` with the card panel role `charge` on statement `nov. de 2026`.
  - **S46**: the checking batch lists the completed transaction; opening it renders version 2.
  - **S55**: filter Withdrawn lists the old record with its `unapplied_change` alert.
  - History: `?account_id=<checking>` requests `GET /import-batches?account_id=<checking>&limit=50`; rows render source tag, file name, period and counts; a second page loads through `next_cursor`.
  - Responsive: at 360 records render two lines (description and amount; date and state tag) and the resolve UI is a bottom drawer; at 1280 a dialog.
- [ ] **Step 2–4:** Run → FAIL; implement (`List`, `SegmentedControl`, `Drawer`, `Tag`, `InlineMessage`, `StatCard`); run → PASS; `make web-check` → exit 0; responsive manual note.
- [ ] **Step 5: Commit** `git commit -m "feat(web): browse import batches and resolve their records"`.

### Task 12: Classification data layer and the categorization panel

**Files:**
- Create: `web/src/features/classification/{index.ts,api.ts,categorization-panel.tsx,categorization-panel.test.tsx}`
- Create: `web/src/testing/classification-api.ts`
- Modify: `web/src/app/transaction-route.tsx`, `web/src/features/transactions/api.ts` (`useCategorizeTransaction` adds `["classification"]`), catalogs

**Interfaces:**
- Produces in `classification/api.ts`: `classificationKeys = { rules, rule(r), aliases, sourceCategories, suggestions(state), statistics(from, to) }`; `rulesQuery(api)` (all pages), `ruleQuery`, `aliasesQuery`, `sourceCategoriesQuery`, `suggestionsQuery(api, state)`, `statisticsQuery(api, from, to)`, `categorizationQuery(api, transactionId)` (404 → `null`); mutations `useCreateRule`, `useChangeRule`, `useDeleteRule`, `useReorderRules`, `useRunRules`, `useAcceptSuggestion`, `useDismissSuggestion`, `useCreateAlias`, `useChangeAlias`, `useDeleteAlias`, `useMapSourceCategory` with the spec's invalidations; I34 options on suggestions and categorization.
- Produces: `CategorizationPanel` (`{ transaction: Transaction }`); `transaction-route.tsx` passes `[CardTransactionPanel, CategorizationPanel]`.
- Produces in `testing/classification-api.ts`: `ruleFixture(over)`, `suggestionFixture(over)`, `classificationRoutes(over?)`.

- [ ] **Step 1: Write the failing tests.** **S38** (panel): categorization `method: "history"` renders the method tag; `method: "rule"` links `/rules/<ruleId>`; 404 renders nothing; the query refetches on window focus (`fireEvent.focus(window)` → a second `GET`). **`not_categorizable`** 422 from `CategorizeDialog` renders its message. Responsive: the panel stacks below the details at 360 and 1280.
- [ ] **Step 2–4:** Run → FAIL; implement; run → PASS; `make web-check` → exit 0; responsive manual note.
- [ ] **Step 5: Commit** `git commit -m "feat(web): show how a transaction was categorized"`.

### Task 13: Rule form

**Files:**
- Create: `web/src/features/classification/{rule-form-page.tsx,rule-form-page.test.tsx,rule-form-reducer.ts,rule-form-reducer.test.ts,condition-card.tsx,condition-value.tsx,action-card.tsx,split-parts.tsx}`
- Modify: `classification/index.ts`, `web/src/app/router.tsx`, catalogs

**Interfaces:**
- Consumes: `operatorsFor`, `valueInput`, `ruleSources` (Task 6); `useCreateRule`, `useChangeRule`, `ruleQuery`; payee and account pickers from `@/features/transactions`.
- Produces: routes `/_authed/rules/new` (search `{ transaction_id?: string }`), `/_authed/rules/$ruleId`; `ruleFormReducer(state: RuleFormState, action: RuleFormAction): RuleFormState`; `toRuleBody(state: RuleFormState): RuleInput`; `ruleFieldTarget(field: string): { section: "conditions" | "actions"; index: number; name: string } | { name: string }` (I12 paths `conditions[n].*`, `actions[n].*`); draft key `classification.rule.<ruleId | "new">`.

- [ ] **Step 1: Write the failing tests.**
  - **S37**: condition `description` `contains` `uber`, action `set_category` Transport → body `conditions: [{"field":"description","operator":"contains","value":"uber"}]`, `actions: [{"type":"set_category","category_id":"<transport>"}]`, `enabled: true`, `stop_processing: false`.
  - **S39**: `stop_processing` switch on → `"stop_processing":true`.
  - **S40**: split parts Food `percent: 80` and Leisure `remainder: true` → the exact `split` action; two `remainder` parts or none disables save.
  - **S45**: action `transfer` with Itaú Visa → `{"type":"transfer","account_id":"<card>"}`. **S49**: `mark_reimbursable` lists only `receivable` accounts; Receivable Employer → `{"type":"mark_reimbursable","account_id":"<receivable>"}`.
  - `?transaction_id=<id>` prefills `description contains <description lower-cased>` and one empty `set_category` (I10).
  - Changing the field resets the operator to the first of `operatorsFor` and clears the value; `amount` `between` renders two currency fields.
  - A 422 with field `conditions[0].value` attaches to that input; `actions[1].category_id` to that picker.
  - Draft: reload of `/rules/new` restores the conditions; save clears `classification.rule.new`.
  - Responsive: at 360 conditions and actions render as stacked cards with a remove control and the add control below each stack.
- [ ] **Step 2–4:** Run → FAIL; implement; run → PASS; `make web-check` → exit 0; responsive manual note.
- [ ] **Step 5: Commit** `git commit -m "feat(web): create and edit classification rules"`.

### Task 14: Rules list, order and run

**Files:**
- Create: `web/src/features/classification/{rules-page.tsx,rules-page.test.tsx,rules-tabs.tsx,rule-row.tsx,run-rules-dialog.tsx}`
- Modify: `classification/index.ts`, `web/src/app/router.tsx`, catalogs

**Interfaces:**
- Consumes: `rulesQuery`, `moveID`, `useReorderRules`, `useChangeRule`, `useDeleteRule`, `useRunRules`.
- Produces: route `/_authed/rules`; `RulesTabs` (segmented links Rules, Aliases, Source categories, Statistics to `/rules`, `/rules/aliases`, `/rules/source-categories`, `/rules/statistics`) reused by Task 15.

- [ ] **Step 1: Write the failing tests.**
  - Rows in `priority` order show name, enabled, stop-processing tag and condition and action summaries.
  - **reorders across pages**: page 1 holds rules 1–50 with `next_cursor`, page 2 rule 51; moving rule 51 up posts `{"rule_ids":[...]}` (`RuleOrder`) with 51 ids and 51 before 50; move up on rule 1 and move down on rule 51 are disabled.
  - Enable switch sends `PATCH /rules/<id>` with `expected_version` and `enabled: false`; delete confirms through `AlertDialog`.
  - **S41**: Run rules opens a confirmation; confirm posts `POST /rules/run`; the toast renders `examined` 4 and `categorized` 2 from the response.
  - Responsive: at 360 move, enable and delete sit in a row action-sheet; at 1280 inline controls.
- [ ] **Step 2–4:** Run → FAIL; implement (`List`, `ActionSheet`, `Switch`, `AlertDialog`, `Toast`, `SegmentedControl`); run → PASS; `make web-check` → exit 0; responsive manual note.
- [ ] **Step 5: Commit** `git commit -m "feat(web): order, toggle and run classification rules"`.

### Task 15: Payee aliases, source categories and statistics

**Files:**
- Create: `web/src/features/classification/{aliases-page.tsx,alias-dialog.tsx,source-categories-page.tsx,source-category-dialog.tsx,statistics-page.tsx,statistics-months.ts,statistics-months.test.ts,rules-tabs-pages.test.tsx}`
- Modify: `classification/index.ts`, `web/src/app/router.tsx`, catalogs

**Interfaces:**
- Consumes: `aliasesQuery`, `sourceCategoriesQuery`, `statisticsQuery`, alias and source category mutations, `RulesTabs`; `formatReferenceMonth` from `@/i18n/format`. Month options come from `monthOptions(today: string): string[]` (13 months, newest last) in `classification/statistics-months.ts` with `statistics-months.test.ts`; the card month helpers stay private to `features/cards` (I1).
- Produces: routes `/_authed/rules/aliases`, `/_authed/rules/source-categories`, `/_authed/rules/statistics` (search `{ month?: string }` `YYYY-MM`).

- [ ] **Step 1: Write the failing tests.**
  - **S38** (alias): pattern `ifd*`, match type `starts_with`, payee iFood → `{"pattern":"ifd*","match_type":"starts_with","payee_id":"<ifood>"}`; edit sends `changePayeeAlias`; delete confirms.
  - **S56**: "Food Delivery" (provider, count) mapped to Food › Delivery posts `{"category_id":"<delivery>"}`.
  - **S44**: month `2026-10` requests `from=2026-10-01&to=2026-10-31` and renders total 5, rule 1, history 1, manual 2, source 0, uncategorized 1 with shares; the month select lists 13 months from `2025-10` to `2026-10`.
  - Responsive: at 360 dialogs open as bottom drawers and the statistics rows stack.
- [ ] **Step 2–4:** Run → FAIL; implement; run → PASS; `make web-check` → exit 0; responsive manual note.
- [ ] **Step 5: Commit** `git commit -m "feat(web): manage payee aliases, source categories and statistics"`.

### Task 16: Review queue

**Files:**
- Create: `web/src/features/classification/{uncategorized-review.tsx,suggestion-review.tsx,suggestion-row.tsx,accept-suggestion-dialog.tsx}`
- Create: `web/src/app/{review-page.tsx,review-page.test.tsx}`
- Modify: `classification/index.ts`, `web/src/app/router.tsx`, catalogs

**Interfaces:**
- Consumes: `ReviewRecords`, `reviewRecordsQuery` (imports); `uncategorizedCountQuery`, `CategorizeDialog`, `TransferDialog`, `TransactionList` row (transactions); `suggestionsQuery`, `useAcceptSuggestion`, `useDismissSuggestion`.
- Produces: route `/_authed/review` (search `{ tab?: "records" | "uncategorized" | "suggestions" }`); `defaultReviewTab(records: number, uncategorized: number, suggestions: number): ReviewTab` in `review-page.tsx` (first non-empty, else `records`).

- [ ] **Step 1: Write the failing tests.**
  - Default tab: records 0, uncategorized 3, suggestions 1 → `uncategorized`; all 0 → `records`.
  - **S35** (queue): records tab lists account, date, description, amount and candidate count; the row links `/imports/<batch>?state=needs_review`.
  - Uncategorized row actions: Categorize opens `CategorizeDialog`; Transfer opens `TransferDialog`; Rule from this navigates to `/rules/new?transaction_id=<id>`.
  - **S42**: pending suggestion renders `raw_description equals "padaria sao joao"`, its action and up to three example descriptions; Accept prefills name `padaria sao joao → Padaria` and posts `{"name":"padaria sao joao → Padaria"}`; Dismiss posts `dismissRuleSuggestion`; **`suggestion_closed`** 409 renders its message.
  - Responsive: at 360 tabs render as a segmented-control and a row tap opens an action-sheet (Categorize, Transfer, Rule from this, Open).
- [ ] **Step 2–4:** Run `cd web && pnpm vitest run src/app/review-page.test.tsx` → FAIL; implement (`Tabs`/`SegmentedControl`, `ActionSheet`, `Dialog`); run → PASS; `make web-check` → exit 0; responsive manual note.
- [ ] **Step 5: Commit** `git commit -m "feat(web): review import lines, uncategorized transactions and suggestions"`.

### Task 17: Account reconciliation

**Files:**
- Create: `web/src/features/reconciliation/{index.ts,api.ts,reconciliation-page.tsx,reconciliation-page.test.tsx,assertion-dialog.tsx,assertion-result.tsx,difference-alert.tsx,unlock-dialog.tsx}`
- Modify: `web/src/features/accounts/account-page.tsx` (status tag and typed link to `/accounts/$id/reconciliation`), `web/src/app/router.tsx`, catalogs

**Interfaces:**
- Produces: `reconciliationKeys = { status(a), assertions(a) }` under `accountKeys.detail(a)`; `reconciliationQuery`, `assertionsQuery`; `useCreateAssertion`, `useResolveAssertion`, `useUnlockAccount` invalidating through `transactionMutated(queryClient, [accountId])`; route `/_authed/accounts/$id/reconciliation`; draft key `reconciliation.assertion.<accountId>`.

- [ ] **Step 1: Write the failing tests** (`today` 2026-10-31).
  - **S24**: assertion 10.083,41 on 2026-10-31 posts `{"date":"2026-10-31","amount":{"amount":1008341,"currency":"BRL"}}`; the result renders resolution `yield` and links the `+R$ 83,41` transaction; 9.990,00 renders the open difference `−R$ 10,00` alert.
  - **S26**: "Record adjustment" posts `{"resolution":"adjustment"}`; the status refetch renders reconciled; "I added the missing transactions" posts `{"resolution":"transactions_added"}`; **`difference_remains`** renders its message.
  - **S43**: on the reconciled account, categorizing the +3.000,00 transaction posts `categorizeTransaction` and the status still renders reconciled with the same `last_reconciled_on`.
  - **`already_reconciled`** 409 on create renders its message.
  - Unlock defaults the date to `last_reconciled_on`, states that postings on or after it return to cleared, and posts `{"from":"<date>"}` (`UnlockInput`).
  - A credit card account renders a message linking the card overview instead of assertions (I19).
  - Responsive: at 360 the alert sits under the page-header and its actions open an action-sheet.
- [ ] **Step 2–4:** Run → FAIL; implement; run → PASS; `make web-check` → exit 0; responsive manual note.
- [ ] **Step 5: Commit** `git commit -m "feat(web): reconcile accounts against institution balances"`.

### Task 18: Card statement reconciliation

**Files:**
- Create: `web/src/features/cards/{reconcile-statement-dialog.tsx,reconcile-statement-dialog.test.tsx}`
- Modify: `web/src/features/cards/{statement-page.tsx,api.ts}`, catalogs

**Interfaces:**
- Consumes: `statementQuery` (cards plan Task 6).
- Produces: `useReconcileStatement()` → `POST /statements/{id}/reconcile` `{ amount_due: Money }`, `onSuccess` `transactionMutated(queryClient, [accountId])`.

- [ ] **Step 1: Write the failing tests.** Statement 2026-11 `closed`, `reconciled: false`, `amount_due` 1.250,00 → the Reconcile action opens the dialog prefilled `1.250,00`; submit posts `{"amount_due":{"amount":125000,"currency":"BRL"}}`; the refetch renders the reconciled tag and hides the action; status `open` or `reconciled: true` hides the action; **`difference_remains`** renders its message. Responsive: at 360 the dialog is a bottom drawer.
- [ ] **Step 2–4:** Run `cd web && pnpm vitest run src/features/cards` → FAIL on the new tests; implement; run → PASS; `make web-check` → exit 0; responsive manual note.
- [ ] **Step 5: Commit** `git commit -m "feat(web): reconcile a card statement"`.

### Task 19: Integrations and connections list

**Files:**
- Create: `web/src/features/connections/{index.ts,api.ts,connections-page.tsx,connections-page.test.tsx,integration-group.tsx,integration-dialog.tsx,credentials-dialog.tsx,item-id-dialog.tsx,connection-row.tsx}`
- Create: `web/src/testing/connection-api.ts`
- Modify: `web/src/app/router.tsx`, catalogs

**Interfaces:**
- Consumes: `providerTone` (Task 6).
- Produces: `connectionKeys = { integrations, list, detail(c) }`; `integrationsQuery`, `connectionsQuery`, `connectionQuery`; `useCreateIntegration`, `useUpdateCredentials`, `useDeleteIntegration`, `useCreateConnection`, `useDeleteConnection`, `useMapExternalAccount`, `useSyncConnection`, `useCreateConnectToken` with the spec's invalidations; route `/_authed/connections`; "Connect bank" is `<Link to="/connections/connect" search={{ integration_id }} reloadDocument>` (I25).
- Produces in `testing/connection-api.ts`: `integrationFixture`, `connectionFixture`, `externalAccountFixture`, `syncResultFixture`, `connectionRoutes(over?)`.

- [ ] **Step 1: Write the failing tests.**
  - **S51** (integration): name `Meu Pluggy`, client id and secret → `{"provider":"pluggy","name":"Meu Pluggy","client_id":"...","client_secret":"..."}`; the secret input has `type="password"`; no sessionStorage key is written.
  - **S57** (credentials): **`provider_unauthorized`** 422 attaches its message to `client_secret`.
  - **S59**: two integrations render their connections in separate groups with name, provider status tag, `last_synced_at` and the pending external account count.
  - **`integration_unavailable`** 409 on `listIntegrations` renders a page result-state naming `EQUORI_SECRET_KEY`; **`integration_in_use`** 409 on delete and **`provider_unavailable`** 502 on create render their messages.
  - Add by item id posts `createConnection` `{"integration_id":"<id>","item_id":"item-123","name":"..."}` (I27).
  - The Connect bank anchor has `href="/connections/connect?integration_id=<id>"`; after a click, `router.state.location.pathname` stays `/connections` (a `reloadDocument` link leaves navigation to the browser).
  - Responsive: at 360 dialogs open as bottom drawers.
- [ ] **Step 2–4:** Run → FAIL; implement; run → PASS; `make web-check` → exit 0; responsive manual note.
- [ ] **Step 5: Commit** `git commit -m "feat(web): manage Pluggy integrations and list connections"`.

### Task 20: Connection detail, mapping and sync

**Files:**
- Create: `web/src/features/connections/{connection-page.tsx,connection-page.test.tsx,external-account-row.tsx,map-account-dialog.tsx,sync-result-dialog.tsx,disconnect-dialog.tsx}`
- Modify: `connections/index.ts`, `web/src/app/router.tsx`, catalogs

**Interfaces:**
- Consumes: `connectionQuery`, `useMapExternalAccount`, `useSyncConnection`, `useDeleteConnection`, `providerTone`; `accountsQuery` (accounts).
- Produces: route `/_authed/connections/$connectionId`; `eligibleAccounts(accounts: Account[], external: ExternalAccount, mapped: string[]): Account[]` in `map-account-dialog.tsx` (leaf balance-sheet accounts of the same `currency`, kind compatible with `type` per A35, not in `mapped`).

- [ ] **Step 1: Write the failing tests** (`today` 2026-10-17).
  - **S51** (mapping): mapping Conta Corrente to checking posts `{"account_id":"<checking>","sync_from":"2026-10-01"}`; Ignore posts `{"ignored":true}`; the picker excludes an account already mapped and accounts in another currency.
  - **S52**: Sync now renders the dialog with account, received 3, matched 1, created 2, the balance status and a link to the batch.
  - **S53**: a second sync renders `updated` 1.
  - **S54**: the batch link of the sync leads to the transaction of installment 3/6, which renders the plan panel of C4.
  - **S57**: `LOGIN_ERROR` renders the warning tag and a Reconnect link `href="/connections/connect?integration_id=<i>&connection_id=<c>"`.
  - **S58**: `getConnection` 404 renders the not-found result-state.
  - Disconnect confirms with text stating that imported transactions stay and sends `DELETE /connections/<id>`; `UPDATING` renders a progress indicator.
  - Responsive: at 360 external accounts render one per row and the mapping dialog is a bottom drawer.
- [ ] **Step 2–4:** Run → FAIL; implement; run → PASS; `make web-check` → exit 0; responsive manual note.
- [ ] **Step 5: Commit** `git commit -m "feat(web): map, sync and disconnect bank connections"`.

### Task 21: Pluggy Connect page

**Files:**
- Create: `web/src/features/connections/{pluggy-widget.ts,connect-page.tsx,connect-page.test.tsx,connect-page.module.css}`
- Modify: `web/package.json`, `web/pnpm-lock.yaml`, `connections/index.ts`, `web/src/app/router.tsx`, catalogs

**Interfaces:**
- Consumes: `useCreateConnectToken`, `useCreateConnection`, `useSyncConnection`, `needsDocumentLoad` (Task 6); W14 (Task 5).
- Produces: `type ConnectWidget = { init(): Promise<void>; destroy(): Promise<void> | void }`; `type ConnectWidgetFactory = (props: { connectToken: string; updateItem?: string; onSuccess(data: { item: ConnectItem }): void; onError(error: unknown): void; onClose(): void }) => ConnectWidget`; `pluggyWidget: ConnectWidgetFactory` wrapping `new PluggyConnect(props)` in `pluggy-widget.ts`; `ConnectPage` props `{ createWidget?: ConnectWidgetFactory }` defaulting to `pluggyWidget`; route `/_authed/connections/connect` (search `{ integration_id: string; connection_id?: string }`) whose `beforeLoad` calls `window.location.assign(<href>)` when `needsDocumentLoad(performance.getEntriesByType("navigation"), "/connections/connect")`.

- [ ] **Step 1: Add the dependency.** `cd web && pnpm add -E pluggy-connect-sdk@2.14.2`; `git diff web/package.json` shows `"pluggy-connect-sdk": "2.14.2"` and no `pluggy-js`.
- [ ] **Step 2: Write the failing tests** (fake widget factory recording its props).
  - **S51** (connect): mount posts `POST /integrations/<i>/connect-tokens` with `{}`; the factory receives `connectToken`; `onSuccess({ item: { id: "item-9", connector: { name: "Nubank" } } })` posts `{"integration_id":"<i>","item_id":"item-9","name":"Nubank"}` and leaves through `window.location.assign("/connections/<new id>")`.
  - **S57** (reconnect): `connection_id=<c>` posts `{"connection_id":"<c>"}`, passes `updateItem`, and on success posts `syncConnection` then assigns `/connections/<c>`.
  - **close after success**: `onSuccess` then `onClose` → one `createConnection` and one `assign` to the connection.
  - `onClose` alone assigns `/connections`; `onError` renders the error state with the item id fallback link; a `securitypolicyviolation` event on `document` renders the same state; **`provider_unauthorized`** on B2 renders its message; unmount calls `destroy`.
  - Route guard: `needsDocumentLoad` true → `window.location.assign` called with the full href including search.
  - Responsive: the container uses `height: 100dvh` and safe-area padding at 360, 768 and 1280.
- [ ] **Step 3: Run** `cd web && pnpm vitest run src/features/connections/connect-page.test.tsx` → FAIL.
- [ ] **Step 4: Implement.** `pluggyWidget` passes `includeSandbox` only when `import.meta.env.DEV`.
- [ ] **Step 5: Run** → PASS; `make web-check` → exit 0. Manual: `make dev`, `curl -sI http://127.0.0.1:8080/connections/connect` shows `frame-src https://connect.pluggy.ai`; against the Pluggy sandbox, Connect opens from `/connections`, the item id is stored and the console reports no CSP violation; on a phone browser the Meu Pluggy popup opens or the I27 fallback is used. Record the result in the commit body.
- [ ] **Step 6: Commit** `git commit -m "feat(web): connect a bank through Pluggy Connect"`.

### Task 22: Navigation, entry points and verification

**Files:**
- Modify: `web/src/app/shell/{destinations.tsx,side-nav.tsx,more-sheet.tsx,app-frame.test.tsx}`, `web/src/features/accounts/{uncategorized-shortcut.tsx,account-page.tsx,home-page.test.tsx}`, `web/src/features/cards/card-overview-page.tsx`, `web/src/app/routes-responsive.test.tsx`, catalogs

**Interfaces:**
- Consumes: every route of Tasks 7–21; `reviewRecordsQuery`, `uncategorizedCountQuery`, `suggestionsQuery` for the badge.

- [ ] **Step 1: Write the failing tests.**
  - Side navigation and the More sheet list Import `/imports`, Review `/review`, Rules `/rules`, Connections `/connections`; the bottom bar keeps five controls (I3); Review shows the `uncategorized-count` badge.
  - The Home shortcut links `/review?tab=uncategorized`.
  - Account detail and card overview render "Import file" (`/imports/new?account_id=<id>`) and "Reconciliation" (`/accounts/<id>/reconciliation`; the card links its statements instead).
  - `routes-responsive.test.tsx` gains every route of the spec's Routes table except `/connections/connect`: per width 360/768/1280 the page header title, no error result-state and five bottom-bar controls.
- [ ] **Step 2–4:** Run `cd web && pnpm vitest run src/app src/features/accounts src/features/cards` → FAIL; implement; run → PASS.
- [ ] **Step 5: Scenario coverage.** `rg -n "S(2[46]|3[1-9]|4[0-9]|5[0-9])" web/src/features web/src/app` lists S24, S26, S31–S59 (S25 is out of scope).
- [ ] **Step 6: Manual pass.** `make db-up`, `make dev`, `make web-dev`; each route of the Routes table at 360, 768 and 1280 px: no horizontal scroll, pinned actions above the safe area; `curl -sI http://127.0.0.1:8080/` shows the W12 policy unchanged. Record the result in the commit body.
- [ ] **Step 7: Gates.** `make check` → exit 0.
- [ ] **Step 8: Commit** `git commit -m "feat(web): add import, review, rules and connections navigation"`.
