// What the theme leaves clear so the aurora behind the application shows through. The shell's
// content card (surfaces.ts) is the one ground the glass paints; the shell's frame and canvas, the
// Page inside the card, and a grid's ground and bands sit transparent on it. A framed grid stands
// on the page as a card does, so it takes the card's fill.

import type { Rule } from "./css.ts";
import { family, rule } from "./css.ts";
import { fill } from "./material.ts";

const clear = "transparent";

export const groundRules: readonly Rule[] = [
  rule(family("app-shell"), {
    "--slotted-app-shell-frame": clear,
    "--slotted-app-shell-canvas": clear,
  }),
  rule(family("page"), {
    "--slotted-page-background-sunken": clear,
    "--slotted-page-background-surface": clear,
  }),
  // A pane of the application's own may publish a solid page ground (the transactions pane does,
  // for the standard theme); a section's header reads that ground at rest and would paint a solid
  // band. Under the glass a section publishes none of its own, and a stuck header is filled
  // by sticky.ts.
  rule([family("section"), family("detail-panel")], {
    "--slotted-page-ground": clear,
  }),
  rule(family("data-grid"), {
    "--slotted-data-grid-surface": clear,
    "--slotted-data-grid-band-surface": clear,
  }),
  rule(`${family("data-grid")}[data-variant="framed"]`, {
    "--slotted-data-grid-surface": fill("card"),
  }),
];
