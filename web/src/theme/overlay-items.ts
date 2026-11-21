// Items inside a dialog or a drawer. The panel is a surface at the raised step and the families
// draw their grounds and borders from the same step, so a table, a card or a section inside it
// melted into the panel (1.00:1 of ground and 1.3:1 of border). Inside an overlay each family
// reads a wash and a ring of the text colour, which step clear of the panel in every scheme:
// about 1.1:1 and 1.5:1 of it. A frame is a large area and takes a lighter wash than the account
// picker's rows (8% and 22%), which are small and need more to read against the panel.

const family = (name: string) => `[data-ui="${name}"]`;

const dialogContent =
  '[data-ui="dialog"] > [data-part="viewport"] > [data-part="content"]:not(:has(> [data-ui="command-palette"]))';

const overlayDrawer =
  '[data-ui="drawer"][data-mode="overlay"] > [data-part="panel"]';

const overlays = `:is(${dialogContent}, ${overlayDrawer})`;

const wash = "color-mix(in oklab, var(--slotted-text) 3%, transparent)";
const ring = "color-mix(in oklab, var(--slotted-text) 14%, transparent)";

// A pinned header covers the rows that scroll under it, so it is opaque: the raised step of the
// panel with a wash on top. 6% lands where the header of a table that does not pin lands (the
// frame's wash and the header's, over the panel), which the page measures.
const pinned =
  "color-mix(in oklab, var(--slotted-text) 6%, var(--slotted-surface-raised))";

// One block per family keeps each selector's declarations together for the generated CSS.
const block = (
  selector: string,
  washed: readonly string[],
  ringed: readonly string[],
  opaque: readonly string[] = [],
  framed = "",
) =>
  `${overlays} ${selector} {\n${[
    // A frame paints its wash once, on its root. A row paints the surface token again over the
    // frame, so the token is clear and the wash does not stack (a body at 6% beside a card at 3%).
    ...(framed === ""
      ? []
      : [`  ${framed}: transparent;`, `  background-color: ${wash};`]),
    ...washed.map((token) => `  ${token}: ${wash};`),
    ...ringed.map((token) => `  ${token}: ${ring};`),
    ...opaque.map((token) => `  ${token}: ${pinned};`),
  ].join("\n")}\n}`;

export const overlayItemRules: readonly string[] = [
  block(
    '[data-ui="card"]',
    ["--slotted-card-background"],
    ["--slotted-card-border-color"],
  ),
  block(
    '[data-ui="stat-card"]',
    ["--slotted-stat-card-background"],
    ["--slotted-stat-card-border-color"],
  ),
  block('[data-ui="section"]', ["--slotted-section-surface"], []),
  block(
    '[data-ui="table"]',
    ["--slotted-table-header-surface"],
    ["--slotted-table-border-color"],
    ["--slotted-table-sticky-surface"],
    "--slotted-table-surface",
  ),
  block(
    '[data-ui="list"][data-variant="framed"]',
    ["--slotted-list-background"],
    ["--slotted-list-border-color"],
  ),
  block(
    '[data-ui="data-grid"][data-variant="framed"]',
    [],
    ["--slotted-data-grid-border-color"],
    ["--slotted-data-grid-header-surface"],
    "--slotted-data-grid-surface",
  ),
  // The glass paints a pinned header cell and a pinned column straight on the element; the value
  // of the table above would lose to it.
  `${overlays} ${family("table")}[data-sticky-header] [data-part="column-header"] {\n  background-color: ${pinned};\n}`,
  `${overlays} ${family("table")} [data-part="group-row"][data-sticky] > [data-part="group-header"] {\n  background-color: ${pinned};\n}`,
  `${overlays} ${family("table")} [data-sticky] {\n  --slotted-table-sticky-surface: ${pinned};\n}`,
  // Workaround for Slotted issue #159: the caption paints no ground of its own, so above a
  // header with a surface it reads as a band of another tone. A wash over the frame's lands on
  // the header's 6%.
  `${overlays} ${family("table")} [data-part="caption"] {\n  background-color: ${wash};\n}`,
];
