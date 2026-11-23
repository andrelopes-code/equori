import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { flattenTheme } from "@slotted/theme";
import { themeConformance } from "@slotted/theme/conformance";
import contract from "@slotted/theme/contract.json" with { type: "json" };
import theme from "./equori.theme.ts";

const css = readFileSync(new URL("./equori.gen.css", import.meta.url), "utf8");

const components = theme.components ?? {};

themeConformance({ contract, theme: flattenTheme(theme), css });

test("seeds are indigo, violet graphite, yellow and red", () => {
  assert.equal(theme.seeds.accent, "#7c6cff");
  assert.equal(theme.seeds.neutral, "#6f6f86");
  assert.equal(theme.seeds.warning, "#facc15");
  assert.equal(theme.seeds.danger, "#f87171");
});

function darkSeedDerivation(token: string) {
  const derivation = theme.recipe.dark[token];
  if (!derivation || !("seed" in derivation))
    throw new Error(`${token} is not a seed derivation`);
  return derivation;
}

test("the dark ground is near black and each layer steps clear of the one below", () => {
  assert.equal(darkSeedDerivation("--slotted-surface-sunken").l, 0.13);
  assert.equal(darkSeedDerivation("--slotted-surface").l, 0.155);
  assert.equal(darkSeedDerivation("--slotted-surface-raised").l, 0.2);
});

// A saturated tone (settings, appearance) tints the ground: #ff0000 gives a chroma of 0.057, not
// the 0.03 that read as black. The graphite seed stays under 0.008.
test("the dark ground carries a tone's chroma up to 0.08", () => {
  for (const token of [
    "--slotted-surface-sunken",
    "--slotted-surface",
    "--slotted-surface-raised",
  ]) {
    assert.deepEqual(
      darkSeedDerivation(token).c,
      { scale: 0.22, max: 0.08 },
      token,
    );
  }
});

test("the dark accent edge and text keep the indigo's hue", () => {
  for (const token of [
    "--slotted-tone-accent-border",
    "--slotted-tone-accent-text",
  ]) {
    assert.equal(darkSeedDerivation(token).h ?? 0, 0, token);
  }
});

// Eight hues at one lightness per scheme, indigo first; the order keeps neighbours apart under
// protan and deutan vision (dataviz validator: adjacent ΔE ≥ 8.9, contrast ≥ 3:1 on every surface).
test("data series share one lightness per scheme and start at the indigo", () => {
  const flat = flattenTheme(theme);
  const slots = (scheme: "dark" | "light") =>
    ["1", "2", "3", "4", "5", "6", "7", "8"].map(
      (slot) => flat.schemes[scheme]?.[`--slotted-data-${slot}`],
    );
  assert.deepEqual(slots("dark"), [
    "#8a82e9",
    "#cb7f00",
    "#00a8a8",
    "#de6674",
    "#069ce4",
    "#68a63f",
    "#c46dbd",
    "#db703b",
  ]);
  assert.deepEqual(slots("light"), [
    "#7368d4",
    "#b46400",
    "#009597",
    "#c6495b",
    "#0083ce",
    "#4d8e16",
    "#ad51a7",
    "#c4530f",
  ]);
});

test("a focused field draws one ring over its own edge, with no offset and no glow", () => {
  assert.match(css, /--slotted-control-shadow-focus-geometry: 0 0 0 0;/);
  assert.match(
    css,
    /--slotted-control-focus-ring-offset: calc\(var\(--slotted-control-border-width\) \* -1\);/,
  );
});

// Owner review item 17: the rules under the header and over a total read as heavy lines; both
// take one softened rule colour, halfway between the subtle and the strong border.
test("the header and total rules of a table take the softened rule colour", () => {
  assert.match(
    css,
    /--slotted-table-border-color-strong:\s*color-mix\(in oklch, var\(--slotted-border-subtle\) 50%, var\(--slotted-border-strong\)\)/,
  );
  assert.match(
    css,
    /--slotted-data-grid-border-color-strong:\s*var\(--slotted-table-border-color-strong\)/,
  );
  const summary =
    /\[data-ui="table"\] \[data-part="summary"\][^{]*\{([^}]*)\}/.exec(
      css,
    )?.[1] ?? "";
  assert.ok(summary !== "", "the summary rule is missing from equori.gen.css");
  assert.ok(!summary.includes("double"), "the total keeps a double rule");
  assert.match(summary, /solid var\(--slotted-table-border-color-strong\)/);
});

