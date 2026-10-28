import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { flattenTheme } from "@slotted/theme";
import { themeConformance } from "@slotted/theme/conformance";
import contract from "@slotted/theme/contract.json" with { type: "json" };
import glass from "./equori-glass.theme.ts";
import equori from "./equori.theme.ts";

const css = readFileSync(
  new URL("./equori-glass.gen.css", import.meta.url),
  "utf8",
);

themeConformance({ contract, theme: flattenTheme(glass), css });

const standardRules = equori.rules ?? [];
const glassRules = glass.rules ?? [];
const glassOnly = glassRules.slice(standardRules.length).join("\n");

test("the standard theme carries nothing of the glass", () => {
  assert.equal(standardRules.join("\n").includes("--glass-"), false);
  assert.notEqual(glassOnly, "");
});

test("the glass extends the standard theme's rules and tokens and replaces none", () => {
  assert.deepEqual(glassRules.slice(0, standardRules.length), standardRules);
  assert.deepEqual(glass.components, equori.components);
  assert.deepEqual(glass.seeds, equori.seeds);
});

// `&` is the theme's root element, which carries the scheme; a bare attribute selector would look
// for a descendant of the root and match nothing.
test("every glass selector is held to the dark scheme, on the theme's root", () => {
  const selectors = glassOnly
    .split("\n")
    .filter((line) => /^\s*[&[]/.test(line) && !line.includes(":"));
  assert.ok(selectors.length > 0);
  for (const line of selectors) {
    assert.match(line.trim(), /^&\[data-slotted-scheme="dark"\] /, line);
  }
});

test("an overlay's content blurs what is behind it", () => {
  for (const [name, token] of [
    ["menu", "--slotted-menu-backdrop-filter"],
    ["popover", "--slotted-popover-backdrop-filter"],
    ["tooltip", "--slotted-tooltip-backdrop-filter"],
    ["select", "--slotted-select-content-backdrop-filter"],
  ] as const) {
    assert.ok(
      css.includes(
        `[data-ui="${name}"] {\n      ${token}: blur(var(--glass-blur))`,
      ),
      `${name} content is not blurred`,
    );
  }
});

test("a hover and a selected row are washes over the glass, not opaque steps", () => {
  assert.match(
    css,
    /--slotted-tone-secondary-subtle-hover:\s*color-mix\(in oklab, var\(--slotted-text\) var\(--glass-wash-hover\)/,
  );
  assert.match(
    css,
    /--slotted-table-row-surface-selected:\s*color-mix\(in oklab, var\(--slotted-tone-accent-solid\)/,
  );
});

test("reduced transparency turns every role opaque and drops the blur", () => {
  const block =
    /@media \(prefers-reduced-transparency: reduce\) \{\s*&\[data-slotted-scheme="dark"\] \[data-ui="card"\][^]*?--glass-alpha-card: 100%/.exec(
      css,
    );
  assert.ok(block !== null, "the reduced transparency rule is missing");
});

test("a section's sticky header is filled only while it is stuck", () => {
  assert.match(
    css,
    /\[data-part="header"\]\[data-stuck\]::before \{[^}]*background-color: var\(--glass-fill-frost\);[^}]*backdrop-filter: blur\(var\(--glass-blur-strong\)/,
  );
  assert.match(
    css,
    /:not\(\[data-divider\]\) > \[data-part="header"\]\[data-stuck\]::before \{\s*inset-block-end: calc\(-1 \* var\(--slotted-space-4\)\)/,
  );
});

test("a dialog and a drawer blur through their own tokens", () => {
  assert.match(
    css,
    /\[data-ui="dialog"\] \{[^}]*--slotted-dialog-backdrop-filter: blur\(var\(--glass-blur\)/,
  );
  assert.match(
    css,
    /\[data-ui="drawer"\] \{[^}]*--slotted-drawer-backdrop-filter: blur\(var\(--glass-blur\)/,
  );
});

// The footer is sticky inside the panel, so the body scrolls under it; the panel's blur reaches only
// what is behind the panel.
test("an overlay drawer's footer blurs the body that scrolls under it", () => {
  const footer =
    '[data-ui="drawer"][data-mode="overlay"] > [data-part="panel"] > [data-part="footer"]';
  const declarationsOf = (selector: string) =>
    [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
      .filter(([, selectors]) => selectors?.includes(selector))
      .map(([, , body]) => body ?? "");
  const bodies = declarationsOf(footer);
  assert.ok(
    bodies.some((body) =>
      body.includes("backdrop-filter: blur(var(--glass-blur)"),
    ),
    "the footer is not blurred",
  );
  assert.ok(
    bodies.some((body) => body.includes("backdrop-filter: none")),
    "reduced transparency keeps the footer's blur",
  );
});

// The grid draws its lattice of dots under the widgets while editing, and a card's fill is
// translucent: without a blur the dots show through the card.
test("a dashboard widget's card blurs only while the grid is editing", () => {
  const editing =
    '[data-ui="dashboard-grid"][data-editing] [data-part="widget"] > [data-ui="card"]';
  const rules = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)];
  const bodies = rules
    .filter(([, selectors]) => selectors?.includes(editing))
    .map(([, , body]) => body ?? "");
  assert.ok(
    bodies.some((body) =>
      body.includes("backdrop-filter: blur(var(--glass-blur)"),
    ),
    "the editing widget's card is not blurred",
  );
  assert.ok(
    bodies.some((body) => body.includes("backdrop-filter: none")),
    "reduced transparency keeps the editing widget's card blurred",
  );
  const bareCard = rules.filter(
    ([, selectors, body]) =>
      body?.includes("backdrop-filter: blur(") &&
      (selectors ?? "")
        .split(",")
        .some(
          (selector) =>
            selector.trim().endsWith(' [data-ui="card"]') &&
            !selector.includes("data-editing"),
        ),
  );
  assert.deepEqual(bareCard, [], "a card outside an editing grid is blurred");
});

// A plain bar stands on the page footer, which is already a blurred material; a second blur inside
// it samples the footer and reads as a more solid ground.
test("only a raised action bar blurs what is behind it", () => {
  // The library reads the token on the raised bar only.
  assert.match(
    css,
    /\[data-ui="action-bar"\] \{\s*--slotted-action-bar-backdrop-filter: blur\(var\(--glass-blur\)/,
  );
  const blurs = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].filter(
    ([, selectors, body]) =>
      selectors?.includes('[data-ui="action-bar"]') &&
      /(^|\s)backdrop-filter: blur\(var\(--glass-blur\)/.test(body ?? ""),
  );
  for (const [, selectors] of blurs) {
    for (const selector of (selectors ?? "").split(",")) {
      if (!selector.includes('[data-ui="action-bar"]')) continue;
      assert.ok(
        selector.includes('[data-variant="raised"]'),
        `blurs a plain bar: ${selector.trim()}`,
      );
    }
  }
});

// The transactions pane publishes a solid page ground for the standard theme; a section's header
// reads it at rest and would paint a solid band over the glass.
test("a section and a detail panel publish no page ground of their own", () => {
  assert.match(
    css,
    /\[data-ui="section"\],\s*&\[data-slotted-scheme="dark"\] \[data-ui="detail-panel"\] \{[^}]*--slotted-page-ground: transparent/,
  );
});

// The washes of states.ts replace the secondary surface inside the glass; a key cap keeps the
// opaque surface of the standard dark scheme, so it reads as a key over an accent button too.
test("a key cap keeps the opaque secondary surface", () => {
  assert.match(
    css,
    /&\[data-slotted-scheme="dark"\] \[data-ui="kbd"\]\[data-variant="soft"\] \{\s*--slotted-kbd-surface: oklch\(from var\(--slotted-seed-neutral\) 0\.274 min\(calc\(c \* 0\.22\), 0\.046\) h\);/,
  );
});

test("a raised surface carries a lift of light over its tint", () => {
  assert.match(
    css,
    /--glass-fill-card: color-mix\(in oklab, var\(--glass-light\) var\(--glass-lift-card\), color-mix\(in oklab, var\(--slotted-surface-raised\) var\(--glass-alpha-card\), transparent\)\)/,
  );
  assert.match(css, /--glass-lift-card: \d+%/);
});

test("a framed data-grid takes the page fill, not the card's", () => {
  assert.match(
    css,
    /\[data-ui="data-grid"\]\[data-variant="framed"\] \{[^}]*--slotted-data-grid-surface: var\(--glass-fill-page\)/,
  );
});

// The frame paints the fill once; a row that paints it again stacks a second layer on every line.
test("a framed grid's rows and selection cells paint nothing at rest", () => {
  const rows =
    /\[data-ui="data-grid"\]\[data-variant="framed"\] \[data-part="row"\]:not\(\[data-selected\]\),[^{]*\{([^}]*)\}/.exec(
      css,
    )?.[1] ?? "";
  assert.ok(rows.includes("background-color: transparent;"), rows);
});

// Chromium draws a backdrop filter as a rectangle that an ancestor's rounded clip does not cut, so
// a framed grid's blurred head rounds its own top corners to the frame's inner radius.
test("a framed grid's blurred head follows the frame's rounded corners", () => {
  const radius =
    "calc(var(--slotted-data-grid-radius, var(--slotted-radius-md)) - var(--slotted-data-grid-border-width, var(--slotted-border-width-thin)))";
  const head =
    /\[data-ui="data-grid"\]\[data-variant="framed"\] > \[data-part="scroll"\] > \[data-part="head"\] \{([^}]*)\}/.exec(
      css,
    )?.[1] ?? "";
  assert.ok(head.includes(`border-start-start-radius: ${radius};`), head);
  assert.ok(head.includes(`border-start-end-radius: ${radius};`), head);
});

// Chromium makes an ancestor whose opacity is below 1 the backdrop root of its descendants, so a
// popup that fades its positioner shows its content's blur only once the fade ends. The glass
// fades the blurred content itself and keeps the positioner opaque.
test("a chart's tooltip blurs what is behind it", () => {
  assert.match(
    css,
    /\[data-ui="chart"\] \[data-part="tooltip"\][^{]*\{[^}]*backdrop-filter: blur\(var\(--glass-blur\)\)/,
  );
});
