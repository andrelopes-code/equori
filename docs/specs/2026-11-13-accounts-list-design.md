# Accounts list

The accounts list shows each account once, in the groups of the balance sheet, with sub-accounts indented under their parent. This design draws the hierarchy, adds grouping and ordering, and quiets the status column. It adds no operation.

## 1. Scope

- The list keeps every datum it shows today: name, institution, kind, reconciliation status, balance, trend of 90 days, yield, closed mark, the note on accounts in another currency.
- The three figures (assets, liabilities, net worth) of `BalanceSheetFigures` keep their place and values. They are computed from the groups by kind and do not change with the grouping.
- Out of scope: a card view by institution, a time series by group (the API has none), moving the figures under the records on a phone (M2 of `docs/contributing/mobile.md`), keeping the open state of a parent across visits.

## 2. Decisions

| ID | Decision |
|---|---|
| AL1 | Two controls sit in the bar of the page: Group by (Type, Institution, None) and Order (Balance, Name, Needs attention). Their values are the search parameters `group` (`institution`, `none`) and `order` (`name`, `attention`) of `/accounts`. The defaults, Type and Balance, are not written to the address. |
| AL2 | Group by Type draws the four groups of the balance sheet in their fixed order. Group by Institution draws one group per institution, then a last group for accounts without one. Group by None draws one group, "All accounts". |
| AL3 | An account belongs to one group. A group total adds the own balances of its accounts in the base currency; an account in another currency is not added and is counted in the note of the group, as today. |
| AL4 | A group shows its share: for Type, the total over the assets (`{percent} of what you have`); for Institution, the total over the net worth (`{percent} of net worth`). A share needs a denominator above zero; otherwise the group shows none. A bar of the share's width sits under the group's title. The share replaces the composition strip of the mock (AL13). |
| AL5 | Order applies at every level: the roots of a group, and the children of a parent. Balance sorts by the absolute amount of the subtree, largest first, with rows in another currency after the rows in the base currency. Name sorts by name. Needs attention puts first a row that has an open reconciliation difference, or a descendant that has one. Ties sort by name. The order of groups follows Order for Institution (balance: absolute net, largest first; name; attention: a group with a difference first). The groups by Type keep their order. |
| AL6 | The list reads the reconciliation of every account that is not a credit card (`reconciliationQuery`, shared with the row status and the overview) only while Needs attention is selected. |
| AL7 | Group by None lists the accounts without hierarchy, each with its own balance. A parent whose own balance is zero is left out; its sub-accounts stand in the list. The caption of each row names the institution. |
| AL8 | A parent with sub-accounts is a container row: a toggle button (`aria-expanded`), the name in semibold with its count of sub-accounts, the amount of the subtree in semibold with the caption "sum of sub-accounts". Containers start open. A child starts one level in, drawn behind a rail: a vertical line from the foot of the parent's mark to the last child, and a branch to the mark of each child. The line, the branch and the marks share one column per level. The parent's mark is `md` (36 px) and a child's mark is `sm` (24 px). |
| AL9 | An account in the currency of an instrument, under a parent, is a position. A container's positions collapse into one row: a toggle, "{count} positions", and the codes of the first three as `Tag`s. The row starts collapsed. Opened, each position is a child row with the quantity as its balance. |
| AL10 | A row of the table has the columns Account, Status and Balance. The caption of the account is its kind and, when the group does not already name it, its institution. The kind has no column of its own. The trend sits left of the amount on roots; the yield sits under the amount on one line (`AccountYield` compact). The yield has no column of its own. The group total sits in the header of the group; the summary row of the table goes. |
| AL11 | The status is quiet in the list. A difference stays a warning `Tag` with its amount. A reconciled account reads `Reconciled on {date}` in the success text with a check glyph. An account never reconciled reads the same words as the tag today, in the muted text, with no frame. A parent and a credit card show none, as today. |
| AL12 | Below 600 px the groups are `List`s as today, with the rail on children, the positions row and the controls as two `Select`s in one row. A row stays a link to the account; only the toggle and the positions row are buttons, 44 px high. |
| AL13 | Indicators weighed and dropped, each with its reason. A sentence on the change of net worth in 30 days: the three figures already show the change of each side and of the net worth over the same 30 days. A composition strip over the assets: the share bar of each group (AL4) carries the same shares. An attention panel: the overview's Attention widget already ranks the open differences, and Needs attention (AL5) brings them to the top of this list. A count of accounts never reconciled: it is not an action, since a cash account or a position has no statement to agree with; each such row says it in its own status. |
| AL14 | Own elements: the rail, the container row and the positions row. Slotted `Table` has no hierarchy or collapsible row, `Collapsible` and `Tree` draw no columns. The finding is opened in `andrelopes-code/slotted` in the task that builds the element. |

## 3. Derivation

- `sheet-layout.ts` (pure): groups by Type, Institution or None from the groups of `groupBalances`; share; order; positions. It holds no text.
- `use-attention-set.ts`: the ids of the accounts with an open difference, from the reconciliation queries (AL6).
- One component per file: the controls, the group header, the container row, the position row, the rail.
- The figures keep reading `groupBalances` by Type.

## 4. Cross-cutting questions

| ID | Answer |
|---|---|
| R1 | Does not apply: grouping by kind or by institution has no regional value. |
| R2 | Does not apply: no regional behavior is added. |
| R3 | Does not apply: no value set is added. |
| R4 | Does not apply: no extension point is added. |
| R5 | `balanceSheet.groupBy`, `.groupKind`, `.groupInstitution`, `.groupNone`, `.order`, `.orderBalance`, `.orderName`, `.orderAttention`, `.shareOfAssets`, `.shareOfNet`, `.noInstitution`, `.allAccounts`, `.sumOfSubAccounts`, `.subAccounts`, `.subAccountsOne`, `.positions`, `.positionsOne`, `.expand`, `.collapse`, with pt-BR and en text. |
| R6 | Percentages go through `numberFormatter`; dates through `formatDate`; counts through the plural form of the catalog. |
| C1 | Does not apply: no amount is stored or computed beyond the sums of integers that exist today. |
| C2 | A sum holds the base currency. An account in another currency is counted in the note of the group and in no total. |
| C3 | Positions are the accounts in another currency than the base; their quantity shows in the currency of the record. A test builds a base currency other than the account's. |
| C4 | Amounts go through `useMoneyFormat()` (`MoneyFigure`). A share is a ratio, not an amount, and is not masked. |
| T1 | The date comes from the search parameter or `useToday()`. |
| T2 | Does not apply: no business-day count. |
| B1 | Does not apply: no table. |
| B2 | Does not apply: no operation. |
| B3 | Does not apply: no setting; the choice is a search parameter. |
| D1 | Does not apply: no table. |
| D2 | Does not apply: no schema change. |
| D3 | Does not apply: no recorded fact changes. |
| D4 | Does not apply: no data is written. |
| D5 | Does not apply: the diagnostic file is unchanged. |
| S1 | Does not apply: no operation is added. |
| S2 | `/accounts` is a phone route (ADR 027), kind Record work (M1). AL12 states the phone form. |
| S3 | The article `accounts_and_categories` names grouping, order and the positions row in the same commit as the screen. |
| S4 | Does not apply: the assistant reads accounts through its own tools. |
| X1 | Does not apply: no acceptance scenario is added; the change is a presentation of existing data. |
| X2 | Does not apply to a region. The base-currency case of C3 has a test. |
