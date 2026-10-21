# Slotted findings from the owner review (2026-10-21)

Findings for `@slotted/react` 0.1.0-beta.7, diagnosed from the owner review tracked in
`2026-10-21-web-owner-review.md` (item numbers in brackets). Measurements: Chrome 141 headless,
1440 × 900, production build (`vite build` + `vite preview`), review user with 205 transactions,
`/transactions` with 51 rendered rows and 1 731 DOM elements.

### 1. Every element with a `data-part` attribute is matched against about 4 900 selectors

- **Kind:** bug
- **Area:** family — `styles.css` (all families)
- **Problem:** Of the 9 610 selectors in `styles.css`, 4 856 end in a `[data-part=…]` compound, 2 130 in a `[data-ui=…]` compound and 2 198 have no attribute, class, id or tag in the rightmost compound. Blink buckets attribute selectors by attribute name only, so each element carrying `data-part` is tested against the 4 856 selectors on every style recalculation.
- **Evidence:** forcing a full style recalculation on `/transactions` takes 400 ms with `styles.css` and 15 ms with `styles.css` disabled. Bisecting the stylesheet by halves removes cost in proportion to the number of rules removed; no single rule dominates. Cost per element: about 0.24 ms.
- **Impact on equori:** every interaction that invalidates a large subtree (a dialog opening, the action bar appearing, a hover in the command palette) costs 400 to 1 300 ms. Owner items 1, 4, 5, 6, 11, 17.
- **Workaround:** none; equori can only lower the number of elements on screen.

```
Bug — styles.css selector matching cost.
Observed: styles.css holds 9,610 selectors; 4,856 have a rightmost compound keyed only by [data-part=…] and 2,130 by [data-ui=…]. Blink (and WebKit) bucket attribute selectors by attribute NAME, so every element that carries data-part is matched against all 4,856 selectors, every element with data-ui against 2,130. A full style recalculation of a page with 1,731 elements costs ~400 ms with styles.css and ~15 ms without it (Chrome 141, production build). Removing half of the rules removes half of the cost: the cost is the number of rules sharing a bucket, not one expensive rule.
Expected: a style recalculation of 1,700 elements under 30 ms.
Repro: a page with one DataGrid of 50 rows × 7 columns plus an app shell; in DevTools run `performance.now()` around `document.documentElement.style.setProperty('--x', Math.random()); document.body.offsetHeight` with and without styles.css.
Proposed direction: give every part a selector whose rightmost compound lands in a small bucket — a per-family-part class emitted by the components (e.g. class="sl-data-grid__cell" alongside the data attributes), or an attribute whose NAME carries the family and part (data-sl-data-grid-cell). Keep [data-ui]/[data-part] as the public test hooks. Move the 2,198 selectors with an unkeyed rightmost compound (`*`, `:is(...)` without a keyed argument, `:lang(...)` lists) behind a keyed compound.
Acceptance: a benchmark page (DataGrid 50 rows × 7 columns, AppShell, PageHeader) measured in CI with Chrome: forced full style recalculation under 30 ms; it measures ~400 ms today.
```

### 2. A modal dialog re-registers its layer on every render of its owner

- **Kind:** bug
- **Area:** family — `dialog` (`DialogContent` layer effect), seen through `command-palette`
- **Problem:** The effect that registers the dismissable layer, sets `inert` on every sibling up to `<html>` and locks body scroll lists the whole dialog context object in its dependencies (`[node, context]` in `dist/dialog-*.js`). The context object changes on each render of the dialog root, so each render tears the layer down and builds it again.
- **Evidence:** pointer moves over command-palette items: per move, `inert` is removed and added on `HEAD`, `SCRIPT` and every sibling of the dialog's ancestors, and `style` on `BODY` is written twice (MutationObserver log). Each move is a long task of 1 280 to 1 350 ms (production build), 2 045 ms for the opening.
- **Impact on equori:** the command palette is unusable: highlight follows the pointer at under 1 frame per second. Owner item 6.
- **Workaround:** none.

