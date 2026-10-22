# Owner review of the accounts and cards screens (2026-10-21)

Each item is one report of the owner made while `2026-10-21-web-accounts-cards.md` was executed. `Owner`
is who fixes it: `app` (this repository), `slotted` (the library, reported in the plan's final reply under
`Slotted findings`), or both. `Status` is `open`, `fixed` (uncommitted; the plan's files are reviewed as
one change), or `reported`.

## Balance sheet (`/accounts`)

| # | Report | Owner | Diagnosis | Status |
|---|---|---|---|---|
| 1 | The sparklines are stretched and sit in a cell of an odd size. | app | The table has automatic layout at 100% of the page; the browser spreads the free width over the columns in proportion to their content, and the sparkline takes the width of its cell. | fixed: the trend stands inside the balance cell, and the kind, reconciliation and balance columns fit their content (`balance-sheet.module.css` `.fit`), so the account column takes the free width |
| 2 | A sparkline starts narrow and grows until it is wide. | slotted, app | The family's paths carry `transition: d`; the line takes its container's width, so when the cell settles after the first measure the path animates to the new width. | fixed in the app (`account-trend.module.css`: fixed 8rem box, `--slotted-duration-medium: 0ms` inside it, a skeleton reserves the box while the series loads); to report as a Slotted finding |
| 3 | After the first fix the sparkline stands right-aligned in a very wide cell. | app | Same cause as item 1: the balance column still took a share of the free width. | fixed with item 1 |

## Account record (`/accounts/$id`)

| # | Report | Owner | Diagnosis | Status |
|---|---|---|---|---|
| 4 | The chart's projection jumps from 21/10 to a date weeks later. | app | The x axis is a category axis; the projection had a row only on the days with an expected entry, so consecutive categories were weeks apart. | fixed: `balance-chart-rows.ts` writes one row per day up to 30 days ahead, carrying the projected balance between entries (test `balance-chart-rows.test.ts`) |
| 5 | Opening the Movements tab hitches briefly. | app | The tab change rewrote the address, so the whole record rendered again, the chart included; the ledger then mounted a page of 100 transactions. | fixed: the figures and the chart are memoised and the range handler keeps one identity, so a tab change does not render them; the ledger reads pages of 50. Not measured in a browser yet |

## Institutions and the institution field

| # | Report | Owner | Diagnosis | Status |
|---|---|---|---|---|
| 6 | The logo picker (institution combobox) is slow and stalls. | app, slotted | The picker received the whole catalogue (492 institutions with a logo) through `items`, so every key filtered and drew every row with its image. | fixed: `catalogue-search.ts` gives the picker a `source` that answers 20 rows a page (test `catalogue-search.test.ts`); to report as a Slotted finding (`items` mode draws every match without windowing) |

## Account links (`/accounts/links`)

| # | Report | Owner | Diagnosis | Status |
|---|---|---|---|---|
| 7 | The "Ledger account it feeds" choices show no logo; the account mark of the entry form should be one shared component. | app | `AccountMark` is the shared mark (sizes sm, md, lg), but each screen resolved the institution's logo itself and the link drawer did not. | fixed: `accounts/account-avatar.tsx` draws the mark from the account alone (kind's outline, institution logo, reserve goal ring); the balance sheet, the record header and the link drawer use it. The entry form's `transactions/account-option.tsx` keeps its own resolution (another plan's file) |

## Visual review of the accounts screens (second round)

