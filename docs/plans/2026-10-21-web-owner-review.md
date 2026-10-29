# Owner review of the transactions and categories screens (2026-10-21)

Each item is one report of the owner. `Owner` is who fixes it: `app` (this repository), `slotted` (the
library; the finding number refers to `2026-10-21-slotted-findings.md`), or both. `Status` is `open`,
`fixed` (with the commit), or `reported` (a Slotted finding with no workaround possible in the app).

Measurements: Chrome 141 headless, 1440 × 900, production build, review user with 205 transactions.

## Transactions list

| # | Report | Owner | Diagnosis | Status |
|---|---|---|---|---|
| 1 | Navigating to Transactions freezes the page for about 1500 ms. | slotted 1, app | Long task of 1 003 ms on mount: 1 731 elements at 0.24 ms of style matching each (finding 1) plus rendering. The app part is the element count and the Intl formatters. | fixed `b0d77c1` (mount long task 1 003 → 691 ms, production); rest is finding 1 |
| 2 | The period filter is a plain select of presets; a period needs a purpose-built control (presets, months, custom range). | app, slotted 10 | The app used the FilterBar's select field; the guidelines never ask whether a family answers the domain problem well. | fixed `b0d77c1` (PeriodControl: steps, presets, range calendar) |
| 3 | The page header is under-used: no description, actions badly placed, refresh button shows its spinner beside its icon. | app, slotted 6, 12 | The spinner is the IconButton's loading state (finding 6). The header's content is the app's. | fixed `b0d77c1` (subheading, period, totals, primary action); spinner: reported (finding 6) |
| 4 | Scrolling, resizing and every interaction with the transactions grid drops frames. | slotted 1, 3, 4; app | Every visible row renders again on each scroll step (finding 3); each re-render rewrites the row checkboxes and invalidates style (finding 1); roving focus forces style reads (finding 4). App: each cell built new Intl formatters (611 ms of 3 s in the scroll profile). | fixed `0f09168`, `b0d77c1` (Intl cache; unwindowed rows: no long task while scrolling); page append 480–680 ms remains (finding 3) |
| 5 | Selecting rows in the grid lags. | slotted 1, 3, 5 | One click: every row renders again (finding 3); the action bar's offset is written on `main` and recalculates 1 800 elements twice (finding 5). | reported (findings 1, 3, 5); 1.1–1.4 s per click remains |
| 6 | The command palette lags when it opens, closes and when the pointer moves over its items. | slotted 1, 2 | Each highlight move tears down and rebuilds the modal layer (`inert` on every element outside, body scroll lock): 1.3 s per move. | reported (findings 1, 2); 1.3 s per pointer move remains |
| 7 | Grids stand without a frame, as a bare block; they do not match the application's surfaces. | app, slotted 11 | Every grid used the default `variant="ruled"`; `framed` exists. | fixed `b0d77c1`, `699fa5c` (framed grids) |
| 8 | The grid does not group by day and does not weight important values (amounts); a ledger list needs its own reading. | app, slotted 10 | A generic grid was used for a ledger; no day groups, no daily totals, amount not dominant. | fixed `b0d77c1` (day groups with totals, two-line rows, amount in semibold); grouping needs client mode (finding 17) |
| 9 | The detail panel's header scrolls away with its content; it should stay at the top. Applies to every panel. | slotted 7 | `scroll="self"` is set; the header is `position: relative`. | reported (finding 7); no workaround without styling the family's parts (O5) |
| 10 | Buttons inside grid cells are as tall as the cell and paint over the selected cell's inset ring on hover. | slotted 8, app | The ring is under the cell content (finding 8); the app put buttons in cells. | fixed `b0d77c1`, `699fa5c` (rows of 56 and 44 px); reported (finding 8) |
| 11 | Opening the category editor in a cell has a high INP; its buttons overflow the cell. | slotted 1, 8; app | Opening the editor mounts a popover over a 1 700-element page (finding 1). | fixed `b0d77c1` (editor opens in 189 ms on the queue); rest is finding 1 |
| 12 | A "Load more" button shows although the grid already loads more on scroll. | slotted 9 | The grid's footer always offers Load more with `hasMore`. | reported (finding 9) |
| 13 | An icon-only button uses `Button` instead of `IconButton` and renders broken. | slotted 6 | The control is an `IconButton`; the broken look is finding 6. No icon-only `Button` exists in the app. | reported (finding 6) |

## New transaction form

| # | Report | Owner | Diagnosis | Status |
|---|---|---|---|---|
| 14 | The money input is a plain field with odd hover borders; money entry needs a dedicated control of the application. | app, slotted 10 | A plain currency-field; no sign control, no emphasis. | fixed `0b9c718` (MoneyInput) |
| 15 | The date is always picked by hand; it needs shortcuts (today, yesterday) and presets. | app | A bare date-picker. | fixed `0b9c718` (today, yesterday, day before) |
| 16 | Accounts in a plain select, and the form laid out without care; the entry form is a core screen. | app | A select without balances, icons or recent accounts. | fixed `0b9c718` (account tiles; amount first, focused on desktop) |

## Categories

| # | Report | Owner | Diagnosis | Status |
|---|---|---|---|---|
| 17 | Same header and grid problems as Transactions; tab content is slow to load and to switch. | slotted 1, app | Same causes as 1 and 4; each tab mounts a full grid. | fixed `699fa5c` (header, framed grid, tab paints in 32 ms instead of 450 ms) |
| 18 | The row action button in the last column overflows the cell over the inset ring. | slotted 8 | See 10. | fixed `699fa5c` (44 px rows); reported (finding 8) |
| 19 | Category dialog: icons are small and badly laid out; few colours; the chosen colour and icon are not persisted (saved as letter and neutral colour). | app | Persistence: the dev server on :8080 started before `925cb11` (the list endpoint omitted colour and icon); a server built from `main` lists them. Picker layout: the app's. | fixed `699fa5c` (larger tiles in the chosen colour); persistence: restart the :8080 dev server, it predates `925cb11` |
| 20 | Rules tab: stat cards are unbalanced; one has a long wrapping label, the others hold only a label and a value, leaving empty space. | app, slotted 13 | The app mixed a long description into one card. | fixed `699fa5c` (one structure per card) |
| 21 | Columns are not pinned where they should be (action columns). | app, slotted 14 | No grid sets `pinned` on its actions column. | fixed `699fa5c` (actions pinned at the end); reported (finding 14) |
| 22 | The rule form does not make advanced matching (regular expressions) visible; the "When / Then" layout reads poorly. | app | The backend supports regex (RE2, case-sensitive, matched on the original text); the operator was named "matches" with no hint. | fixed `f423b2a` (regex named and explained; steps on surfaces) |
| 23 | Rules must be flexible enough for any user-defined condition. | backend | Fields: description, raw description, payee, amount, absolute amount, account, account kind, source, weekday, day of month, installment; operators: equals, contains, starts with, regex, between, greater/less than, in list. No OR and no NOT. | open: the backend accepts only an AND of up to 20 conditions with no negation; OR groups and negated operators need a domain amendment (owner decision) |
| 24 | Screens do not refresh after an action; new, changed or deleted records only show after a reload. | app, slotted 15 | Mutations invalidated only their own keys; category totals (`reports`), rule statistics and suggestions stayed stale. | fixed `0f09168` (every query stale after a write) |
| 25 | Page widths vary between narrow, wide and full without a visible pattern; some pages look squeezed. | app, slotted 16 | CP-07 assigns bleed, wide and content by page type. | fixed `b55d4f2` (full for destinations, wide for forms) |
