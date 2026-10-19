# Categorization section

- Date: 2026-10-19
- Branch: `feat/web-categorization`
- Depends on: `docs/superpowers/specs/2026-10-17-web-foundation-ledger-design.md` (stack K1–K7, rules O1–O8, data, error and i18n policy), `docs/superpowers/specs/2026-10-18-web-ledger-sheet-design.md` (L1–L15), `docs/superpowers/specs/2026-10-18-web-complete-frontend-design.md` (G7, A3, N1).
- Domain: `docs/domain/03-domain-flows.md` F5; `05-domain-model.md` 5.2.2 and 5.4; scenarios S37–S44 and S56 of `06-scenarios.md`; amendments A17–A26 (P5), A41 (P6), A54 (P7).
- Supersedes, in `docs/superpowers/specs/2026-10-18-web-import-classification-design.md`: I1 (the `classification` feature), the `uncategorized` and `suggestions` tabs of I9, I10–I15, I18, I33, the classification keys of I34, the routes `/rules`, `/rules/new`, `/rules/$ruleId`, `/rules/aliases`, `/rules/source-categories` and `/rules/statistics`, and the web flow tests of S37–S44 and S56. That spec keeps the `records` tab of `/review` and everything about import, transfers, reconciliation, attachments and connections.

## Intent

The owner keeps one category tree and changes it freely while the ledger grows: renames, moves, archives and merges categories without losing history. The owner clears uncategorized transactions in one pass, several at a time, and turns each repeated correction into a rule after seeing what the rule would change. Every category shows what it holds in a month and how it got there: the rule, the mapped source category, the payee history or a manual choice.

## Scope

In scope: amendments A73–A83; the `/categories` section (category tree, review queue, rules, suggestions, source categories, payees and aliases, automation statistics); the categorization method on the transaction page; category pickers across the application.

Out of scope:

| Item | Owner |
|---|---|
| Transfer from the review queue (`transferTransaction`, B3 pairing candidates) | import and classification spec, I16 |
| Tag rename, merge and delete | later section |
| Payee delete | no endpoint; merge covers duplicate payees |
| Manual sibling order | not planned; siblings sort by name |
| Category colour in overview charts | later section |
| Running a single rule or a date range through `/rules/run` | not planned (A81 previews before saving) |
| Language-model categorization | no endpoint (ADR 009 has no Classification chain) |

## Domain amendments

Each amendment lands with its OpenAPI contract, `make gen`, an apitest through `internal/apitest` whose name carries the scenario ID, and a 404 apitest for another user's resource (ADR 003). New events follow ADR 006.

### A73 No cycle in the account tree

`checkParent` (`internal/ledger/internal/app/service.go`) walks the ancestors of the new parent and rejects the account itself among them: 422 `validation_failed` on `parent_id`, "must not be a descendant of the account". A new migration adds a constraint trigger `ledger_account_no_cycle` on `ledger_account` that raises `check_violation` for the same case, because the recursive queries of `db/queries/ledger/balance.sql` and `db/queries/reporting/account_day.sql` use `UNION ALL` and do not terminate on a cycle. A schema test updates two rows into a cycle with direct SQL and expects the rejection.

### A74 Archive and reopen

- `POST /accounts/{id}/close` on an `income` or `expense` account ignores the balance; postings booked after `closed_on` still reject it (409 `account_not_empty`). Asset, liability and equity accounts keep the zero-balance rule.
- Closing closes every open descendant with the same `closed_on`, in one database transaction; a descendant with postings after `closed_on` rejects the whole operation.
- An account with a `system_role` cannot be closed: 422 `system_account`.
- `POST /accounts/{id}/reopen` (no body) → 200 `Account`. It clears `closed_on` of the account and of its closed ancestors and publishes `ledger.account_reopened.v1` per reopened account. A system account or an open account → 422 `validation_failed`.
- Invariant: an open account never has a closed parent. Creating or moving an account under a closed parent → 422 `validation_failed` on `parent_id`.
- Classification needs no change: `Allocate` (`internal/classification/internal/domain/split.go`) already skips a category that is closed on the transaction date, so a rule naming an archived category no longer decides.

