# Categorization: domain amendments

- Date: 2026-10-19
- Domain: `docs/domain/03-domain-flows.md` F5; `05-domain-model.md` 5.2.2 and 5.4; scenarios S37–S44 and S56 of `06-scenarios.md`; amendments A17–A26 (P5), A41 (P6), A54 (P7).

## Intent

The owner keeps one category tree and changes it freely while the ledger grows: renames, moves, archives and merges categories without losing history. The owner clears uncategorized transactions several at a time and turns each repeated correction into a rule after seeing what the rule would change. Every category reports what it holds in a period and how each transaction got there: the rule, the mapped source category, the payee history or a manual choice.

## Scope

In scope: amendments A73–A84 of the HTTP API and the domain. This document holds no screen design.

Out of scope:

| Item | Owner |
|---|---|
| Tag rename, merge and delete | amendment A85 (2026-10-26) |
| Payee delete | no endpoint; merge covers duplicate payees |
| Manual sibling order | not planned; siblings sort by name |
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
- `POST /accounts/{id}/reopen` (no body) → 200 `Account`. It clears `closed_on` of the account and of its closed ancestors and publishes `ledger.account_reopened.v1` per reopened account. A system account → 422 `system_account`; an open account → 422 `validation_failed`.
- Invariant: an open account never has a closed parent. Creating or moving an account under a closed parent → 422 `validation_failed` on `parent_id`.
- Classification needs no change: `Allocate` (`internal/classification/internal/domain/split.go`) already skips a category that is closed on the transaction date, so a rule naming an archived category no longer decides.

### A75 Merge categories

`POST /accounts/{id}/merge` `{ "into": uuid }` → 200 `Account` (the destination).

Preconditions, each a 422 `validation_failed` on `into` unless noted: source and destination differ; both are `income` or `expense` of the same class and instrument; neither has a `system_role` (422 `system_account`); the destination is open, outside the source subtree, and opened on or before the earliest affected transaction date.

Effects, in one database transaction:

1. Every non-voided transaction with a posting on the source gets a new version whose source postings move to the destination with their amounts and memos; postings that then share the destination stay separate, so no memo is lost. Each version publishes `ledger.transaction_categorized.v1` with cause `merge`.
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

`POST /transactions/categorize` `{ category_id, items: [{ id, expected_version }] }` (1 to 200 items, distinct ids) → 200 `{ results: [{ id, status, version? }] }` in request order. Each item runs as `categorizeTransaction` with one part holding the whole category total and no payee change. `status` is `categorized` (with the new `version`), `version_conflict`, `transaction_voided`, `not_categorizable` or `not_found`. An unknown or closed `category_id` rejects the request: 422 `validation_failed` on `category_id`.

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
- `POST /payees/{id}/merge` `{ into }` → 200 `Payee` (the destination); 422 on `into` for the same payee or a payee already merged. Every non-voided transaction with the source payee gets a new version with `payee_id = into` (cause `merge`); voided transactions and accounts whose counterparty is the source name the destination in place. The source payee is kept with `merged_into` set and leaves `GET /payees`, because schedules and aliases reference it until their consumers run; `ledger.payees_merged.v1` publishes `{ from, into }`.
- Classification on `ledger.payees_merged.v1`: payee aliases, rule conditions and actions, categorization match keys and suggestion fingerprints and conditions that name `from` name `into`; colliding suggestions follow A75. Planning moves `planning_schedule.payee_id`. An alias cannot collide: its uniqueness is `(match_type, pattern)`, without the payee.

### A83 Category colour and icon

