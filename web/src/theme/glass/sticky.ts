// Bars that pinned content scrolls under. A page's ground is transparent so the aurora shows
// through, and a sticky header reads that ground, which leaves nothing to hide the rows that pass
// under it. These bars take a fill of their own, and a blur where the bar is one element.

import type { Block, Declarations } from "./css.ts";
import { blur, family, rule } from "./css.ts";
import { fill } from "./material.ts";

const sectionHeader = `${family("section")}[data-sticky] > [data-part="header"]`;
const gridHead = `${family("data-grid")} > [data-part="scroll"] > [data-part="head"]`;
const framedGridHead = `${family("data-grid")}[data-variant="framed"] > [data-part="scroll"] > [data-part="head"]`;

// Chromium draws a backdrop filter as a rectangle that an ancestor's rounded clip does not cut: a
// framed grid's blurred head would show square corners outside the frame's rounded ones. The head
// rounds its own top corners to the frame's inner radius, read from the tokens the frame reads.
const frameInnerRadius =
  "calc(var(--slotted-data-grid-radius, var(--slotted-radius-md)) - var(--slotted-data-grid-border-width, var(--slotted-border-width-thin)))";

// A section's header has a ground only while content passes under it. At rest it is part of the
// section, so it paints nothing: a fill there would read as a band over the page. The pseudo-element
// is the frost, and exists only while the header is stuck to the top: a strong blur under a light
// tint, so the page shows through and what passes under the header cannot be read. The tint keeps
// the header legible where an engine draws no blur.
export const stuckFill = `${sectionHeader}::before`;
const stuck = `${sectionHeader}[data-stuck]::before`;
const stuckWithoutDivider = `${family("section")}[data-sticky]:not([data-divider]) > [data-part="header"][data-stuck]::before`;

// The elements that carry a blur, which reduced transparency turns off.
export const blurredBars = [sectionHeader, stuckFill, gridHead];

// The bars that are on screen all the time: a blur there is redrawn each time the aurora moves, so
// a phone drops it. A stuck header is on screen only while the page scrolls, and keeps its blur.
export const permanentBars = [gridHead];

// A bar made of many cells is filled and not blurred: a blur per cell is redrawn on every scroll.
const filledBars = [
  `${family("table")}[data-sticky-header] [data-part="column-header"]`,
  `${family("table")} [data-part="group-row"][data-sticky] > [data-part="group-header"]`,
];

const ground: Declarations = { "background-color": fill("sticky") };
const frostTint: Declarations = { "background-color": fill("frost") };
const frosted = blur("var(--glass-blur)", "var(--glass-saturate)");
const strongFrost = blur("var(--glass-blur-strong)", "var(--glass-saturate)");

export const stickyRules: readonly Block[] = [
  rule(stuck, {
    content: '""',
    position: "absolute",
    inset: "0",
    "z-index": "-1",
    "pointer-events": "none",
    ...frostTint,
    ...strongFrost,
  }),
  // A header with no divider has its padding above the title only (the library pulls it up by
  // that padding), so the band reaches as far below the title as it does above it.
  rule(stuckWithoutDivider, {
    "inset-block-end": "calc(-1 * var(--slotted-space-4))",
  }),
  rule(gridHead, { ...ground, ...frosted }),
  rule(framedGridHead, {
    "border-start-start-radius": frameInnerRadius,
    "border-start-end-radius": frameInnerRadius,
  }),
  rule(filledBars, ground),
  rule(family("data-grid"), {
    "--slotted-data-grid-header-surface": fill("sticky"),
  }),
];