```
Bug — dialog: the modal layer is destroyed and rebuilt on every render.
Observed: in DialogContent the effect that calls the layer registration (inert on all siblings up to <html>, body scroll lock, focus containment) depends on [contentNode, dialogContext]. The context value is a new object on every render of the dialog root, so any re-render — the command palette moving its highlight on pointer move — releases inert and the scroll lock and applies them again. Each cycle writes `inert` on every element outside the dialog and `style` on <body>, invalidating style for the whole document.
Expected: the layer is registered once per open, and only open/close, modal, back, escape and outsidePress changes re-register it; callbacks are read through refs.
Repro: <CommandPalette items={30 items}/> on a page with 1,500 elements; open it and move the pointer over the items; a MutationObserver on document records `inert` and body `style` mutations on every move.
Acceptance: a test that opens a modal Dialog, forces 5 re-renders of its root with a changing unrelated prop, and asserts that `inert` on a sibling element was set exactly once (MutationObserver count) and body style written exactly once; it fails today with 5.
```

### 3. Data-grid rows re-render on every scroll step and every selection change

- **Kind:** bug
- **Area:** family — `data-grid` (row component and grid context)
- **Problem:** The row is wrapped in `memo`, but it reads the whole grid context, and the context value changes when the window scrolls or the selection moves; every rendered row and every cell renderer runs again.
- **Evidence:** scrolling 120 px rewrites `name` and `type` on all 51 row checkboxes (408 attribute mutations for 4 wheel steps); selecting one row rewrites them on every row (308 mutations). Scroll in the development build: long tasks of 120 to 350 ms per wheel step; production: 662 ms worst task for 40 steps; selection click: 1 309 ms long task (production).
- **Impact on equori:** scrolling the transactions grid drops to a few frames per second; selecting a row freezes the page for over a second. Owner items 4, 5.
- **Workaround:** `transactions-grid.tsx` sets `virtualize={false}` and the list pages 30 rows at a time: mounted rows scroll natively (a windowed wheel step measured 120 to 170 ms, an unwindowed one no long task). The cost moves to selection and to appending a page (480 to 680 ms), which stay slow until the fix.

```
Bug — data-grid: every row re-renders on scroll and on selection.
Observed: the row component is memo()-wrapped but calls the grid context hook, whose value changes on scroll (window range) and on selection; every visible row and every cellRenderer runs again. React 19 rewrites name/type on each checkbox <input> it re-renders, so each scroll step also invalidates style for every row.
Expected: a scroll step renders only the rows that enter the window; a selection change renders only the rows whose selected state changed (plus the header checkbox).
Repro: DataGrid with 200 rows, selectionMode="multiple", a cellRenderer that increments a counter; scroll by one row: the counter grows by the window size instead of ~1; click one checkbox: it grows by the window size instead of 1.
Proposed direction: split the context into a stable one (callbacks, column model) and per-row selectors (useSyncExternalStore with a row-keyed selector for selected/current/editing/expanded).
Acceptance: a test with a counting cellRenderer: one checkbox press re-renders exactly one row; a scroll that moves the window by one row renders at most two rows.
```

### 4. Roving focus reads computed style for every item when it collects items

- **Kind:** bug
- **Area:** utility — `@slotted/core` focus (`dist/focus-*.js`, item collection filter)
- **Problem:** The item collection filters hidden items with `getComputedStyle(item).visibility` for every item, which forces a synchronous style recalculation inside the render or event handler; with finding 1 each forced recalculation costs hundreds of milliseconds.
- **Evidence:** CPU profile of a grid scroll (development build): the filter function is the third largest self-time entry, 649 ms of 3 s.
- **Impact on equori:** adds to items 4, 5, 6.
- **Workaround:** none.

```
Bug — @slotted/core focus: item collection forces style recalculation.
Observed: the roving-focus collector runs `[...root.querySelectorAll(itemSelector)].filter(isVisible)`, where isVisible calls getComputedStyle(el).visibility per item. It runs on render/keyboard paths, so every collection forces a synchronous style recalculation of the dirty tree.
Expected: no layout or style read on the render path; visibility resolved lazily at navigation time (only for the candidate item being moved to), or by `checkVisibility()` called only when a key is pressed.
Repro: a DataGrid of 50 rows; record a CPU profile while scrolling; the collector's filter shows hundreds of ms of self time, including forced recalcs.
Acceptance: a test that spies on getComputedStyle and asserts zero calls while a roving-focus group renders or re-renders; it calls once per item today.
```

