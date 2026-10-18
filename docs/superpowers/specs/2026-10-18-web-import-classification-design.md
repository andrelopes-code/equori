# Web track, sub-project 3: Import and classification

- Date: 2026-10-18
- Branch: `feat/web-ledger`
- Depends on: `docs/superpowers/specs/2026-10-17-web-foundation-ledger-design.md` (stack K1–K7, rules O1–O8, theme, navigation, data, error and i18n policy) and `docs/superpowers/specs/2026-10-18-web-cards-design.md` (C1–C23). This spec states only what differs from them or adds to them.
- Domain: `docs/domain/03-domain-flows.md` F4, F5, F6; scenarios S24, S26, S31–S59 of `06-scenarios.md`; amendments A7–A10 (P3), A11–A16 (P4), A17–A26 (P5), A27–A32 (P5b), A33–A45 (P6); `docs/operations/pluggy.md`; ADR 008-integration-credentials; ADR 008-web-interface.

## Intent

The owner imports OFX and CSV files, reviews what the import could not place, categorizes and pairs imported transactions, maintains classification rules, reconciles accounts against institution balances, attaches receipts, and connects banks through Pluggy Connect opened from the equori UI. The Pluggy item id is captured from the Connect widget; the Pluggy Dashboard is no longer needed to create an item.

## Scope

In scope: scenarios S24, S26, S31–S59; CSV profiles; import history and batch detail; external record review; the review queue; rules, payee aliases, source categories and categorization statistics; transfers from imports; balance assertions, account reconciliation, unlock and card statement reconciliation; attachments; Pluggy integrations, connections, mapping, sync and Pluggy Connect.

Out of scope:

| Item | Owner |
|---|---|
| Language-model categorization suggestions | no endpoint: `Categorization.method` is `rule\|source\|history\|manual` and no module calls `internal/platform/llm` |
| Schedules, occurrences, goals, budgets, projection | sub-project 4 |
| Redemption with tax (S25), positions, reports | sub-project 5 |
| Pluggy webhooks | not in the API; the scheduler of A43 syncs |
| Editing an import batch or re-running a batch | no endpoint; a batch is immutable |

## Decisions

