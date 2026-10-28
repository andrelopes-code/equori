// The states a surface shows over glass. The library paints a hover, a press, a selection and a
// tinted surface with opaque tokens (lightness steps of the neutral and of each tone), and an
// opaque step over glass reads as a grey block. Inside the glass scope each of them is a wash of
// the text colour, or of the tone for a coloured state, so the aurora keeps showing through.

import type { Declarations, Rule } from "./css.ts";
import { derivationCss } from "@slotted/theme";

import equori from "../equori.theme.ts";
import { family, mix, rule } from "./css.ts";
import { scope } from "./surfaces.ts";

const NEUTRAL_TONES = ["secondary", "neutral"] as const;
const COLOURED_TONES = [
  "accent",
  "danger",
  "success",
  "warning",
  "info",
] as const;

const neutralWash = (amount: string) =>
  mix("var(--slotted-text)", `var(${amount})`);
const toneWash = (tone: string, amount: string) =>
  mix(`var(--slotted-tone-${tone}-solid)`, amount);

function toneStates(): Declarations {
  const tokens: Record<string, string> = {};
  for (const tone of NEUTRAL_TONES) {
    tokens[`--slotted-tone-${tone}-subtle-hover`] =
      neutralWash("--glass-wash-hover");
    tokens[`--slotted-tone-${tone}-subtle-active`] = neutralWash(
      "--glass-wash-active",
    );
    tokens[`--slotted-tone-${tone}-surface`] = neutralWash(
      "--glass-wash-surface",
    );
  }
  for (const tone of COLOURED_TONES) {
    tokens[`--slotted-tone-${tone}-subtle-hover`] = toneWash(
      tone,
      "var(--glass-tone-hover)",
    );
    tokens[`--slotted-tone-${tone}-subtle-active`] = toneWash(
      tone,
      "var(--glass-tone-active)",
    );
    tokens[`--slotted-tone-${tone}-surface`] = toneWash(
      tone,
      "var(--glass-tone-surface)",
    );
  }
  return tokens;
}

const accent = (amount: string) => toneWash("accent", amount);

// A selected row, its hover and a selected range of cells: the accent over the glass. A selected
// row's hover is stronger than the row, so the pointer still reads on it.
const selection = {
  rest: accent("var(--glass-tone-active)"),
  hover: accent("calc(var(--glass-tone-active) + 6%)"),
  range: accent("var(--glass-tone-surface)"),
};

// A soft key cap falls back to the secondary surface, which the washes make translucent; over an
// accent button it would take the button's colour. It keeps the opaque surface of the standard
// theme's dark recipe.
const SECONDARY_SURFACE = "--slotted-tone-secondary-surface";

function opaqueSecondarySurface(): string {
  const derivation = equori.recipe.dark[SECONDARY_SURFACE];
  if (derivation === undefined)
    throw new Error(`${SECONDARY_SURFACE} has no dark derivation`);
  return derivationCss(derivation);
}

export const stateRules: readonly Rule[] = [
  rule(scope, toneStates()),
  rule(`${family("kbd")}[data-variant="soft"]`, {
    "--slotted-kbd-surface": opaqueSecondarySurface(),
  }),
  rule(family("table"), {
    "--slotted-table-row-surface-selected": selection.rest,
    "--slotted-table-row-surface-selected-hover": selection.hover,
  }),
  rule(family("data-grid"), {
    "--slotted-data-grid-row-surface-selected": selection.rest,
    "--slotted-data-grid-row-surface-selected-hover": selection.hover,
    "--slotted-data-grid-range-surface": selection.range,
  }),
];