### 5. Page writes inherited custom properties on `main` when its footer changes

- **Kind:** bug
- **Area:** family — `page` (`--slotted-page-sticky-top`, `--slotted-page-sticky-bottom` on `main[data-part=main]`)
- **Problem:** When the page footer mounts (an action bar for a selection), the page removes and writes `--slotted-page-sticky-bottom` in the inline style of `main`. The property is not registered with `inherits: false`, so the change invalidates style for every descendant, twice.
- **Evidence:** selecting one row on `/transactions`: two `style` mutations on `MAIN[data-part=main]` (`--slotted-page-sticky-bottom` removed, then `67px`), followed by two style recalculations of 1 815 and 1 658 elements (453 ms and 404 ms, trace `UpdateLayoutTree`).
- **Impact on equori:** the selection bar takes about one second to appear. Owner item 5.
- **Workaround:** none.

```
Bug — page: footer offset written as an inherited custom property on main.
Observed: Page writes --slotted-page-sticky-top/--slotted-page-sticky-bottom inline on main[data-part=main]; when a footer (ActionBar) mounts, the bottom value is removed and re-added. Custom properties inherit by default, so each write invalidates every element under main (1,800 elements here, ~430 ms each with the current stylesheet).
Expected: changing the footer recalculates style for the elements that read the offset only.
Proposed direction: register the offsets with @property { inherits: false } and set them on the elements that consume them, or write them once per size change on a dedicated element, never removing then re-adding.
Acceptance: a test that mounts a Page with 500 descendants, mounts a footer, and asserts one style write on main (MutationObserver) and that the trace shows a recalc of fewer than 50 elements; today two writes and a full-subtree recalc.
```

### 6. IconButton in its loading state shows the spinner beside the icon

- **Kind:** bug
- **Area:** family — `button` (`IconButton`, `loading`)
- **Problem:** `IconButton loading` keeps the icon and appends the spinner in the same part, so the square button shows two glyphs side by side.
- **Evidence:** `/transactions`, refresh button while the list reloads: `<span data-part="icon">` holds the `rotate-ccw` icon and `<span data-ui="spinner" data-part="indicator">`; screenshot shows both glyphs in a 36 px square.
- **Impact on equori:** the header's refresh control looks broken. Owner items 3 and 13 (the control is an `IconButton`; the defect is the family's).
- **Workaround:** none.

```
Bug — button: IconButton loading renders the spinner next to the icon.
Observed: <IconButton aria-label="Refresh" loading><Icon><Glyph name="rotate-ccw"/></Icon></IconButton> renders <span data-part="icon">{icon}<span data-ui="spinner" data-part="indicator"/></span>: both glyphs show side by side.
Expected: while loading, the spinner takes the icon's place at the icon's size; the icon is hidden (kept in the DOM for width stability) and the button keeps its square size.
Acceptance: a visual or DOM test: in the loading state the icon is not rendered visibly (visibility hidden or replaced) and the button's bounding box equals the non-loading one.
```

### 7. DetailPanel with `scroll="self"` does not keep its header in view

- **Kind:** bug
- **Area:** family — `detail-panel` (`scroll="self"`) with `page-header`
- **Problem:** The docs say that under `scroll="self"` the root is the scroll container and the header sticks inside it. The root scrolls, but the page-header is `position: relative` and scrolls away with the content.
- **Evidence:** `/transactions?selected=<id>` at 1440 px: `article[data-ui=detail-panel][data-scroll=self]` has `overflow-y: auto`, client height 631 px, scroll height 1 134 px; its `[data-ui=page-header]` has computed `position: relative`.
- **Impact on equori:** the transaction pane loses its title and actions when scrolled. Owner item 9; every pane and drawer.
- **Workaround:** none.