| ID | Decision |
|---|---|
| I1 | New features `web/src/features/{imports,classification,reconciliation,connections}/`, each with `index.ts` and `api.ts` (O2). They import `features/transactions` and `features/accounts` through `index.ts`; neither of those imports them. Attachments and the transfer action live in `features/transactions` (Ledger endpoints on a transaction). |
| I2 | The `extension` prop of `TransactionPage` (C4) becomes `extensions: ComponentType<{ transaction: Transaction }>[]`, rendered in array order. `app/router.tsx` passes `[CardTransactionPanel, CategorizationPanel]`. |
| I3 | The bottom bar keeps five controls (SC-05). Side navigation and the More sheet gain Import (`/imports`), Review (`/review`), Rules (`/rules`) and Connections (`/connections`). Review shows the `uncategorized-count` query as a badge. The Home "N uncategorized" shortcut targets `/review?tab=uncategorized`. |
| I4 | File import is a routed wizard (`wizard` family) at `/imports/new` with steps File, Mapping (CSV without profile only), Preview, Done. The `File` object stays in component state; a reload restarts at step File with `account_id` kept in the search params. No sessionStorage draft: a `File` is not serializable. |
| I5 | Format follows the extension: `.ofx` and `.qfx` → `ofx`; `.csv` and `.txt` → `csv`; any other extension requires the format select. The client rejects files above 10 MiB (A16) before upload with the `request_too_large` message. |
| I6 | Preview (B1) precedes every import. Confirm re-sends the same `File` to `importFile` and navigates to `/imports/$batchId`. The batch returned by `importFile` is the authoritative result; the preview is advisory. |
| I7 | A `getCsvProfile` 404 inserts step Mapping. The Mapping form and `/accounts/$id/csv-profile` share one component. Column inputs are selects: header names from row `header_rows` of the file when `header_rows` ≥ 1, positions `1..n` when 0 (domain `Profile`: header names, or 1-based positions). The sample table splits the first six lines by the selected delimiter for display only; B1 is the parser of record. Amount mode is a segmented-control: one `amount_column`, or `debit_column` and `credit_column`. |
| I8 | Batch detail lists records with a segmented filter on `state` (Needs review, Created, Matched, Discarded, Withdrawn, All); the default is Needs review when `counts.needs_review` > 0, otherwise All. Candidates load through `getTransaction` with `useQueries`, one query per id. |
| I9 | `/review` has three tabs held in the search param `tab`: `records` (B5), `uncategorized` (`listTransactions?uncategorized=true`), `suggestions` (`listRuleSuggestions?state=pending`). The default tab is the first non-empty one in that order. |
| I10 | An uncategorized row offers Categorize (the existing `CategorizeDialog`, exported by `features/transactions`), Transfer (I16) and "Rule from this" (`/rules/new?transaction_id=`). The prefill is one condition `description contains <description in lower case>` and one empty `set_category` action. |
| I11 | Rule form value inputs by `RuleCondition.field`: `description`, `raw_description` → text; `payee` → payee entity-picker; `amount`, `absolute_amount` → currency-field, two for `between`; `account` → account entity-picker; `account_kind` → select of account kinds; `source` → select `ofx\|csv\|open_finance`; `weekday` → select of seven days; `day_of_month` → number-field 1–31; `installment` → switch. `in_list` takes a tag input. The operator select lists the operators of the P5 A21 condition table for the chosen field. |
| I12 | Rule actions: `set_category` (category picker), `set_payee` (payee picker), `add_tags` (tag input), `split` (parts with category, `percent` or `amount`, exactly one `remainder`), `transfer` (asset or liability account), `mark_reimbursable` (account of kind `receivable`). Field errors map by path `conditions[n].*` and `actions[n].*` (C23 pattern). |
| I13 | Rule order: move up and move down controls, no drag. Each move posts the full id list to `reorderRules`. New rules and accepted suggestions append at the last priority (S42). |
| I14 | "Run rules" calls `runRules` after a confirmation dialog and shows a toast with `examined` and `categorized`. |
| I15 | Accepting a suggestion opens a dialog with `name` prefilled as "<condition value> → <category name>"; the suggestion row shows its conditions, actions and the descriptions of up to three `example_transaction_ids`. |
| I16 | `TransferDialog` (transactions): account entity-picker of balance-sheet accounts other than the transaction's own; on account selection it loads B3. Zero candidates: the dialog states that a transfer posting is created (S50). One candidate: it is shown and preselected. Several: a radio list with no preselection; submit stays disabled until one is chosen (S48). The body is `{expected_version, account_id, pair_with?}`. A `voided_transaction_id` in the result shows a toast naming the paired transaction. The action is available on a non-voided transaction with category postings. |
| I17 | Attachments section on `/transactions/$id`: rows show `file_name`, `media_type`, size (`formatFileSize`), `created_at`; images (`image/*`) render a thumbnail from `getAttachmentContent`; every type opens in a new tab through a link to `/api/v1/attachments/{id}/content`. Upload uses the `upload` family with `accept` = `application/pdf,image/jpeg,image/png,image/webp,text/plain` (Ledger allow-list) and the 10 MiB client check. Delete uses a confirmation dialog. |
| I18 | `CategorizationPanel` (classification) renders `getCategorization`: a method tag and, for `rule`, a link to `/rules/$ruleId`. A 404 renders nothing (origin `system`, A20). |
| I19 | Account reconciliation lives at `/accounts/$id/reconciliation`; the account detail shows the reconciliation status tag and links there (a typed route link, no feature import). Credit card accounts show statement reconciliation instead of assertions (A7). |
| I20 | A new assertion shows its `AssertionResult`: `difference`, `resolution` tag, and a link to `resolution_transaction_id` when present (yield, S24). An `open_difference` renders an alert with two actions: "Record adjustment" (`resolution: adjustment`, S26) and "I added the missing transactions" (`resolution: transactions_added`). |
| I21 | Unlock takes a date-picker defaulting to `last_reconciled_on`; the confirmation dialog states that postings settled on or after the date return to `cleared` (A8). |
| I22 | Statement reconciliation is a dialog of `features/cards` on the statement detail (C8 route): `amount_due` prefilled from `StatementSummary.amount_due`, posted to `reconcileStatement`. Available when `reconciled` is false and status is not `open`. |
| I23 | Pluggy Connect runs through the npm package `pluggy-connect-sdk`, pinned exactly (K1 policy), bundled by Vite: no third-party script origin. ADR 010 gains the dependency and its version. |
| I24 | CSP: `internal/platform/spa` serves `index.html` for the single path `/connections/connect` with `frame-src https://connect.pluggy.ai` added to the W12 policy; every other path keeps W12 unchanged. ADR 008-web-interface gains rule W14 recording the path, the directive and the origin. ADR 008-integration-credentials K5 gains: a Pluggy connect token is returned to the owner's browser; the API key and credentials are not. |
| I25 | A CSP header binds to the document that carries it; a client-side navigation keeps the policy of the first document. Therefore every link to `/connections/connect` uses `reloadDocument`; the route's `beforeLoad` calls `window.location.assign` when the path of `performance.getEntriesByType("navigation")[0]` differs from `/connections/connect`; the route leaves through `window.location.assign`, which restores the W12 policy. A `securitypolicyviolation` event on the page renders the error state with the manual fallback (I27). |
| I26 | Connect flow: `POST /integrations/{id}/connect-tokens` (B2) → `PluggyConnect({connectToken, onSuccess, onError, onClose})` → `onSuccess` yields `item.id` → `createConnection {integration_id, item_id, name: item.connector.name}` → `/connections/$id`. Search params: `integration_id` (required), `connection_id` (update mode). In update mode B2 receives `connection_id`; on success the page calls `syncConnection` and returns to `/connections/$id`. `onClose` returns to the previous connections route. |
| I27 | Manual fallback: `/connections` keeps an "Add by item id" dialog posting `createConnection` with a typed `item_id` (operations doc, section 3). |
| I28 | `provider_status` tones: `UPDATED` → positive; `UPDATING` → neutral with a progress indicator; `LOGIN_ERROR`, `OUTDATED`, `WAITING_USER_INPUT` → warning with a "Reconnect" action (I26 update mode); any other value → neutral with the raw value. |
| I29 | Mapping an external account opens a dialog: ledger account picker limited to leaf balance accounts of the same `currency`, of a kind compatible with `type` (A35), not already mapped; `sync_from` date-picker defaulting to the first day of the current month. "Ignore" posts `{ignored: true}`. |
| I30 | Integration credentials use a password input for `client_secret`; credential forms never write drafts (K5). A 409 `integration_unavailable` on `listIntegrations` renders a page-level result-state on `/connections` naming `EQUORI_SECRET_KEY`. |
| I31 | `syncConnection` shows the `SyncResult.batches` in a dialog: account, counts (`received`, `created`, `matched`, `updated`, `needs_review`, `withdrawn`), balance status, link to each batch. |
| I32 | `format.ts` gains `formatFileSize` (base 1024, one decimal above 1 KB: 230 KB, 12.0 MB). |
| I33 | `/rules/statistics` takes a month select (current month − 12 to current month) and renders `getCategorizationStatistics` for its first and last day: total and one row per method with count and share. |
| I34 | Suggestions (A24) and categorization rows (A20) are written by outbox handlers after the command commits. Their queries use `staleTime: 0` and refetch on mount and window focus; a mutation does not assume them updated. |

