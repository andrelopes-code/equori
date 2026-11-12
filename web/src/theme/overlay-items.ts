// Items inside a dialog or a drawer. The panel is a surface at the raised step and the families
// draw their grounds and borders from the same step, so a table, a card or a section inside it
// melted into the panel (1.00:1 of ground and 1.3:1 of border). Inside an overlay each family
// reads a wash and a ring of the text colour, which step clear of the panel in every scheme:
// about 1.1:1 and 1.5:1 of it. A frame is a large area and takes a lighter wash than the account
// picker's rows (8% and 22%), which are small and need more to read against the panel.

const dialogContent =
  '[data-ui="dialog"] > [data-part="viewport"] > [data-part="content"]:not(:has(> [data-ui="command-palette"]))';

const overlayDrawer =
  '[data-ui="drawer"][data-mode="overlay"] > [data-part="panel"]';

const overlays = `:is(${dialogContent}, ${overlayDrawer})`;

const wash = "color-mix(in oklab, var(--slotted-text) 3%, transparent)";
const ring = "color-mix(in oklab, var(--slotted-text) 14%, transparent)";

// One block per family keeps each selector's declarations together for the generated CSS.
const block = (
  selector: string,
  washed: readonly string[],
  ringed: readonly string[],
) =>
  `${overlays} ${selector} {\n${[
    ...washed.map((token) => `  ${token}: ${wash};`),
    ...ringed.map((token) => `  ${token}: ${ring};`),
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
    ["--slotted-table-surface", "--slotted-table-header-surface"],
    ["--slotted-table-border-color"],
  ),
  block(
    '[data-ui="list"][data-variant="framed"]',
    ["--slotted-list-background"],
    ["--slotted-list-border-color"],
  ),
  block(
    '[data-ui="data-grid"][data-variant="framed"]',
    ["--slotted-data-grid-surface", "--slotted-data-grid-header-surface"],
    ["--slotted-data-grid-border-color"],
  ),
];