```
Bug — detail-panel: header does not stick under scroll="self".
Observed: <DetailPanel scroll="self"> with a PageHeader as first child inside a fixed-height container: the article scrolls (overflow-y:auto) but the header's computed position is relative; it scrolls out of view.
Expected: as documented (detail-panel.md, scroll prop), the header sticks to the top of the root while the sections scroll, with its surface and a bottom border once content passes under it.
Acceptance: a browser test: a panel 400px tall with 1,200px of sections; after scrolling the root by 600px the header's top equals the root's top.
```

### 8. Controls inside data-grid cells paint over the cursor ring

- **Kind:** bug
- **Area:** family — `data-grid` (`cell`, current-cell ring) with `button`
- **Problem:** The current-cell ring is an inset shadow on the cell. A button in the cell is as tall as the row; on hover or press its surface paints over the ring, so the button appears to jump out of the cell.
- **Evidence:** `/transactions`, category column (`Button size="sm" variant="ghost"`), and `/categories`, actions column (`IconButton size="sm"`), at the comfortable density.
- **Impact on equori:** owner items 10, 11, 18.
- **Workaround:** grids that hold buttons set a `rowHeight` taller than the button (`transactions-grid.tsx` 56 px, the category grids 44 px), so the ring stays visible.

```
Bug — data-grid: cell content covers the current-cell ring.
Observed: the cursor ring is an inset box-shadow on [data-part=cell]; a Button/IconButton of size sm fills the row height, and its hover surface paints over the ring.
Expected: the ring is drawn above the cell content (an ::after overlay with pointer-events:none and a z-index above content), and a control in a cell is inset from the cell's edges by the cell's block padding, at every density.
Acceptance: a visual test of a current cell holding a hovered ghost button: the ring's pixels are visible on all four edges.
```

### 9. A data-grid in server mode shows "Load more" although it loads on scroll

- **Kind:** improvement
- **Area:** family — `data-grid` (`hasMore`, `onLoadMore`, footer)
- **Problem:** With `hasMore` the footer always offers a Load more button, while `onLoadMore` is already called when the window nears the end; the reader sees a control whose purpose is unclear.
- **Evidence:** `/transactions`, footer of the grid.
- **Impact on equori:** owner item 12.
- **Workaround:** none.

```
Improvement — data-grid: Load more next to infinite loading.
Need: a grid that loads its next page on scroll should not also show a Load more button; the button is the fallback for when automatic loading is off or failed.
Proposed API: loadMore: 'scroll' | 'button' | 'both' (default 'scroll' when onLoadMore is set and virtualization is on). Under 'scroll' the footer shows a quiet loading row while a page loads and a Retry button only after a failure.
Acceptance: a test with hasMore and onLoadMore and the default setting: no Load more button in the footer; scrolling to the end calls onLoadMore once.
```

### 10. The screen skill lets a domain value fall back to a generic field

- **Kind:** improvement
- **Area:** agent — `dist/docs/skills/compose-screen/SKILL.md`, step 4 and step 6; guideline — `composition.md` CP-04
- **Problem:** CP-04 allows an element of the screen's own "where no family answers the problem", but nothing in the skill asks which values the product is about, or whether the family that technically accepts a value answers the reader's task with it. A period became a filter-bar date field with an operator, money a plain currency-field, an account a select of names, a ledger a generic grid without days. Every check of step 6 passed.
- **Evidence:** equori `0b9c718`, `b0d77c1` replaced each of those with an element of the app's own after the owner review (items 2, 8, 14, 15, 16). The skill's step 4 lists CP-04 as the last bullet, after LP-14's "A list longer than a hundred rows is a data-grid".
- **Impact on equori:** the transactions list, the entry form and the period filter read as generic admin screens; the owner rejected all three.
- **Workaround:** `web/CLAUDE.md` section "Screens", rule "Domain controls before families".