## Routes

| Route | Content | Actions |
|---|---|---|
| `/imports` | `listImportBatches` (B4 `account_id` filter, infinite): account, source tag, `file_name`, period, `received` / `created` / `matched` / `ignored` / `needs_review`, balance status | new import; open batch; filter by account |
| `/imports/new?account_id=` | wizard I4: account select and file (I5); Mapping (I7); Preview (B1): counts, lines grouped by outcome (needs review, create, match, ignore collapsed), balance to be asserted | next; back; confirm (`importFile`); edit profile |
| `/imports/$batchId` | `getImportBatch` header: account, source, period, counts, `balance` (recorded: link to reconciliation; skipped: `reason`); records (`listBatchRecords`, I8): date, description, amount, state tag, linked transaction, `unapplied_change` alert | resolve a `needs_review` record (`resolveExternalRecord`): match a candidate (date, description, amount), create, discard; open transaction |
| `/accounts/$id/csv-profile` | form I7 with the last chosen file's sample when present | `saveCsvProfile` |
| `/review` | tabs I9; records: account, date, description, amount, candidate count; uncategorized: transaction rows (foundation list row); suggestions: I15 | resolve record (opens its batch record); categorize; transfer; rule from this; accept; dismiss |
| `/rules` | segmented-control Rules, Aliases, Source categories, Statistics; rules by `priority`: name, `enabled`, `stop_processing`, condition and action summaries | new; edit; move up / down (I13); enable / disable (`changeRule`); delete; run rules (I14) |
| `/rules/new`, `/rules/$ruleId` | form I11, I12: name, enabled, stop processing, conditions, actions | `createRule`; `changeRule` |
| `/rules/aliases` | `listPayeeAliases`: `pattern`, `match_type`, payee | create, edit (dialog, `createPayeeAlias`, `changePayeeAlias`); delete |
| `/rules/source-categories` | `listSourceCategories`: provider, `name`, `count`, mapped category | map (`mapSourceCategory`) |
| `/rules/statistics` | I33 | change month |
| `/accounts/$id/reconciliation` | `getReconciliationStatus`: `last_reconciled_on`, `open_difference` alert (I20); `listBalanceAssertions`: date, amount, source tag, `reconciled` tag | new assertion (`createBalanceAssertion`: date, amount); resolve (I20); unlock (I21) |
| `/cards/$accountId/statements/$statementId` (existing) | `reconciled` tag | reconcile (I22) |
| `/transactions/$id` (existing) | attachments (I17); categorization (I18) | upload; open; delete; transfer (I16) |
| `/connections` | integrations: `name`, `updated_at`; connections by integration: `name`, `provider_status` (I28), `last_synced_at`, `last_error`, pending external account count | add integration (`createIntegration`); update credentials; delete integration; connect bank (I26); add by item id (I27); open |
| `/connections/connect?integration_id=&connection_id=` | Pluggy Connect widget, full viewport (I24–I26) | complete; close |
| `/connections/$connectionId` | header: `name`, `provider_status`, `last_item_update_at`, `last_synced_at`, `last_error`; external accounts: `name`, `type` / `subtype`, `number_last4`, `currency`, `state` tag, mapped account, `sync_from`, `last_synced_on` | map, ignore (`mapExternalAccount`, I29); sync now (I31); reconnect (I28); disconnect (`deleteConnection`, confirmation stating that imported transactions stay) |