### A75 Merge categories

`POST /accounts/{id}/merge` `{ "into": uuid }` → 200 `Account` (the destination).

Preconditions, each a 422 `validation_failed` on `into` unless noted: source and destination differ; both are `income` or `expense` of the same class and instrument; neither has a `system_role` (422 `system_account`); the destination is open, outside the source subtree, and opened on or before the earliest affected transaction date.

Effects, in one database transaction:

1. Every non-voided transaction with a posting on the source gets a new version whose source postings move to the destination; postings that then share the destination sum into one. Each version publishes `ledger.transaction_categorized.v1` with cause `merge`.
2. The children of the source move under the destination.
3. The source is closed on today's date (`platform/clock`).
4. `ledger.categories_merged.v1` publishes `{ from, into }`.

Consumers of `ledger.categories_merged.v1`:

| Module | Effect |
|---|---|
| Classification | A `transaction_categorized` with cause `merge` keeps the method and `rule_id` of the previous version and updates `category_id`. `set_category` and `split` actions, source category mappings and suggestion actions that name `from` name `into`. A suggestion whose fingerprint collides after the rewrite is deleted, the older one stays (one suggestion per match key and category, A24). |
| Planning | Schedules whose `account_id` or `counterpart_id` is `from` take `into`. The budget of `from` moves to `into` when `into` has none; otherwise the budget of `from` and its amounts are deleted and the budget of `into` is unchanged. |

### A76 Transaction filter by subtree

`GET /transactions?account_id=` returns transactions with a posting on the account or on any of its descendants, the scope of `/accounts/{id}/balance` and `/reports/balances`.

### A77 Category totals

`GET /reports/categories?from&to&class` (`class` is `income` or `expense`; at most 366 days; `to` ≥ `from`) → `{ items: [{ account_id, total, subtree_total }] }`, one item per account of the class that is open or has a non-zero total in the period, ordered by account name then id. `total` is the sum of the account's booked deltas in `[from, to]` from `reporting_account_day`; `subtree_total` adds its descendants. Both are positive for spending of an expense category and for earnings of an income category (A54 sign). The tree is read from the same source as `getBalanceSeries`.

### A78 Bulk categorization

`POST /transactions/categorize` `{ category_id, items: [{ id, expected_version }] }` (1 to 200 items, distinct ids) → 200 `{ results: [{ id, status, version? }] }` in request order. Each item runs as `categorizeTransaction` with one part holding the whole category total and no payee change, in its own database transaction. `status` is `categorized` (with the new `version`), `version_conflict`, `transaction_voided`, `not_categorizable` or `not_found`. An unknown or closed `category_id` rejects the request: 422 `validation_failed` on `category_id`.

### A79 Categorizations by transaction

`GET /categorizations?transaction_id=…` (repeated parameter, 1 to 200) → `{ items: [Categorization] }`. A transaction with no categorization row is absent from `items`.

### A80 Rule usage

`Rule` gains `categorized_count` (integer: non-voided categorization rows with method `rule` and this `rule_id`) and `last_categorized_at` (date-time, absent at zero).

### A81 Rule preview

`POST /rules/preview` (body `RuleInput`) → 200 `{ would_categorize: { count, transaction_ids }, conflicts: { count, transaction_ids } }`, each `transaction_ids` holding at most 50 ids, newest date first. The rule is evaluated alone, without the other rules, over the non-voided transactions dated in `[today − 365 days, today]`:

- `would_categorize`: uncategorized transactions that the rule matches and whose allocation succeeds.
- `conflicts`: categorized transactions that the rule matches and whose current category postings differ from the rule's allocation.

The body is validated as `createRule` validates it; nothing is written.

### A82 Payee rename and merge

- `PATCH /payees/{id}` `{ name }` → 200 `Payee`.
- `POST /payees/{id}/merge` `{ into }` → 200 `Payee` (the destination). Every non-voided transaction with the source payee gets a new version with `payee_id = into` (cause `merge`, A75 rule 1); the source payee is deleted; `ledger.payees_merged.v1` publishes `{ from, into }`.
- Classification on `ledger.payees_merged.v1`: payee aliases, `payee` conditions, `set_payee` actions, categorization match keys and suggestion fingerprints that name `from` name `into`. An alias that collides on `(match_type, pattern)` is deleted, the older one stays; colliding suggestions follow A75.