// A table has no surface of its own, so a sticky header would show the rows that pass under it.
// Only a table with a sticky header takes the ground it stands on.
test("the sticky header of a table is opaque and an unpinned header stays transparent", () => {
  assert.match(css, /--slotted-table-header-surface: transparent;/);
  assert.match(
    css,
    /\[data-ui="table"\]\[data-sticky-header\] \{\s*--slotted-table-header-surface: var\(--slotted-ground\);/,
  );
});

test("a raised toast and the palette are materials over the page", () => {
  assert.match(
    css,
    /--slotted-toast-surface:\s*var\(--slotted-surface-material\)/,
  );
  assert.match(
    css,
    /--slotted-toast-backdrop-filter:\s*var\(--slotted-material-backdrop\)/,
  );
  assert.match(
    css,
    /--slotted-command-palette-backdrop-filter:\s*var\(--slotted-material-backdrop\)/,
  );
});

test("a tag keeps its height and stands its text 2 px further from each side", () => {
  assert.match(
    css,
    /\[data-ui="tag"\]\[data-size="sm"\] \{\s*--slotted-tag-inset-inline: var\(--slotted-space-4\);/,
  );
});

test("the list of a select or a picker stops at 20 rem and scrolls", () => {
  for (const family of ["select", "multi-select", "entity-picker"]) {
    assert.match(
      css,
      new RegExp(
        `\\[data-ui="${family}"\\][^{]*\\{[^}]*--slotted-overlay-max-block-size: 20rem;`,
      ),
      family,
    );
  }
});

test("a menu keeps the height its items need", () => {
  assert.doesNotMatch(
    css,
    /\[data-ui="menu"\][^{]*\{[^}]*--slotted-overlay-max-block-size/,
  );
});

test("a popover, such as the calendar of a date field, keeps the height its content needs", () => {
  assert.doesNotMatch(css, /:root[^{]*\{[^}]*--slotted-overlay-max-block-size/);
  assert.doesNotMatch(
    css,
    /\[data-ui="popover"\][^{]*\{[^}]*--slotted-overlay-max-block-size/,
  );
});

test("the choices of a question stand clear of the message above them", () => {
  // The description and the error of a group are inline messages, not parts of their own.
  assert.match(
    css,
    /\[data-ui="field-group"\] > \[data-ui="inline-message"\] \+ \[data-part="content"\]\s*\{[^}]*margin-block-start: var\(--slotted-space-6\)/,
  );
});

test("a section reserves a transparent bar in the gutter, so nothing shifts when it shows", () => {
  assert.match(
    css,
    /\[data-ui="field-group"\]\[data-kind="section"\]\s*\{[^}]*margin-inline-start: calc\(var\(--slotted-space-6\) \* -1\);[^}]*border-inline-start: calc\(var\(--slotted-border-width-thick\) \* 1\.5\) solid transparent/,
  );
});

test("a section inside a card keeps its bar clear of the card's edge", () => {
  // The card's inline padding is space-6, the gutter's width: the bar would sit on the edge.
  assert.match(
    css,
    /\[data-ui="card"\] \[data-ui="field-group"\]\[data-kind="section"\]\s*\{[^}]*margin-inline-start: calc\(var\(--slotted-space-4\) \* -1\);[^}]*padding-inline-start: calc\(var\(--slotted-space-4\) - var\(--slotted-border-width-thick\) \* 1\.5\)/,
  );
});

test("a section sets its description tight under the title and the body clear of both", () => {
  assert.match(css, /--slotted-section-gap: var\(--slotted-space-6\)/);
  assert.equal(components["--slotted-section-description-gap"], "0");
});

test("a card header keeps no gap between its title and its description", () => {
  assert.equal(components["--slotted-card-header-gap"], "0");
  assert.equal(components["--slotted-list-item-body-gap"], "0");
  assert.equal(components["--slotted-stepper-description-gap"], "0");
});

test("the dark ink of a status follows its seed", () => {
  assert.doesNotMatch(
    css,
    /--slotted-tone-(success|info|warning|danger)-(text|border): #/,
  );
});

test("the help of a widget stands on the baseline of its title", () => {
  assert.match(css, /\[data-part="title-row"\] \{\s*align-items: baseline;/);
  assert.match(
    css,
    /\[data-part="title-row"\] > \[data-part="help"\] \{[^}]*round\(1cap, 1px\) \+ 4px[^}]*inset-block-start: 2px;\s*margin-block: -0\.5lh;/,
  );
});

test("a chart header keeps no gap between its title and its description", () => {
  assert.equal(components["--slotted-chart-header-gap"], "0");
});

test("a section under the pointer or holding the focus shows its bar and keeps the colour of its title", () => {
  const rule =
    /\[data-ui="field-group"\]\[data-kind="section"\]:is\(:hover, :focus-within\)\s*\{[^}]*\}/.exec(
      css,
    )?.[0] ?? "";
  assert.notEqual(rule, "");
  assert.match(
    rule,
    /border-inline-start-color: var\(--slotted-tone-accent-solid\)/,
  );
  assert.doesNotMatch(rule, /legend-color/);
});

// A dialog and a drawer sit at the raised step, and the families draw their grounds from the same
// step, so a table or a card inside one melted into the panel (1.00:1 in the light scheme). Inside
// an overlay a family reads a wash and a ring of the text colour, in every scheme.
const overlayItems: readonly (readonly [string, string, readonly string[]])[] =
  [
    [
      "card",
      '[data-ui="card"]',
      ["--slotted-card-background", "--slotted-card-border-color"],
    ],
    [
      "stat-card",
      '[data-ui="stat-card"]',
      ["--slotted-stat-card-background", "--slotted-stat-card-border-color"],
    ],
    ["section", '[data-ui="section"]', ["--slotted-section-surface"]],
    [
      "table",
      '[data-ui="table"]',
      ["--slotted-table-border-color", "--slotted-table-header-surface"],
    ],
    [
      "framed list",
      '[data-ui="list"][data-variant="framed"]',
      ["--slotted-list-background", "--slotted-list-border-color"],
    ],
    [
      "framed data-grid",
      '[data-ui="data-grid"][data-variant="framed"]',
      ["--slotted-data-grid-border-color"],
    ],
  ];

for (const [name, selector, tokens] of overlayItems) {
  test(`a ${name} inside a dialog or a drawer reads a wash and a ring of the text`, () => {
    const escaped = selector.replace(/[[\]().*+?^${}|]/g, "\\$&");
    const block = new RegExp(
      `:is\\([^{]*data-part="content"[^{]*data-mode="overlay"[^{]*\\) ${escaped} \\{([^}]*)\\}`,
    ).exec(css);
    assert.ok(block, `no overlay rule for ${name}`);
    for (const token of tokens) {
      assert.match(
        block[1] ?? "",
        new RegExp(
          `${token}: color-mix\\(in oklab, var\\(--slotted-text\\) (3|14)%, transparent\\)`,
        ),
      );
    }
  });
}

test("the overlay rules name no scheme, so they hold in the light and the dark scheme", () => {
  const rule =
    /:is\([^{]*data-part="content"[^{]*\) \[data-ui="table"\] \{/.exec(css);
  assert.ok(rule);
  assert.equal(rule[0].includes("data-slotted-scheme"), false);
});

// A pinned header covers the rows that scroll under it, so it cannot be a translucent wash: it is
// the panel's raised step with the same wash on top, which lands where the header of a table that
// does not pin lands.
const pinned: readonly (readonly [string, string, string])[] = [
  [
    "a table's pinned header and column",
    '[data-ui="table"]',
    "--slotted-table-sticky-surface",
  ],
  [
    "a framed data-grid's header",
    '[data-ui="data-grid"][data-variant="framed"]',
    "--slotted-data-grid-header-surface",
  ],
];

for (const [name, selector, token] of pinned) {
  test(`${name} is opaque inside a dialog or a drawer`, () => {
    const escaped = selector.replace(/[[\]().*+?^${}|]/g, "\\$&");
    const block = new RegExp(
      `:is\\([^{]*data-part="content"[^{]*data-mode="overlay"[^{]*\\) ${escaped} \\{([^}]*)\\}`,
    ).exec(css);
    assert.ok(block, `no overlay rule for ${name}`);
    assert.match(
      block[1] ?? "",
      new RegExp(
        `${token}: color-mix\\(in oklab, var\\(--slotted-text\\) 6%, var\\(--slotted-surface-raised\\)\\)`,
      ),
    );
  });
}

// The glass paints a pinned header cell and a pinned column straight on the element, so the
// overlay's value is written on those elements too, or the table's own value would lose to them.
const pinnedCells: readonly (readonly [string, string, string])[] = [
  [
    "a pinned column header",
    '[data-ui="table"][data-sticky-header] [data-part="column-header"]',
    "background-color",
  ],
  [
    "a pinned group header",
    '[data-ui="table"] [data-part="group-row"][data-sticky] > [data-part="group-header"]',
    "background-color",
  ],
  [
    "a pinned column",
    '[data-ui="table"] [data-sticky]',
    "--slotted-table-sticky-surface",
  ],
];

for (const [name, selector, property] of pinnedCells) {
  test(`${name} is opaque inside a dialog or a drawer`, () => {
    const escaped = selector.replace(/[[\]().*+?^${}|>]/g, "\\$&");
    const block = new RegExp(
      `:is\\([^{]*data-part="content"[^{]*data-mode="overlay"[^{]*\\) ${escaped.replace(/\\>/g, ">")}[^{]*\\{([^}]*)\\}`,
    ).exec(css);
    assert.ok(block, `no overlay rule for ${name}`);
    assert.match(
      block[1] ?? "",
      new RegExp(
        `${property}: color-mix\\(in oklab, var\\(--slotted-text\\) 6%, var\\(--slotted-surface-raised\\)\\)`,
      ),
    );
  });
}

// The caption stands in the frame above the header: on the frame's wash alone it read as a lighter
// band over a header at 6% (owner review of 2026-11-21).
test("a table caption inside a dialog or a drawer takes the header's tone", () => {
  const block =
    /:is\([^{]*data-part="content"[^{]*data-mode="overlay"[^{]*\) \[data-ui="table"\] \{([^}]*--slotted-table-caption-surface[^}]*)\}/.exec(
      css,
    );
  assert.ok(block, "no overlay rule for the caption");
  assert.match(
    block[1] ?? "",
    /--slotted-table-caption-surface: color-mix\(in oklab, var\(--slotted-text\) 3%, transparent\)/,
  );
});

// Two washes over the panel land near, not on, the opaque 6% of a pinned header: the caption of a
// table with a pinned header takes the header's own value.
test("a table caption above a pinned header takes the header's value", () => {
  const block =
    /:is\([^{]*data-part="content"[^{]*data-mode="overlay"[^{]*\) \[data-ui="table"\]\[data-sticky-header\] \{([^}]*)\}/.exec(
      css,
    );
  assert.ok(block, "no overlay rule for the caption of a pinned header");
  assert.match(
    block[1] ?? "",
    /--slotted-table-caption-surface: color-mix\(in oklab, var\(--slotted-text\) 6%, var\(--slotted-surface-raised\)\)/,
  );
});

// A row paints the table's surface token again over the frame, so a wash in the token stacked: the
// body read at 6% beside a card at 3%. The frame paints its wash on its own root and the token the
// rows read is clear.
const frames: readonly (readonly [string, string, string])[] = [
  ["table", '[data-ui="table"]', "--slotted-table-surface"],
  [
    "framed data-grid",
    '[data-ui="data-grid"][data-variant="framed"]',
    "--slotted-data-grid-surface",
  ],
];

for (const [name, selector, token] of frames) {
  test(`a ${name} inside a dialog or a drawer paints its wash once, on its root`, () => {
    const escaped = selector.replace(/[[\]().*+?^${}|]/g, "\\$&");
    const block = new RegExp(
      `:is\\([^{]*data-part="content"[^{]*data-mode="overlay"[^{]*\\) ${escaped} \\{([^}]*)\\}`,
    ).exec(css);
    assert.ok(block, `no overlay rule for ${name}`);
    assert.match(block[1] ?? "", new RegExp(`${token}: transparent`));
    assert.match(
      block[1] ?? "",
      /background-color: color-mix\(in oklab, var\(--slotted-text\) 3%, transparent\)/,
    );
  });
}

// Spec 2026-11-21-mobile-statement, MS1: a phone page keeps 16 px between the screen edge and
// its content.
test("a page container keeps a 16 px inset below 600 px", () => {
  assert.equal(
    components["--slotted-page-inset-compact"],
    "var(--slotted-space-6)",
  );
});