Entry points: account detail and card overview gain "Import file" (`/imports/new?account_id=`) and "Reconciliation"; Home keeps the shortcut of I3.

## Phone ergonomics

Section 2 of the foundation spec applies. Specific rules:

- Import wizard: one step per screen; the `stepper` shows step n of m in the page-header; next and confirm are pinned in the bottom action-bar. The file input opens the system picker; drag and drop is a desktop affordance only.
- Preview and batch records: one record per row, description and amount on the first line, date and state tag on the second (LP-01). A `needs_review` record opens a bottom drawer listing candidates as full-width choices, with Create and Discard in the drawer footer.
- Review queue: tabs become a segmented-control under the page-header; an uncategorized row tap opens an action-sheet: Categorize, Transfer, Rule from this, Open.
- Rules list: move up / down, enable and delete live in a row action-sheet. Rule form conditions and actions render as stacked cards, each with a remove control; "Add condition" and "Add action" sit below their stack.
- Reconciliation: the open difference alert sits under the page-header; its actions open an action-sheet.
- Attachments: `accept` includes `image/*`, so the system picker offers the camera.
- Pluggy Connect: the widget iframe is fixed to the visual viewport (`100dvh`, safe-area insets). Mapping dialogs open as bottom drawers.

## Data

Keys:

