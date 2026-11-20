# Property account: a home, a vehicle or another good in the net worth

- Status: approved by the owner on 2026-11-20 (option C of the session analysis)
- Date: 2026-11-20
- Amendment: A259
- Scenarios: S663 and S664 of `docs/domain/06-scenarios.md`
- Extends: the account kinds of `docs/domain/05-domain-model.md`, 5.2.2; allocation and net worth (A125)

## 1. Intent

A loan of kind `loan` records the financing of a home or a vehicle as a liability (vision A09). The financed good has no account kind. A home of 400,000.00 bought with 300,000.00 of financing therefore lowers the net worth by 300,000.00 instead of leaving it unchanged. The kind `property` records the good as an asset at the value the owner states.

## 2. Rules

| ID | Rule |
|---|---|
| PA1 | `property` is an account kind of class `asset` only. The domain, the schema constraint, the API enums `AccountKind` and `AccountInputKind`, the rule condition kinds of classification and the kind list of the tool `manage_accounts_and_payees` accept it. A `property` account of class `liability` answers 422 `invalid_request` on `kind`. |
| PA2 | A `property` account takes the defaults of a balance account: yield mode `none`, no institution required, the opening balance against the equity account Opening balances. |
| PA3 | A change of value is a balance assertion with the new value. Its difference is resolved as `adjustment` against the equity account Adjustments, so it changes the net worth and never the income or the expenses. |
| PA4 | The liquidity indicator leaves a `property` account out: `liquidKinds` (`internal/reporting/app/indicators.go`) and `liquidCapable` (`web`) do not list it. |
| PA5 | A `property` account belongs to the spending set of planning (A250 default). A purchase paid from a spending account is a transfer inside the set and counts as neither saving nor spending. |
| PA6 | The allocation by type groups a `property` account under the key `property`, not `currency`. By currency it groups under its currency; by institution under its institution or the empty key. |
| PA7 | The balance sheet of `/accounts` draws `property` accounts in a group "Bens" (en "Property") after the reserves and before the cards. |
| PA8 | The kind chooser draws `property` as the ninth and last asset tile of the grid order (KC1), so the assets fill three rows of three and the arrow keys move between aligned columns. Its art is a house on a square plate, in the paint vocabulary of the other tiles. The kind group of the account form (`kindGroups`) is "Bens" (en "Property"), after the debts group. |
| PA9 | The mark of a `property` account is a rounded square (`account-shape.ts`). |

## 3. Cross-cutting questions

| ID | Answer |
|---|---|
| R1 | Does not apply: the kind carries no regional value; the value is stated by the owner. |
| R2 | Does not apply: no regional value. |
| R3 | Does not apply: the kind set does not grow with regions; it follows the existing closed list of kinds. |
| R4 | Does not apply: no extension point. |
| R5 | `kind.property`, `kind.hint.property`, `kind.title.property`, `kind.group.goods`, `home.group.property`, `instruments.type.property`, each in pt-BR and en. |
| R6 | Does not apply: the screens that write the amounts and dates of the account already format them. |
| C1 | The balance of the account: an integer of minor units in the account's currency, as every account. |
| C2 | Net worth and allocation convert as A125 states; the feature adds no sum. |
| C3 | A `property` account in another currency is valued as any currency account (A125). |
| C4 | The currency comes from the account record. |
| T1 | Opening date and assertion date: calendar dates of the book, as every account. |
| T2 | Does not apply: no business day. |
| B1 | Does not apply: no table. |
| B2 | Does not apply: no operation. |
| B3 | Does not apply: no setting. |
| D1 | Does not apply: no table. |
| D2 | Migration `00137_ledger_property_kind.sql` replaces `ledger_account_kind_check` and `ledger_account_check2`. |
| D3 | A change of value is a balance assertion and an adjustment transaction, both recorded. |
| D4 | Does not apply: no bank, file or model data. |
| D5 | Does not apply: no diagnostic field. |
| S1 | Does not apply: no operation; the enums of `createAccount` and `updateAccount` grow, covered by `TestToolCatalog`. |
| S2 | The balance sheet of the phone draws the group as the other groups. |
| S3 | `internal/assistant/guide/articles/accounts_and_categories.md` names the kind. |
| S4 | The tool `manage_accounts_and_payees` accepts the kind (PA1); the net worth and the allocation views already read the account. |
| X1 | S663 (net worth and allocation with a financed home) in `internal/portfolio/property_test.go`; S664 (revaluation) in the same file. |
| X2 | Does not apply: R1, R2, C2 and C3 add no rule. |

## 4. Tests

| Rule | Test |
|---|---|
| PA1 | `internal/ledger/domain/account_test.go` (asset accepted, liability rejected); `internal/ledger/schema_test.go` (`TestDBAcceptsPropertyAsset`, `TestDBRejectsClassKindMismatch`); `internal/classification/domain/domain_test.go` (`TestNewRuleAcceptsPropertyKind`); `web/src/features/categories/rule-editor/condition-value.test.tsx` |
| PA3, PA6 | S663 and S664 in `internal/portfolio/property_test.go`; `web/src/features/portfolio/model/allocation-label.test.ts` |
| PA7 | `web/src/features/accounts/balance-sheet/balance-groups.test.ts` |
| PA8, PA9 | `kind-order.test.ts`, `kind-art.test.ts`, `kind-chooser.test.tsx`, `kind-count.test.ts`, `kind-facts.test.ts`, `account-kinds.test.ts`, `account-form-page.test.tsx` |