```
Improvement — agent instructions: compose-screen skill, domain values.
Current text (skills/compose-screen/SKILL.md, step 4, last bullet): "Where no anatomy answers the problem, the screen writes an element of its own instead of bending a family into a shape it does not have (CP-04)."
Problem: an agent reads "answers the problem" as "accepts the value". A period, an amount of money, a choice among five accounts and a list of ledger entries are each accepted by a generic family (filter-bar date field, currency-field, select, data-grid), so CP-04 never triggers, and the product's core screens end up generic.
Replacement for step 1 (new first step): "Name the values the product is about on this screen — money, a period, a day, an account, a person — and the task the reader performs with each (enter it in one motion, step it, compare it). For each, write which family accepts the value and whether that family performs the task in one step with the value's own words; when it does not, CP-04 applies before any family is chosen."
Add to step 6 (Done): "5. For each value named in step 1, the control that edits it was chosen against the task, and the reason is written beside it."
Acceptance: run the skill on a fixture brief ('a personal finance ledger with a period and an entry form'); the produced plan names the period, the amount and the account as domain values and chooses an element of the screen's own for at least the period and the amount — a check the current text does not produce.
```

### 11. Data-grid's default variant draws no frame, and no rule says when to frame it

- **Kind:** improvement
- **Area:** guideline — `list-pages.md`; family — `data-grid` (`variant` default `ruled`)
- **Problem:** The grid defaults to `ruled`, a block of rows with no outer edge, and no list-page rule chooses between `plain`, `ruled` and `framed`; on the application's raised page surface every grid read as a bare slab.
- **Evidence:** every grid of equori before `b0d77c1` and `699fa5c` used the default; owner item 7.
- **Impact on equori:** all lists looked unfinished.
- **Workaround:** `web/CLAUDE.md` "Grids": `variant="framed"` on every grid.

```
Improvement — guideline: list-pages, the grid's frame.
Need: a rule that decides a grid's variant from where it stands. Today data-grid defaults to `ruled` and list-pages.md is silent.
Proposed rule (LP-15, SHOULD): "A grid that stands on the page's surface beside other blocks is `framed`; a grid that is the page's only body under a `bleed` page may be `ruled`; `plain` is for a grid inside a card or a panel that already draws the frame." Consider making `framed` the default of data-grid when the page is not `bleed`.
Acceptance: a check in the review-screen sweep table — "a data-grid with no variant on a page whose width is not bleed" — that finds the defect in a fixture page.
```

### 12. Header guidance leaves a list page with a bare title

- **Kind:** improvement
- **Area:** guideline — `list-pages.md`, `layout-alignment.md` LA-03; agent — `skills/compose-screen/SKILL.md`
- **Problem:** The guidelines describe a subheading only for records (`record-pages.md`) and reports (`reports.md`); a list page gets a heading, tabs and actions, and nothing asks what the reader must know before the list (what the page covers, the period, its totals) or which action is primary.
- **Evidence:** equori's Transactions and Categories headers before `b0d77c1`/`699fa5c`: a heading and a refresh icon; owner item 3.
- **Impact on equori:** headers were "under-used"; the period and totals had no place.
- **Workaround:** `web/CLAUDE.md` "Headers".

```
Improvement — guideline: list-pages, the header's content.
Proposed rule (LP-16, SHOULD): "A list page's header holds: a subheading that says what the list covers; the control of the period when the list reads one; the page's figures for that period in the header area (a line of label-over-figure pairs, not cards); and the primary action as the last, solid control. A refresh control is an icon button, never the only action."
Acceptance: the review-screen skill gains a step that, on a fixture list page with only a heading, reports LP-16.
```

### 13. Stat cards in a row have no rule for a balanced structure

- **Kind:** improvement
- **Area:** guideline — `record-pages.md` RP-02 and `overviews.md`; family docs — `stat-card.md`
- **Problem:** Nothing says that the cards of one row share their parts. One card with a long label and a wrapping comparison beside three cards with a label and a value gave four boxes of the height of the tallest, three of them mostly empty.
- **Evidence:** equori `/categories/rules` before `699fa5c`; owner item 20.
- **Impact on equori:** the coverage row looked broken.
- **Workaround:** none needed after the fix: `categories/coverage.tsx` gives every card a short label, a value and one comparison line.

```
Improvement — guideline: stat-card rows.
Proposed rule (SHOULD, in overviews.md and record-pages.md): "The stat-cards of one row share their structure: a label of at most three words, the figure, and the same optional parts on every card (a comparison of one line, or none on any). Detail that only one card has goes into its comparison or a tooltip, never into a longer label."
Acceptance: a fixture row of four cards where one has a twelve-word label; the review-screen sweep reports the rule.
```

