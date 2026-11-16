// What the rows of a table paint over glass: a pinned cell shows the row's own ground, and
// the band of a group keeps its words inside the visible part of the scroller.

import type { Block } from "./css.ts";
import {
  blur,
  container,
  family,
  media,
  noBlur,
  rule,
  supports,
} from "./css.ts";

const table = family("table");
// A table that keeps the cell inset on its outer edges; `flush` aligns them with the heading.
const inset = `${table}[data-edges="inset"]`;
const body = `${table} [data-part="body"]`;
const pinnedEnd = `${body} [data-sticky="end"]`;
const pinnedStart = `${body} [data-sticky="start"]`;
const pinned = [pinnedEnd, pinnedStart];
const frost = blur("var(--glass-blur-strong)", "100%");

const scroller = `${inset}:has([data-part="group-row"]) [data-part="scroll"]`;
const band = `${inset} [data-part="group-header"]`;
const bandContent = `${inset} [data-part="group-content"]`;

// The cell padding the library reads, which an inset table also uses for its outer edges.
const padding =
  "var(--slotted-table-cell-padding-inline, var(--slotted-control-padding-inline-md, 13px))";

export const tableRules: readonly Block[] = [
  // Workaround for Slotted issue #123: a pinned body cell repaints the row's ground over the row's
  // own, so a translucent hover or selection reads twice as strong on the pinned column, and its
  // sticky fill is the page surface, a darker tone than the card it stands on. The cell paints
  // nothing, so the row's ground and the card show alone. While content passes under it, the strong
  // blur alone hides that content, as in a table header (sticky.ts), and a saturation would turn the
  // card's tone bluer. A browser without scroll-state keeps the library's fill.
  supports("(container-type: scroll-state)", [
    rule(pinned, { background: "transparent" }),
  ]),
  container("scroll-state(scrollable: inline-end)", [rule(pinnedEnd, frost)]),
  container("scroll-state(scrollable: inline-start)", [
    rule(pinnedStart, frost),
  ]),
  // Without transparency nothing is blurred, so the cell takes the card's opaque fill.
  media("(prefers-reduced-transparency: reduce)", [
    rule(pinned, { ...noBlur, "background-color": "var(--glass-fill-card)" }),
  ]),
  // Workaround for Slotted issue #124: the band of a group is one cell as wide as the table, so its
  // total, at the end, scrolls out of view. The scroller is a container whose width the band's
  // content takes, pinned to the start edge, and the cell's padding moves to that content so the
  // words keep their place. The band's ground and rule still span the table. The scroll-state
  // container type of sticky.ts is kept beside the inline size.
  rule(scroller, { "container-type": "inline-size" }),
  supports("(container-type: scroll-state)", [
    rule(scroller, { "container-type": "inline-size scroll-state" }),
  ]),
  rule(band, { "padding-inline": "0" }),
  rule(bandContent, {
    position: "sticky",
    "inset-inline-start": "0",
    "box-sizing": "border-box",
    "inline-size": "100cqi",
    "padding-inline": padding,
  }),
];
