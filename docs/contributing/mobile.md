# Mobile screens

A phone is a screen of its own, not the desktop screen made narrow. The phone routes of ADR 027 (S3) answer this guide at widths below 600 px (the compact size class of Slotted). Every other route is desktop-only and renders a notice on the phone (ADR 027, S4). Mandatory reading before writing or changing a phone route.

Rules marked with a Slotted ID (LP-01, OV-02) are in `web/node_modules/@slotted/react/dist/docs/guidelines/`. Rules marked NN/g come from nngroup.com articles "Mobile Tables", "Tabs, Used Right", "Scrolling and Attention" and "Mobile User Experience". Rules marked equori are decisions of this application.

## M1 · A screen declares its purpose

Each phone route is one of three kinds. The kind fixes the phone pattern.

| Kind          | Example                                     | Desktop                              | Phone                                                                                                 |
| ------------- | ------------------------------------------- | ------------------------------------ | ----------------------------------------------------------------------------------------------------- |
| Comparison    | statement lines, installments               | `data-grid`                          | `data-grid` with the pop-in (LP-01): row header and priority columns stay, the rest move into the row |
| Record work   | accounts, cards, transactions               | `data-grid` with an `actions` column | `DataList` swapped in with `createWidthGate` at `COMPACT_BELOW` over the same sort and selection      |
| Reading       | help pages                                  | `Markdown` prose and a `List` of pages | the same prose and list in one column; no table                                                     |

A phone grid never scrolls sideways (LP-01). Horizontal scroll is accepted only for a comparison table that cannot lose a column (NN/g), with the header row and the first column pinned and a cut-off last column as the scroll cue.

## M2 · The first screen holds what the reader acts on

- At 390×844 the first screen shows the page header and the first records or the primary action (NN/g: attention concentrates at the top; each new element pushes another below the fold).
- Figures, charts and history follow the records (OV-02). Figures are one `list` of rows that are destinations, not a stack of cards.
- A chart is one tab of its own beside the list (LP-10), or sits below the records on a phone. It never stands above the list.
- A block above the list takes at most one third of the viewport height. Taller blocks collapse behind a one-line summary.

## M3 · One scroller

Below 600 px the page scrolls and the listing is as tall as its rows. The grid does not scroll itself (LP-12). A grid with `hasMore` gets no `hasMore` on a phone and the page's scroller asks for the next page.

## M4 · Tabs change the visible content

An in-page tab holds similar content and switches instantly (NN/g). The reader must see the switch.

- Tabs stand directly above the panel they control. Content shared by every tab never stands between the tabs and the panel. Content shared by every tab stands above the tabs, or moves into the panel of each tab.
- The selected tab carries two indicators, for example underline and weight (NN/g). Unselected tabs keep readable contrast.
- On a tab change below the fold, the page scrolls to the top of the panel (equori).
- Navigation tabs and in-page tabs never share one control (NN/g).

## M5 · Controls and density

- A touch target is at least 44×44 px (equori).
- The density control is decided by the pointer, not by the width (LP-11).
- Actions of a row: one primary action on the row, the others in a menu or drawer opened from the row.
- A selection bar becomes a footer bar with the confirming action fixed (LP-03).
- A drawer opens from the bottom below 600 px (`side="bottom"` with `DrawerResizer`, `size="content"` or `"full"`) and from the end above it; the footer of a long drawer stays fixed.

## M6 · Review gate

A mobile review of a screen records two captures, 360×640 and 390×844, and quotes the rule broken for each finding. The gate is review. There is no custom lint script.

A route promoted to the phone states its kind (M1) in its pull request. A screen that departs from a rule here names the rule and the reason in the pull request.