### 14. No rule pins an actions column

- **Kind:** improvement
- **Area:** guideline — `list-pages.md`; family — `data-grid` (`kind: "actions"`)
- **Problem:** A column of `kind: "actions"` is not pinned by default and no guideline asks for it; when the columns scroll sideways the row's actions leave the frame.
- **Evidence:** equori's category, payee and rule grids before `699fa5c`; owner item 21.
- **Impact on equori:** row menus scrolled out of reach on narrow frames.
- **Workaround:** `defaultColumnState={{ pinned: { start: [], end: ["actions"] } }}` on each grid.

```
Improvement — data-grid: pin the actions column.
Proposed API: a column of kind 'actions' is pinned to the end by default (pinned: 'end' in the column model, overridable); a rowHeader column is pinned to the start when the grid scrolls sideways.
Guideline (LP-17, SHOULD): "The row header and the actions column are pinned; nothing else is pinned without a reason the page states."
Acceptance: a grid with an actions column and 12 columns in a 600px frame; after scrolling to the end of the columns the actions cell is in view, without any columnState given.
```

### 15. No guideline says that a write refreshes every view it changed

- **Kind:** improvement
- **Area:** guideline — `async-feedback.md`; agent — `skills/waiting-states/SKILL.md`
- **Problem:** AF rules cover what a region draws while it waits and after a mutation is "read back", but none requires that a write refreshes the other views it changes (totals, counts, coverage). Screens kept stale figures until a reload.
- **Evidence:** equori before `0f09168`: categorizing a transaction left the category totals and the rules coverage stale; owner item 24.
- **Impact on equori:** the owner had to reload after every action.
- **Workaround:** `web/src/api/query-client.ts` invalidates every query after a successful mutation.

```
Improvement — guideline: async-feedback, refresh after a write.
Proposed rule (AF-xx, MUST): "A successful write marks stale every query whose answer the write can change, and the regions on screen read again; when the app cannot list them, it marks all queries stale. A region that read again keeps its rows and dims them (LP-06)."
Add to skills/waiting-states/SKILL.md a step: "For each control that writes, list the regions on any screen whose figures the write changes, and show where they are refreshed."
Acceptance: the waiting-states skill run on a fixture with a 'categorize' action and a 'totals by category' panel produces a plan that refreshes the panel.
```

### 16. CP-07 gives each page type its own measure, so the measure jumps

- **Kind:** improvement
- **Area:** guideline — `composition.md` CP-07
- **Problem:** CP-07 makes a list `bleed`, a record `wide`, a form `content`. Moving between destinations changes the column's measure, and a form at 56 rem stands narrow in a desktop frame.
- **Evidence:** equori before `b55d4f2`: Transactions `bleed`, Categories `wide`, new transaction `content`; owner item 25 ("pages look squeezed, and there is no pattern").
- **Impact on equori:** inconsistent and narrow pages.
- **Workaround:** `web/CLAUDE.md` "Page width (replaces CP-07)": destinations `full`, forms `wide`.

```
Improvement — guideline: CP-07 page width.
Current text (composition.md CP-07): "A list page is `bleed` with `fill`; a record, a dashboard and an overview keep the default `wide`; a create or edit form is `content`; a page of preferences read as prose is `measure`."
Replacement: "Every destination of the navigation — list, record, dashboard, overview — has the same width (`full`), so moving between destinations never moves the column's edges. A create or edit form is `wide` and lays its fields out in a grid of the form's own; a page of prose is `measure`."
Acceptance: the review-screen sweep reports two destinations of one app with different widths.
```

### 17. A server-mode data-grid does not group the rows it is given

- **Kind:** bug
- **Area:** family — `data-grid` (`mode="server"`, `query.group`, `renderGroup`)
- **Problem:** In server mode the grid builds one row node per row and ignores `query.group`; grouping, group rows and their aggregates exist only in client mode, although a server that pages by date can deliver rows already ordered for grouping.
- **Evidence:** `dist/data-grid-*.js`: under `mode === "server"` the nodes are `{ kind: "row", groups: [] }` for every row. equori's day groups render only with `mode="client"`.
- **Impact on equori:** the transactions grid runs in client mode to group by day.
- **Workaround:** `web/src/features/transactions/transactions-grid.tsx`, `mode="client"` with an empty sort.