### A83 Category colour and icon

- `ledger_account` gains `color smallint NULL CHECK (color BETWEEN 1 AND 8)` and `icon text NULL CHECK (icon ~ '^[a-z0-9-]{1,40}$')`.
- `Account`, `AccountInput` and `AccountPatch` gain `color` (integer 1–8, nullable) and `icon` (string, nullable, enum `CategoryIcon`); `null` in a patch clears either.
- `CategoryIcon` in `api/openapi.yaml` lists the curated icon keys, each the kebab-case name of a `lucide-react` icon. The slice 3 plan fixes the list, about 60 keys covering housing, food, transport, health, education, leisure, shopping, services, finance, income, family, pets and travel. The server validates against the enum.
- The web maps `color` `n` to `var(--slotted-data-n)` and `icon` to its `lucide-react` component inside the Slotted `Icon` family. `lucide-react` is a new dependency, pinned exactly; ADR 010 gains its row (approved by the owner on 2026-10-19).
- Category mark: one own element `CategoryMark` (build-own-element) draws the icon at `size="sm"` in the category colour on a tint of that colour, in a square with `var(--slotted-control-radius)` corners. Without icon it draws the colour square alone, with no letter; without colour the icon takes `tone="muted"` on the neutral surface; with neither it draws nothing. It never uses `Avatar`.
- A schema test inserts `color` 9 and `icon` `"Bad Icon"` and expects both rejections; an apitest posts an icon outside the enum and expects 422 on `icon`.

### New scenarios

Added to `06-scenarios.md`, section 6.13, with the categories of that section plus Food › Restaurants.

| ID | Scenario |
|---|---|
| S72 | Moving Food under Food › Groceries → 422 on `parent_id`; the tree is unchanged (A73). |
| S73 | Closing Food › Bakery on 2026-10-31 after the S42 transactions → 200. An imported "PADARIA SAO JOAO" dated 2026-11-02 stays uncategorized although the S42 rule matches. Reopening Bakery and running rules categorizes it. Closing Uncategorized expense → 422 `system_account` (A74). |
| S74 | A budget on Travel and none on Transport. Merging Travel into Transport: the S41 Travel transaction gets version + 1 with a Transport posting and method `manual`; a rule with `set_category` Travel now names Transport; Travel is closed; the budget names Transport (A75). |
| S75 | `GET /transactions?account_id=<Food>` lists the S38 Delivery, S40 Groceries and S42 Bakery transactions (A76). |
| S76 | `GET /reports/categories?from=2026-10-01&to=2026-10-31&class=expense` returns Travel total 23.90 (S41) and Food `subtree_total` equal to the totals of Food, Delivery, Groceries and Bakery summed (A77). |
| S77 | Three uncategorized transactions, one with a stale `expected_version`: results `categorized`, `categorized`, `version_conflict` (A78). |
| S78 | With the S41 data, previewing "description contains `uber`" → Ride-hailing returns `would_categorize` with no transaction (UBER *EATS is already categorized by `/rules/run`) and `conflicts` with the Travel transaction (A81). |
| S79 | Payees "iFood" and "IFOOD" merged into "iFood": the S38 alias names the destination, the transactions of "IFOOD" get version + 1, `GET /payees` lists one payee (A82). |

## Web decisions

