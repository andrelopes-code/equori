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
- **Workaround:** none in the family; equori caches its Intl formatters so its cell renderers cost less.

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
- **Workaround:** none in the family; the transactions list redesign removes buttons from cells.

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