```
Bug — data-grid: grouping ignored in server mode.
Observed: <DataGrid mode="server" rows={rows} defaultQuery={{...emptyQuery(), group: ['date']}} renderGroup={...}/> renders no group rows; the node builder for server mode emits plain rows.
Expected: in server mode the grid groups the rows it is given, in their order (consecutive rows with the same group key form one group), with group rows, toggles and aggregates as in client mode; sorting stays the server's.
Acceptance: a server-mode grid with 6 rows over 3 dates and group ['date'] renders 3 group rows with counts 2, 2, 2.
```

### 18. The glyph set has no chevron-left or arrow-right

- **Kind:** improvement
- **Area:** family — `icon` (`GlyphName`)
- **Problem:** The library's glyphs include `chevron-right`, `chevron-down`, `arrow-left` and `arrow-up`, but not `chevron-left` or `arrow-right`; a previous/next pair cannot be drawn from one set.
- **Evidence:** `@slotted/core/dist/types/glyph/glyphs.d.ts`; equori's period and month steppers.
- **Impact on equori:** an own SVG for the steppers.
- **Workaround:** `web/src/ui/step-glyph.tsx`.

```
Improvement — icon: complete the directional glyphs.
Need: previous/next steppers (month, period, pagination) and back/forward links need both directions.
Proposed API: add chevron-left, chevron-up, arrow-right and arrow-down to GlyphName, with the same viewBox and stroke as the existing chevrons and arrows.
Acceptance: the glyph contract test lists each direction for chevron and arrow.
```

### 19. light-dark() compiles to variables no stylesheet defines

- **Kind:** bug
- **Area:** family — `segmented-control` (`indicator`) and `event-calendar`; the build of `@slotted/react/styles.css`
- **Problem:** Lightning CSS lowers each `light-dark()` of the family stylesheets to `var(--lightningcss-light, A) var(--lightningcss-dark, B)`. The pair is only declared where a rule sets `color-scheme` through Lightning CSS, and no rule of the shipped CSS does: `styles.css` reads the pair 20 times and declares it 0 times, in 0.1.0-beta.7 and 0.1.0-beta.8. Both fallbacks are then substituted side by side, the value is invalid at computed-value time, and the property falls back to its initial value.
- **Evidence:** `/transactions/new`, Chrome 141, every scheme: the segmented-control indicator computes `background-color: rgba(0, 0, 0, 0)`, so the chosen segment is drawn only by its 10 % border over the track. With `--lightningcss-light: ; --lightningcss-dark: initial` declared on `<html>`, the indicator computes `oklab(0.314 …)` in dark and `oklch(0.985 …)` in light.
- **Impact on equori:** the chosen kind of the entry form (expense, income, transfer) is not raised above the track.
- **Workaround:** `web/src/app/app.css` declares the pair for each `data-slotted-scheme` value.

```
Bug — build: light-dark() lowered to undeclared variables.
Observed: @slotted/react/dist/styles.css contains var(--lightningcss-light, …) var(--lightningcss-dark, …) pairs (segmented-control indicator background, event-calendar event hues) but declares neither variable anywhere, so the computed value is invalid and the property resolves to its initial value: the segmented-control thumb is transparent in every scheme.
Expected: the indicator is surface-raised in light and text 14 % over surface-raised in dark, as the source's light-dark() states.
Repro: render <SegmentedControl defaultValue="a"><Segment value="a"/><Segment value="b"/></SegmentedControl> under data-slotted-theme="default" data-slotted-scheme="dark"; getComputedStyle of [data-part="indicator"] gives background-color rgba(0, 0, 0, 0).
Fix: either target browsers with native light-dark() so Lightning CSS keeps it, or have the theme's scheme blocks declare --lightningcss-light/--lightningcss-dark next to color-scheme (on :scope and the seeds element), or replace light-dark() in family CSS with a scheme token.
Acceptance: a build check fails when styles.css reads a --lightningcss-* variable that no shipped stylesheet declares, and a browser test asserts the indicator background is not transparent in light and dark.
```