| Key | Query |
|---|---|
| `["imports", "batches", accountId \| "all"]` | `listImportBatches` (B4) |
| `["imports", "batch", b]`, `["imports", "batch", b, "records", state]` | `getImportBatch`, `listBatchRecords` |
| `["imports", "review"]` | B5 |
| `[...accountKeys.detail(a), "csv-profile"]` | `getCsvProfile` |
| `[...accountKeys.detail(a), "reconciliation"]`, `[...accountKeys.detail(a), "assertions"]` | `getReconciliationStatus`, `listBalanceAssertions` |
| `[...transactionKeys.detail(t), "attachments"]`, `[...transactionKeys.detail(t), "categorization"]` | `listAttachments`, `getCategorization` |
| `[...transactionKeys.detail(t), "pairing-candidates", a]` | B3 |
| `["classification", "rules"]`, `["classification", "rule", r]` | `listRules` (all pages), `getRule` |
| `["classification", "aliases"]`, `["classification", "source-categories"]` | `listPayeeAliases`, `listSourceCategories` |
| `["classification", "suggestions", state]`, `["classification", "statistics", from, to]` | `listRuleSuggestions`, `getCategorizationStatistics` |
| `["connections", "integrations"]`, `["connections", "list"]`, `["connections", "detail", c]` | `listIntegrations`, `listConnections`, `getConnection` |

Invalidation:

| Mutation | Invalidates |
|---|---|
| `importFile`, `resolveExternalRecord` | `transactionMutated(queryClient, [accountId])`; `["imports"]`; `["classification", "statistics"]` |
| `saveCsvProfile` | `[...accountKeys.detail(a), "csv-profile"]` |
| `transferTransaction` | `transactionMutated(queryClient, [own account, account_id])`; `transactionKeys.detail(voided_transaction_id)` when present |
| `categorizeTransaction` (existing) | adds `["classification"]` |
| `createRule`, `changeRule`, `deleteRule`, `reorderRules` | `["classification", "rules"]` |
| `runRules` | `transactionMutated(queryClient, [])`; `["classification"]` |
| `acceptRuleSuggestion`, `dismissRuleSuggestion` | `["classification", "suggestions"]`; accept adds `["classification", "rules"]` |
| alias mutations, `mapSourceCategory` | their list key |
| `createBalanceAssertion`, `resolveBalanceAssertion`, `unlockAccount`, `reconcileStatement` | `transactionMutated(queryClient, [accountId])` (covers the reconciliation keys under `accountKeys.detail`) |
| `createAttachment`, `deleteAttachment` | `[...transactionKeys.detail(t), "attachments"]` |
| integration mutations | `["connections"]` |
| `createConnection`, `deleteConnection`, `mapExternalAccount` | `["connections", "list"]`, `["connections", "detail", c]` |
| `syncConnection` | `["connections"]`; `["imports"]`; `transactionMutated(queryClient, mapped account ids)` |

Routed forms persist drafts in sessionStorage under `classification.rule.<ruleId \| "new">` and `reconciliation.assertion.<accountId>`. The import wizard and credential forms persist none (I4, I30).

## Problem codes

New catalog entries (`problem.<code>`, en and pt-BR):

| Code | Status | Operation | en message |
|---|---|---|---|
| `request_too_large` | 413 | `importFile`, B1, `createAttachment` | The file exceeds 10 MB. |
| `record_resolved` | 409 | `resolveExternalRecord` | This line was already resolved. |
| `already_matched` | 409 | `resolveExternalRecord` | That transaction is already matched to another line. |
| `not_categorizable` | 422 | `categorizeTransaction` | This transaction has no category to set. |
| `pairing_ambiguous` | 409 | `transferTransaction` | Several imported transactions can pair with this one. Choose one. |
| `suggestion_closed` | 409 | `acceptRuleSuggestion`, `dismissRuleSuggestion` | This suggestion was already accepted or dismissed. |
| `already_reconciled` | 409 | `createBalanceAssertion` | The account is already reconciled after this date. Unlock it first. |
| `difference_remains` | 409 | `resolveBalanceAssertion`, `reconcileStatement` | The balance still differs from the institution's amount. |
| `integration_unavailable` | 409 | integration and connection operations, B2 | Bank connections are unavailable: the server has no EQUORI_SECRET_KEY. |
| `integration_in_use` | 409 | `deleteIntegration` | Disconnect this integration's banks first. |
| `provider_unauthorized` | 422 | `createIntegration`, `updateIntegrationCredentials`, B2 | Pluggy rejected these credentials. |
| `provider_unavailable` | 502 | `createIntegration`, `createConnection`, `syncConnection`, B2 | Pluggy did not respond. Try again later. |