| ID | Decision |
|---|---|
| CZ1 | One feature `web/src/features/categories/` with `index.ts` and `api.ts` (O2) holds every screen of this spec. It imports `features/transactions` through its `index.ts` (transaction list rows, `CategorizeDialog`); `features/transactions` imports the category picker and the categorization panel from `features/categories` through its `index.ts`. |
| CZ2 | Navigation (amends G7, L8, N1): destinations Overview, Transactions, Categories, Goals, Cards, Accounts. The uncategorized count badge (L8) moves from Transactions to Categories and links to `/categories/review`. The phone More sheet lists Categories after Goals. |
| CZ3 | `/accounts` drops the income and expense columns of A3 and shows a link to `/categories`; equity accounts keep the A3 index. |
| CZ4 | The section header holds tabs rendered as route links (`tabs` with `render`): Categories (`/categories`), Review (`/categories/review`, uncategorized count badge), Rules (`/categories/rules`, pending suggestion count badge), Payees (`/categories/payees`), Automation (`/categories/automation`). Below 600 px the tabs scroll horizontally in one row. |
| CZ5 | Tree (`/categories`): a `segmented-control` Expense \| Income in the search param `class`; a month in `?month=YYYY-MM`, the current month by default, with the previous and next controls of the overview (O1). The `tree` family renders the open categories of the class; each row shows the `CategoryMark` (A83), the name, the month's `subtree_total` (A77) aligned as a figure, and its share of the class total. System categories render without edit actions. Archived categories sit in a collapsed `collapsible` "Archived (n)" under the tree. |
| CZ6 | Row actions (`menu`; `action-sheet` below 600 px): New subcategory, Rename, Move, Colour, Merge, Archive; on archived rows Reopen. Appearance replaces a separate colour action. New subcategory and Rename edit inline in the row; Enter saves, Escape cancels. Move opens a dialog with a `tree` of the same class without the row's subtree and with a "Top level" choice. Appearance opens a `popover` with the eight colour swatches and "None", and an icon grid of the `CategoryIcon` keys with a search field and "None"; the row's `CategoryMark` previews the choice. |
| CZ7 | Merge dialog: a destination picker (same class and instrument, open, outside the subtree). The confirmation states that every transaction of the source moves to the destination, that the subcategories move under it, and the budget outcome of A75 read from `listBudgets`: the source budget moves, or, when both have one, the source budget is deleted. |
| CZ8 | Archive confirmation states that rules naming the category stop deciding (A74) and lists them by name (rules whose actions name the category or a descendant). After archive, a `toast` offers Undo, which calls reopen. |
| CZ9 | Category detail at `/categories/$id`: breadcrumb of ancestors; header with name, colour, and the row actions of CZ6; the month total and a 12-month bar `chart` of monthly totals derived from `getBalanceSeries` over the last 366 days; budget progress (`getBudgetProgress`) when the category has a budget, linking to planning; "Rules that set this category" (from `listRules`, with A80 counts); mapped source categories; the transactions of the subtree (A76) as the transactions list rows. |
| CZ10 | Review queue at `/categories/review`: pending suggestions render first as a compact `alert` "n rule suggestions" linking to the Suggestions segment (CZ14), then the uncategorized transactions (`listTransactions?uncategorized=true`, infinite), newest first. Each row has a `checkbox`; a selection shows an `action-bar` pinned to the bottom with the count, a category picker and Apply (A78). Results with a status other than `categorized` stay selected and render their message inline. |
| CZ11 | Review row actions: Categorize (`CategorizeDialog`, with split), "Rule from this" (`/categories/rules/new?transaction_id=`), Open. Keyboard: `j`/`k` move the active row, `x` toggles selection, `c` opens Categorize, `r` opens Rule from this; `kbd` hints show in the page header from 1024 px. |
| CZ12 | After a single categorization in the queue, the client previews (A81) a rule with one condition — `payee equals <payee_id>` when the transaction has a payee, otherwise `description equals <description>` — and one `set_category` action. When `would_categorize.count` > 0, an `inline-message` under the row's former position offers "Create a rule for n similar transactions"; it opens the rule form prefilled with that rule. |
| CZ13 | Rules list at `/categories/rules`: a `segmented-control` Rules \| Suggestions \| Source categories in the search param `view`. Rules by `priority`: name, a one-line summary ("description contains uber → Transport › Ride-hailing"), an `enabled` `switch`, `categorized_count` and `last_categorized_at` (A80), and a warning `tag` "Archived category" when a deciding action names an archived category. Order changes with Move up and Move down (I13: the `tree` and `list` families have no drag), each posting the full id list to `reorderRules`. "Run rules" keeps I14. |
| CZ14 | Suggestions view keeps I15; each example shows date, description and amount of up to three `example_transaction_ids` (A79 is not needed: the examples load through `getTransaction`). |
| CZ15 | Source categories view: `listSourceCategories` sorted unmapped first, then by `count` descending; each row a category picker that posts `mapSourceCategory` on change, with a "Clear" choice posting `null`. |
| CZ16 | Rule form at `/categories/rules/new` and `/categories/rules/$ruleId` keeps I11 and I12, with the category picker of CZ19. A preview panel (A81) beside the form from 1024 px, under it below: it posts the form body 400 ms after the last change when the client-side validation passes, and lists `would_categorize` and `conflicts` as two sections of transaction rows with their counts. Actions: Save; Save and apply (save, then `runRules`, then the I14 toast). `?transaction_id=` prefills as CZ12. |
| CZ17 | Payees at `/categories/payees`: payees by name with a search field; each payee expands to its aliases (`listPayeeAliases` grouped by `payee_id`). Actions per payee: Rename (inline), Merge (dialog with a payee picker; the confirmation states that aliases and rules move), Add alias. The alias form (`pattern`, `match_type`) has a "Test" text field that renders whether the typed raw description matches, evaluated in the client with the normalization of `Normalize` and the order of A22; the server stays the authority. |
| CZ18 | Automation at `/categories/automation` keeps I33 and adds the share of automatic methods (`rule` + `source` + `history`) over `total` as a `stat-card`, and a link "n uncategorized" to `/categories/review`. |
| CZ19 | Category picker (one component, used by `CategorizeDialog`, the new transaction form, the bulk bar, rule actions and source mappings): a `combobox` filtered by any segment of the path ("groc" finds Food › Groceries), each option with its `CategoryMark` and the full path; archived categories are absent; the categories of the transaction's sign class list first. |
| CZ20 | Categorization panel on `/transactions/$id` keeps I18. Transaction list rows load methods for the visible page through A79, one query per page, and show a method `tag` only for `rule` and `source`. |