| # | Report | Owner | Diagnosis | Status |
|---|---|---|---|---|
| 8 | Switching the tabs of the accounts pages has no sliding indicator under the tabs. | app | Each tab is its own route and each page drew its own header, so a tab change mounted a new tab strip with no indicator to move. | fixed: a layout route (`accounts-layout.tsx`) keeps one header for the three pages; each page writes its subheading and actions through `HeaderSlot`. Checked in Chromium: the tab strip is the same element after a switch |
| 9 | The balance sheet header is broken: the date input stands above the New account button, the segmented control and the other controls have different heights and break the row. | app | The date picker (full width), the small segmented control, an icon button and a button shared the header's actions and wrapped. | fixed: the date (11rem) and the basis stand in the body's bar beside the closed-accounts switch, at the default control height; the header keeps Refresh and New account. Checked in Chromium at 1440 px |
| 10 | The Kind column is too narrow for its content; its words wrap over four lines. | app | The `.fit` width of item 1 shrank the column to 1% while its cells could wrap. | fixed: the kind, reconciliation and balance cells use the table's `text="nowrap"`. Checked in Chromium |
| 11 | The New account or card form looks broken: the kind tiles are badly styled. | app | The radio group's root was replaced by a `Grid` through `render`, which dropped the family's tile styling; the tiles also held a monogram mark. | fixed: the `Grid` stands inside the group, as the family's tile example composes it, and each tile holds its name and hint. Checked in Chromium |
| 12 | The colour picker misbehaves: hover state, borders overlapping neighbours, outlines, and a white outline. | app | The ring (2 px at a 4 px offset) left the 24 px box and covered neighbours; the checked ring took the text colour, white in the dark scheme. | fixed: each swatch stands in a 44 px box that holds its ring; checked takes the accent, hover the strong border, focus the focus ring. Checked in Chromium |

## Owner feedback, third round