Existing entries reused: `validation_failed`, `invalid_request`, `not_found`, `version_conflict`, `transaction_voided`, `posting_reconciled`, `invalid_account`. `provider_unauthorized` attaches to the `client_secret` field (S57). Each new code gets a web test rendering its message.

## Backend gaps

Delivered first, each with an apitest through `internal/apitest`, the OpenAPI contract and `make gen`; every query filters by `user_id` (ADR 003) and an apitest shows another user's resource returns 404.

| ID | Endpoint | Reason | apitest |
|---|---|---|---|
| B1 | `POST /accounts/{id}/import-previews` (multipart `format`, `file`, as `importFile`) → 200 `ImportPreview {counts: ImportCounts, balance: ImportBalance, lines: [{date, amount, description, external_id?, outcome: ignore\|match\|create\|needs_review, transaction_id?, candidates}]}`; writes nothing | the owner sees duplicates, matches and ambiguous lines before committing; a wrong CSV profile is caught before it creates transactions | S32 file: outcomes match, create, create, balance 2,834.10; the batch, record and transaction counts are unchanged; S33 after import: three `ignore`; S35: `needs_review` with both candidates; CSV without profile → 422 |
| B2 | `POST /integrations/{id}/connect-tokens {connection_id?}` → 201 `{connect_token}` | Pluggy Connect needs a connect token created with the integration's API key; update mode needs the connection's item id | a fake Pluggy server receives `POST /connect_token` with the API key, and `itemId` of the connection when `connection_id` is given; a connection of another integration → 422 on `connection_id`; no key → 409 `integration_unavailable`; rejected credentials → 422 `provider_unauthorized` |
| B3 | `GET /transactions/{id}/pairing-candidates?account_id=` → `{items: [{transaction_id, date, amount, description}]}` (A29 definition), ordered by date | the transfer dialog shows the pairing before posting and names `pair_with` | S47: one candidate; S48: two, ordered by date; S50: none |
| B4 | `account_id` query parameter on `GET /import-batches` | import history per account without reading every page | two accounts: the filter returns one account's batches; another user's account → 404 |
| B5 | `GET /external-records?state=needs_review` (Limit, Cursor) → `ExternalRecordList`, newest date first | the review queue spans every batch; each sync creates one batch per account | S35: the record is listed; after resolution it is not; another user's record is absent |

The apitest harness gains a Pluggy base URL option pointing to an `httptest` server, as `internal/ingestion/connection_test.go` uses.

## Tests

Flow tests use the fake fetch (K5), the fixture of `06-scenarios.md` 6.1 and fixed dates through the `today` provider. Each test name carries its scenario ID and asserts the exact request body and the rendered values. `PluggyConnect` is replaced through a constructor prop of the connect page; no module mock.