## Phone ergonomics

Section 2 of the foundation spec applies. Specific rules:

- Tree rows are 48 px high; the row tap opens the category detail, the trailing actions control opens the action sheet.
- The bulk action bar of CZ10 sits above the bottom bar, inside the safe-area inset.
- The rule form stacks conditions and actions as cards; the preview of CZ16 collapses to one line with both counts that expands in place.

## Data

| Key | Query |
|---|---|
| `["categories", "totals", class, month]` | A77 for the month |
| `["categories", "series", id]` | `getBalanceSeries` of CZ9 |
| `["categories", "rules"]`, `["categories", "rule", r]` | `listRules` (all pages), `getRule` |
| `["categories", "preview", bodyHash]` | A81, `staleTime: 0`, `gcTime: 0` |
| `["categories", "suggestions", state]`, `["categories", "sources"]`, `["categories", "aliases"]` | `listRuleSuggestions`, `listSourceCategories`, `listPayeeAliases` |
| `["categories", "statistics", from, to]` | `getCategorizationStatistics` |
| `["categories", "categorizations", ids]` | A79 |

Accounts and payees keep `accountKeys` and the payee key of `features/transactions`.

| Mutation | Invalidates |
|---|---|
| create, update, colour, close, reopen account | `accountKeys.all`; `["categories", "totals"]` |
| merge category | `accountKeys.all`; `transactionMutated(queryClient, [])`; `["categories"]`; budget keys |
| `categorizeTransaction`, A78 | `transactionMutated(queryClient, [])`; `["categories"]` |
| rule mutations, `runRules` | `["categories", "rules"]`; `runRules` adds `transactionMutated(queryClient, [])` and `["categories"]` |
| suggestion mutations, `mapSourceCategory`, alias mutations | their key; accept adds `["categories", "rules"]` |
| payee rename and merge | payee key; `["categories", "aliases"]`; merge adds `transactionMutated(queryClient, [])` and `["categories", "rules"]` |