| # | Report | Owner | Diagnosis | Status |
|---|---|---|---|---|
| 13 | "Record balance" opens a form at the bottom of the reconciliation tab; the change can pass unnoticed and the click looks like it did nothing. | app | The form replaced nothing visible: it opened inside the section, below the heading, with no focus move. | fixed: the form opens in a dialog (`accounts/assertion-dialog.tsx`) with a title and a description; `?assert=true` still opens it |
| 14 | In the bank entity pickers, the logo boxes have a background that removes the logo's contrast; some logos are invisible on the dark ground. | Slotted (S5) | The avatar paints its soft tone behind a loaded picture; bank logos are drawn for a white ground. | fixed: the institution and set-logo pickers draw each logo on the white plate of the account marks (`accounts/institution-option.tsx`); checked in Chromium |
| 15 | The "Inside account" (parent account) selector is too plain. | app | A plain select of names. | fixed: `accounts/parent-field.tsx`, a searchable picker grouped like the kind chooser, each candidate with its mark, kind and how many accounts it holds; the field says where the account will stand in the balance sheet |
| 16 | Drawers (the installment plan drawer among them) open and close with no enter or exit animation, although the Slotted storybook animates them. | Slotted (S4) and app | A drawer or dialog mounted already open starts in its open state (no enter); the screens unmounted the overlay on close (no exit). The storybook drives `open` on a mounted drawer. | fixed: `ui/presence.tsx` mounts the overlay closed, opens it from an effect and keeps it, closed, through its exit; the 15 dialogs and 2 drawers of the plan use it. Checked in Chromium: the panel slides in over 330 ms and out before it leaves |
| 17 | The table rules (under the header, above the sum row) are heavier than every other border and read as a strong line. | app (theme) | The header rule took `--slotted-border-strong`; the equori theme drew the total with a 3 px double rule in the same colour. | fixed: `--slotted-table-border-color-strong` (and the data grid's) is halfway between the subtle and the strong border; the total has one thin rule in it |
| 18 | Editing a card without changing anything and saving shows "Fix the marked fields to continue." | app | `draftProblems` checked a credit card's billing setup (closing and due day) on every save; the edit draft starts from an empty setup and the edit form shows no billing fields, so the errors marked hidden fields. | fixed: the billing and plastic-card rules apply on create only (`draftProblems(draft, mode)`); test "saves a card's edit without asking for the billing a new card sets up" RED→GREEN |

## Found while checking the screens in Chromium (not reported by the owner)

| # | Problem | Status |
|---|---|---|
| C1 | The card's "Next to pay" figure and the tile's line showed only the oldest open statement (R$ 50) while four statements held R$ 5.882,90. | fixed: both sum every closed statement still owing and name the oldest due date |
| C2 | The kind tag of a record and the kind tiles read the sentence form of the kind ("checking"). | fixed: `kindTitle` gives the capitalised form for tags, tiles and fields |
| C3 | "Last reconciliation: Never" carried the note "The institution's balance matched the ledger". | fixed: a never-reconciled account says to record the institution's balance |
| C4 | "1 cards" in the cards subheading. | fixed: a singular sentence for one card |
| C5 | A statement's purchases read "+R$ 198,65", as a change, under a "Change" column. | fixed: purchases read as plain amounts, credits and payments with the minus sign, under "Amount" |
| C6 | In the installment plan drawer, choosing "Bring forward" recorded the anticipation at once: React reused the clicked button as the confirm, a `type="submit"` button, and the browser ran its default action after the click. | fixed: the choice and the confirm buttons are keyed apart (`cards/plan-drawer.tsx`); test pins that the confirm is a new element |
| C7 | The card's plans tab read the three farthest statements, which installments create years ahead, and missed the plans running now. | fixed: the tab reads the statements from two before the open one to the next one |
| C8 | The drawer's schedule cut its State column at 24 rem, and the plan's status tag stretched across the drawer. | fixed: the drawer is `lg`; the tag stands in an `Inline` |

## Slotted findings (to report in the plan's final reply)

| # | Finding | Kind | Area | Workaround |
|---|---|---|---|---|
| S1 | A sparkline animates its path (`transition: d`) when its container resizes, so a line in a cell that settles after mount grows visibly; nothing gives it a width of its own. | bug | family — sparkline `line`, `area` | `accounts/account-trend.module.css` |
| S2 | `entity-picker` with `items` draws every match on each key (492 rows with images here); the list is not windowed. | improvement | family — entity-picker `content` | `accounts/catalogue-search.ts` (paged `source`) |
| S3 | `Link` and `ListItemLink` hand `data-*: undefined` to `render`, which a router link's props refuse under `exactOptionalPropertyTypes`. | bug | family — link, list-item `render` props | `ui/use-app-link.ts` (href plus click handler) |
| S4 | A dialog or drawer mounted with `open` starts in its open state and plays no enter; nothing tells the app when the exit ended, so an overlay rendered conditionally cannot play its exit. | bug and feature | family — dialog, drawer presence | `ui/presence.tsx` |
| S5 | An avatar paints its soft tone behind a loaded picture; a logo with transparency drawn for a white ground disappears in the dark scheme. | bug | family — avatar `image` over `root` | `accounts/institution-option.tsx` |
| S6 | The entity-picker's `renderOption` example sets `data-part="label"`, but the layout places parts by `data-part-label`; parts rendered as the example shows fall out of the grid. | docs | docs — entity-picker.md, Composition | `accounts/institution-option.tsx`, `accounts/parent-option.tsx` |
| S7 | The entity-picker's input leaves the browser's spellcheck on: a chosen name is underlined as a misspelling. | bug | family — entity-picker `input` | `spellCheck={false}` in the three pickers |

## Problems met during the work (not Slotted)

| # | Problem | Status |
|---|---|---|
| P1 | Under Vitest 5's jsdom environment, a Request carrying a FormData cannot be read back with `formData()` in a fake route; the routes read the multipart body as text. | worked around in `import-page.test.tsx` |
| P2 | A concurrent session works in the same worktree (reimbursement and repayment plans); its in-progress tests and types fail `pnpm typecheck` and `pnpm lint` on files outside this plan. | open: theirs |
| P3 | With other sessions running tests, the machine's load average reached 22 and page tests timed out at 10 to 20 s; reruns at normal load pass. | mitigated: `src/testing/setup.ts` lets a find wait 4 s; 204 tests pass at load 16 |
| P4 | `StatementPosting` carries no dispute state and no endpoint lists the disputes of a statement or an account; the statement page reads `GET /transactions/{id}/disputes` once per charge line to mark open disputes. A flag (or the open dispute id) on `StatementPosting` would remove those requests. | open: backend contract |
| P5 | No endpoint lists an account's installment plans; the card's plans tab collects plan ids from the postings of the three latest statements and reads each plan. A plan with no installment billed yet on those statements is missing until its first one is billed. | open: backend contract |
| P6 | `api/openapi.yaml` gained `getAccountFlows` (another session); `admin/operations.test.ts` fails until that operation is listed in `admin/operations.ts`. | open: theirs |
