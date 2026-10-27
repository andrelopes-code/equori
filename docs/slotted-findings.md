# Slotted findings

Registry of the findings reported to the Slotted owner (`web/CLAUDE.md`, "Slotted feedback"). One row per finding, keyed by its title. The title is the exact text the workaround comment in `web/` quotes.

| State      | Meaning                                                                |
| ---------- | ---------------------------------------------------------------------- |
| `reported` | Reported; no workaround in `web/`.                                     |
| `open`     | Reported; at least one comment in `web/` names it.                     |
| `fixed`    | The installed Slotted version fixes it; no comment in `web/` names it. |

`web/src/testing/slotted-findings.test.ts` checks the registry against the comments: every title a comment names is listed, an `open` row has a comment, and a `fixed` row has none. Moving a row to `fixed` is done in the commit that removes its workaround.

| Title                                                                                                    | State    |
| -------------------------------------------------------------------------------------------------------- | -------- |
| The page publishes no block size of its scrollport for a sticky element's height cap                     | open     |
| compose-screen does not route a screen with a sticky element of its own to LA-06                         | reported |
| A calendar day cannot carry a mark of what falls on it                                                   | reported |
| A data-grid editor cannot commit the value it sets in the same event                                     | open     |
| a dialog or drawer mounted open plays no enter transition, and one unmounted on close plays no exit      | open     |
| A full-screen dialog without a body places its footer in the stretched row                               | open     |
| An overlay sheet draws side borders at the width of the screen                                           | open     |
| A drawer's slide duration has no token                                                                   | open     |
| A pinned table cell has no ground, so the cells that scroll under it show through                        | open     |
| A server-mode data-grid does not group the rows it is given                                              | open     |
| A sticky section header exposes no stuck state                                                           | open     |
| A theme rule's bare scheme attribute matches nothing on the theme root                                   | open     |
| An edge progress bar shown again during its exit resumes its sweep mid-track                             | open     |
| AppShellFooter drops its ref when render is given                                                        | open     |
| Autofill tint is painted on the input element, over the frame's border                                   | open     |
| ButtonLink render props cannot be spread onto a router link                                              | open     |
| Chart data rejects rows typed as an interface                                                            | open     |
| Closing a drawer to navigate is undone by the drawer's history step back                                 | open     |
| CommandPalette has no backdrop-filter token for a material surface                                       | open     |
| currency-field holds the amount as a float in major units                                                | open     |
| Data-grid re-renders every row when messages or a renderer changes identity                              | open     |
| Data-grid rows re-render on every scroll step and every selection change                                 | fixed    |
| Dialog content's opacity transition suppresses a descendant's backdrop blur until the fade ends          | open     |
| dialog has no place for a form around its parts                                                          | open     |
| Dialog sends focus back to its opener when onOpenChange changes identity                                 | open     |
| entity-picker leaves the browser's spellcheck on its input                                               | open     |
| Every element with a data-part attribute is matched against about 4 900 selectors                        | open     |
| Glyph offsets centre the ink box, not the shape the eye reads                                            | open     |
| light-dark() compiles to variables no stylesheet defines                                                 | open     |
| No command keeps the agent instruction snippet in sync with the installed version                        | open     |
| No command makes the skills available to a coding agent                                                  | open     |
| No hook gives an element of the application's own the menu's roving focus                                | reported |
| Overlay surfaces have no backdrop-filter token for a material surface                                    | open     |
| PageHeader offers no material ground over scrolling content                                              | open     |
| PageHeader paints its stuck ground without a transition                                                  | open     |
| Prompt composer's focus outline fades in from the text colour                                            | open     |
| sparkline animates its path while its container is still being sized                                     | open     |
| Spinner mask is a data: URL that a strict CSP blocks                                                     | open     |
| Spinner rotation is a SMIL animation inside a mask image                                                 | open     |
| tags-input offers no suggestions                                                                         | open     |
| The data-grid's load-more fires until hasMore is false when the grid does not scroll                     | open     |
| The glyph set has no chevron-left or arrow-right                                                         | open     |
| The selection checkbox of a data-grid row is named by its key                                            | open     |
| Toast has no backdrop-filter token for a material surface                                                | open     |
| Toggling aria-busy restyles every element below it                                                       | open     |
| DetailPanelSection count badge sits inside an uppercase heading and misaligns with it                    | reported |
| Action-bar stacks every action below 24rem and hides its overflow                                        | open     |
| Toolbar's overflow control is named in English whatever the language                                     | open     |
| The data-grid docs do not say which props must keep their identity                                       | reported |
| The tabs marker transitions layout properties and loses its motion under main-thread work                | reported |
| Dragging a bottom sheet re-renders the drawer and relayouts it on every pointer move                     | reported |
| A bottom sheet exposes no state for reaching its maximum extent                                          | reported |
| The drawer docs state two defaults for size                                                              | reported |
| LA-03 leaves actions under a rich title and a form's footer bar without a one-row rule                   | reported |
| The last column's resizer overflows the data-grid frame                                                  | reported |
| A button label breaks inside a word                                                                      | reported |
| A new tree object rebuilds every row of a data-grid                                                      | open     |
| LP-12 makes a phone's grid as tall as its rows, which defeats windowing and scroll loading               | reported |
| compose-screen's performance check covers only region switches                                           | reported |
| PageHeader keeps a toolbar on the title row beside a rich title                                          | reported |
| Chart card actions sit lower than the toolbar beside them                                                | open     |
| The splitter docs list no props, anatomy, events or example                                              | reported |
| A bottom sheet drags at a low frame rate and a fast downward fling ends without a continuous exit        | reported |
| No runtime axis for the corner radius                                                                    | open     |
| A sticky table of contents has no inset under the page chrome                                            | open     |
| A section divider on a surface stops at the inset                                                        | reported |
| The section anatomy does not say the description belongs inside the title                                | reported |
| A soft key cap has no surface token of its own                                                           | open     |
| A popup's positioner fade suppresses its content's backdrop blur until the fade ends                     | open     |
| The markdown family needs an outside parser for plain CommonMark                                         | open     |
| A markdown tree in a message bubble collapses the bubble to its padding                                  | reported |
| A message scroller without items keeps its content hidden                                                | open     |
| The drawer header has no slot for actions beside the title                                               | open     |
| A message scroller in a bottom sheet keeps a pull at its top from moving the sheet                       | open     |
| The prompt composer's ring glow is cut by its own mask and overflows its container                       | open     |
| The prompt composer has no dictation action                                                              | reported |
| Dashboard-grid picks its column class from its own width, so a 1280 px window loses the layout           | reported |
| Dashboard-grid rows have a fixed height and a widget cannot size to its content                          | reported |
| Dashboard-grid widget headings default to level 3 under a page heading of level 1                        | reported |
| Dashboard-grid widget detail link cannot render a router link                                            | reported |
| A link in a card, chart or section action takes the slot's font size and has no size axis                | open     |
| Attachment preview thumbnail is not lazy-loaded                                                          | open     |
| The list-item anatomy does not say which part holds which                                                | reported |
| A list item with its parts out of order renders without layout or a warning                              | reported |
| Dashboard grid reads widget props only from its direct children                                          | open     |
| The overviews guideline does not lead to the dashboard grid                                              | reported |
| A dashboard widget with automatic rows rounds its height up to whole rows of 4.5rem                      | reported |
| Reset returns the dashboard grid to an empty layout instead of its default layout                        | reported |
| A chart in a dashboard widget keeps a plot of one and a half rows whatever the widget's height           | open     |
| The app-shell pane resizer draws no line or grip of the splitter                                         | reported |
| A description list folds two columns to one at 34rem of its container with no prop to move the threshold | reported |