| Scenario | Web flow test |
|---|---|
| S24 | assertion 10,083.41 on 2026-10-31 renders resolution `yield` and links +83.41; 9,990.00 renders the open difference −10.00 |
| S26 | "Record adjustment" posts `{resolution: "adjustment"}`; status renders reconciled |
| S31 | upload of a 230 KB PDF posts multipart `file` and lists it with "230 KB"; a 12 MiB file is rejected before any request |
| S32 | wizard: OFX by extension, preview outcomes match / create / create, confirm posts `format=ofx`; batch renders 3 / 1 / 2 / 0 and the recorded balance |
| S33 | preview of the repeated file renders three ignored lines; batch renders ignored 3 |
| S34 | CSV without profile: Mapping posts the exact `saveCsvProfile` body (`delimiter: semicolon`, `date_layout: DD/MM/YYYY`, `decimal_separator: ","`), then the preview |
| S35 | record with two candidates; resolving posts `{action: "match", transaction_id}`; `record_resolved` renders its message |
| S36 | card file batch; the created transaction opens with role `charge` on statement 2026-11 |
| S37, S39, S40 | rule form bodies: `contains uber` → `set_category`; `stop_processing` true; split with `percent: 80` and `remainder: true` |
| S38 | alias body `{pattern: "ifd*", match_type: "starts_with", payee_id}`; categorization panel renders method `history` |
| S41 | run rules toast renders examined and categorized counts |
| S42 | pending suggestion renders `raw_description equals "padaria sao joao"`; accept posts `{name}`; `suggestion_closed` renders its message |
| S43 | categorizing the reconciled +3,000.00 posts `categorizeTransaction`; the account status stays reconciled |
| S44 | October 2026 renders total 5, rule 1, history 1, manual 2, source 0, uncategorized 1 |
| S45, S49 | rule actions `transfer` with Itaú Visa and `mark_reimbursable` with Receivable Employer post their exact bodies |
| S46 | batch of the checking file renders the completed transaction at version 2 |
| S47, S48, S50 | transfer dialog with one, two and zero B3 candidates; bodies with and without `pair_with`; `pairing_ambiguous` renders its message |
| S51 | integration body; connect page requests B2, completes the fake widget with an item id, posts `createConnection`; mapping posts `{account_id, sync_from: "2026-10-01"}` and `{ignored: true}` |
| S52, S53 | sync dialog renders received 3, matched 1, created 2; a second sync renders `updated` 1 |
| S54 | the transaction of installment 3/6 renders the plan panel of C4 |
| S55 | batch record filter Withdrawn lists the old record |
| S56 | source category "Food Delivery" mapped to Food › Delivery posts `{category_id}` |
| S57 | `LOGIN_ERROR` renders warning and Reconnect (B2 with `connection_id`); `provider_unauthorized` attaches to `client_secret` |
| S58 | `getConnection` 404 renders the not-found result-state |
| S59 | two integrations render their connections in separate groups |

Unit tests: format by extension (I5); `formatFileSize` in both locales; column options from the sample (I7); operator and value input per field (I11); reorder id lists (I13); provider status tones (I28); the document-load guard of I25. Server test: `internal/platform/spa` returns the W14 policy for `/connections/connect` only.

## Verification

- `make check` passes on the branch head.
- B1–B5 each have the apitest of the Backend gaps table.
- `rg -n "S(2[46]|3[1-9]|4[0-9]|5[0-9])" web/src/features` lists a flow test for each scenario of the Tests table.
- Each route of the Routes table renders at 360, 768 and 1280 px with no horizontal scroll.
- `curl -sI http://127.0.0.1:8080/connections/connect` shows `frame-src https://connect.pluggy.ai`; `curl -sI http://127.0.0.1:8080/` shows the W12 policy unchanged.
- Manual check against the Pluggy sandbox: Connect opens from `/connections`, the item id is stored, and the browser console reports no CSP violation.
- ADR 008-web-interface (W14), ADR 008-integration-credentials (K5) and ADR 010 (`pluggy-connect-sdk`) carry their amendments.

## Open risks

| Risk | Check |
|---|---|
| `pluggy-connect-sdk` version, iframe origin and any extra origin (script, style, connect) are unverified offline | the plan's first task reads the package source for every URL it loads and fixes W14 to that list |
| Meu Pluggy login inside Connect opens a popup; phone browsers may block it | manual check on a phone browser; the fallback I27 remains |
| CSV header naming with `header_rows` > 1 is not specified by `Profile` | the plan reads `profile.go` and B1 confirms the selected names |
| B1 preview and the later import may differ if the ledger changes between them | the batch is authoritative (I6) |