Suggestion and categorization rows are written by outbox handlers (I34): their queries use `staleTime: 0` and refetch on mount and window focus. The rule form persists its draft in sessionStorage under `categories.rule.<ruleId | "new">`.

## Problem codes

New catalog entry (`problem.<code>`, en and pt-BR): `system_account` (422; close, reopen, merge) — "System categories cannot be archived or merged." Reused: `validation_failed`, `account_not_empty`, `version_conflict`, `transaction_voided`, `not_categorizable`, `suggestion_closed`, `not_found`. Each A78 `status` other than `categorized` renders the message of the code of the same name. Each code gets a web test rendering its message.

## Tests

Web flow tests use the fake fetch (K5), the fixture of `06-scenarios.md` 6.1 and 6.13 and fixed dates through the `today` provider; each name carries its scenario ID and asserts the exact request body and the rendered values.

| Scenario | Web flow test |
|---|---|
| S37, S39, S40 | rule form bodies of the import and classification spec |
| S38 | alias body `{pattern: "ifd*", match_type: "starts_with", payee_id}`; the Test field matches "IFD*IFOOD SAO PAULO"; the panel renders method `history` |
| S41 | run rules toast renders `examined` and `categorized` |
| S42 | pending suggestion renders `raw_description equals "padaria sao joao"`; accept posts `{name}`; `suggestion_closed` renders its message |
| S43 | categorizing the reconciled +3,000.00 from the review queue posts `categorizeTransaction` |
| S44 | automation for October 2026 renders total 5, rule 1, history 1, manual 2, source 0, uncategorized 1 and automatic share 40 % |
| S56 | mapping "Food Delivery" to Food › Delivery posts `{category_id}` |
| S72 | Move dialog does not list Groceries under Food; a 422 on `parent_id` renders inline |
| S73 | Archive posts `{closed_on}`; the confirmation names the S42 rule; Undo posts reopen; `system_account` renders its message |
| S74 | Merge posts `{into}`; the confirmation states that the Travel budget moves |
| S76 | the tree renders Travel 23,90 and Food with its subtree total |
| S77 | selecting three rows and applying posts three items; the stale row stays selected with the `version_conflict` message |
| S78 | the rule form preview renders 0 would categorize and 1 conflict |
| S79 | Merge payee posts `{into}`; the alias list renders under "iFood" |

Unit tests: path filter of CZ19; rule summary sentence of CZ13; alias Test evaluation against the S38 alias and the A22 order; the CZ12 prefill for a transaction with and without payee; monthly totals from a daily balance series (CZ9).

## Delivery

One vertical slice per commit; each slice passes `make check`.

| Slice | Content |
|---|---|
| 1 | A73 (starts with S72 failing), A74, A76 |
| 2 | A75 with its Classification and Planning consumers |
| 3 | A77, A83; CZ1–CZ9, CZ19 |
| 4 | A78, A79; CZ10–CZ12, CZ20 |
| 5 | A80, A81; CZ13–CZ16 |
| 6 | A82; CZ17 |
| 7 | CZ18 |

## Verification

- `make check` passes on the branch head.
- A73–A83 each have the apitests and schema tests of their section; S72–S79 are in `06-scenarios.md`.
- `rg -n "S(3[7-9]|4[0-4]|56|7[2-9])" web/src/features/categories` lists a flow test for each scenario of the Tests table.
- Each route of this spec renders at 360, 768 and 1280 px with no horizontal scroll.

## Open risks

| Risk | Check |
|---|---|
| A merge over thousands of transactions runs in one database transaction | the A75 apitest measures a merge of 5,000 transactions; above 2 s the plan splits the version writes into batches inside the same transaction |
| A81 over a year of transactions loads every subject into memory | the apitest seeds 10,000 transactions and asserts the response under 1 s; otherwise the population narrows to 180 days |
| The client alias test (CZ17) can diverge from `Normalize` | the unit test runs the cases of `TestNormalize` and `TestAliasOrder` (`internal/classification/internal/domain/domain_test.go`) |
| The `tree` family's inline editing and row actions are unverified for this use | slice 3 reads `tree.md` first; a gap becomes a Slotted finding |
