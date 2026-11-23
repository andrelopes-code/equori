// What the rows of a table paint over glass: a pinned cell shows the row's own ground.

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
const body = `${table} [data-part="body"]`;
const pinnedEnd = `${body} [data-sticky="end"]`;
const pinnedStart = `${body} [data-sticky="start"]`;
const pinned = [pinnedEnd, pinnedStart];
const frost = blur("var(--glass-blur-strong)", "100%");

const scroller = `${table} [data-part="scroll"]:has([data-part="group-row"])`;

export const tableRules: readonly Block[] = [
  // The sticky fill is the page surface, a darker tone than the card the table stands on, so a pinned
  // body cell takes none and the row's ground and the card show alone. While content passes under
  // it, the strong blur alone hides that content, as in a table header (sticky.ts), and a saturation
  // would turn the card's tone bluer. A browser without scroll-state keeps the library's fill.
  supports("(container-type: scroll-state)", [
    rule(pinned, { "--slotted-table-sticky-surface": "transparent" }),
  ]),
  container("scroll-state(scrollable: inline-end)", [rule(pinnedEnd, frost)]),
  container("scroll-state(scrollable: inline-start)", [
    rule(pinnedStart, frost),
  ]),
  // Without transparency nothing is blurred, so the cell takes the card's opaque fill.
  media("(prefers-reduced-transparency: reduce)", [
    rule(pinned, { ...noBlur, "background-color": "var(--glass-fill-card)" }),
  ]),
  // The scroll-state container type of sticky.ts is kept beside the inline size that holds the band
  // of a group in view.
  supports("(container-type: scroll-state)", [
    rule(scroller, { "container-type": "inline-size scroll-state" }),
  ]),
];
