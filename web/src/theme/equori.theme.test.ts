import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { flattenTheme } from "@slotted/theme";
import { themeConformance } from "@slotted/theme/conformance";
import contract from "@slotted/theme/contract.json" with { type: "json" };
import theme from "./equori.theme.ts";

const css = readFileSync(new URL("./equori.gen.css", import.meta.url), "utf8");

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

// The field's own row gap is a fallback, not a token: a reference to it resolved to nothing
// and the family fell back to 1.25rem.
test("a question's legend stands as close to its control as a field's label", () => {
  assert.match(
    css,
    /--slotted-field-group-content-gap:\s*var\(--slotted-space-3\)/,
  );
  assert.match(css, /--slotted-space-3:\s*0\.375rem/);
});

test("a question's legend is a field label's size", () => {
  assert.match(
    css,
    /\[data-ui="field-group"\] > \[data-part="legend"\] \{\s*font-size: var\(--slotted-control-font-size-md\);/,
  );
});

test("a tag keeps its height and stands its text 2 px further from each side", () => {
  assert.match(
    css,
    /\[data-ui="tag"\]\[data-size="sm"\] > \[data-part="body"\] \{\s*padding-inline: var\(--slotted-space-4\);/,
  );
});