- `ledger_account` gains `color smallint NULL CHECK (color BETWEEN 1 AND 8)` and `icon text NULL CHECK (icon ~ '^[a-z0-9-]{1,40}$')`.
- `AccountInput` accepts `color` (integer 1–8) and `icon` (`CategoryIcon`) on creation; `Account` returns both when set. `PUT /accounts/{id}/appearance` `{ color, icon }`, both required and nullable, sets them, and `null` clears either: a PATCH cannot tell `null` from an absent field without a new dependency.
- `CategoryIcon` in `api/openapi.yaml` lists 81 kebab-case names of `lucide-react` 1.52.0 icons, each checked against the package: `house`, `building-2`, `key-round`, `sofa`, `lamp`, `wrench`, `hammer`, `zap`, `droplet`, `flame`, `wifi`, `smartphone`, `tv`, `shopping-cart`, `shopping-basket`, `utensils`, `coffee`, `pizza`, `croissant`, `apple`, `wine`, `beer`, `car`, `fuel`, `bus`, `train-front`, `bike`, `plane`, `circle-parking`, `car-taxi-front`, `heart-pulse`, `pill`, `stethoscope`, `dumbbell`, `hospital`, `graduation-cap`, `book-open`, `school`, `film`, `music`, `gamepad-2`, `ticket`, `palette`, `party-popper`, `shirt`, `gift`, `shopping-bag`, `package`, `scissors`, `receipt`, `briefcase`, `laptop`, `cloud`, `globe`, `landmark`, `piggy-bank`, `wallet`, `credit-card`, `banknote`, `coins`, `percent`, `trending-up`, `chart-pie`, `hand-coins`, `file-text`, `shield`, `baby`, `users`, `heart`, `dog`, `cat`, `paw-print`, `luggage`, `map`, `hotel`, `tent`, `smile`, `sparkles`, `tag`. The request validator rejects any other value (400 `invalid_request`).
- `lucide-react` 1.52.0, pinned exactly, is the approved icon dependency of `web/` (owner approval on 2026-10-19); it enters `web/package.json` with a row in ADR 010.
- A schema test inserts `color` 9 and `icon` `"Bad Icon"` and expects both rejections; an apitest posts an icon outside the enum and expects 400 `invalid_request`.

### A84 Parent setter

`PUT /accounts/{id}/parent` `{ parent_id }` (required, nullable) sets the parent with the checks of A73 and A74, and `null` makes the account top level, which `PATCH /accounts/{id}` cannot express.

### Implementation notes

- A75: the merge moves each source posting with its amount and memo; postings that share the destination are not summed.
- A78: the items run in one database transaction through the existing `Categorize` batch; each item error leaves the others applied.
- A81: Classification reads today from the ledger's clock through its ledger port.

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

### A85 Tag rename, merge and delete

Amendment of 2026-10-26. Reason: tags grew without a way to correct a misspelt tag or join two tags; the operations follow A82.

- `GET /tags/{name}` → 200 `TagUsage` `{ name, transactions }`, where `transactions` counts the non-voided transactions that carry the tag. The web interface states the count before a delete.
- `PATCH /tags/{name}` `{ name }` → 200 `TagUsage`. The name is normalized as a transaction tag; a malformed name or a name in use is 422 `validation_failed` on `name`. The row is renamed in place; no transaction gets a new version. Publishes `ledger.tag_renamed.v1` `{ from, into }`.
- `POST /tags/{name}/merge` `{ into }` → 200 `TagUsage` (the destination); 422 on `into` for the same tag or an unknown tag. Every non-voided transaction that carries the source gets a new version (reason `merged`, cause `merge`) carrying the destination once; voided transactions name the destination in place. The source tag is deleted. Publishes `ledger.tag_renamed.v1` `{ from, into }`.
- `DELETE /tags/{name}` → 204. Every non-voided transaction that carries the tag gets a new version without it (reason `tag deleted`, cause `merge`); voided transactions lose it in place. Publishes `ledger.tag_deleted.v1` `{ name }`.
- An unknown tag, or the tag of another user, is 404 `not_found` on every operation.
- Classification on `ledger.tag_renamed.v1`: an `add_tags` rule action that names `from` names `into`, once.
- The tool `manage_accounts_and_payees` gains the actions `rename_tag`, `merge_tag` and `delete_tag`.

## Problem codes

New code: `system_account` (422; close, reopen, merge). Reused: `validation_failed`, `account_not_empty`, `version_conflict`, `transaction_voided`, `not_categorizable`, `not_found`; each A78 `status` other than `categorized` carries the meaning of the code of the same name.

## Verification

- `make check` passes on the branch head.
- A73–A84 each have the apitests and schema tests of their section; S72–S79 are in `06-scenarios.md`.

## Open risks

| Risk | Check |
|---|---|
| A merge over thousands of transactions runs in one database transaction | a merge of 5,000 transactions above 2 s splits the version writes into batches inside the same transaction |
| A81 over a year of transactions loads every subject into memory | 10,000 transactions above 1 s narrow the population to 180 days |
