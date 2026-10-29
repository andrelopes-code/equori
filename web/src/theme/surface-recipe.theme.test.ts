import assert from "node:assert/strict";
import { test } from "node:test";
import { extendTheme, flattenTheme, renderTheme } from "@slotted/theme";
import type { Derivation } from "@slotted/theme";
import { themeConformance } from "@slotted/theme/conformance";
import contract from "@slotted/theme/contract.json" with { type: "json" };
import theme from "./equori.theme.ts";
import { groundRule, surfaceRecipe } from "./surface-recipe.ts";
import type { SurfaceRule } from "./surface-recipe.ts";

// Spec A15, docs/specs/2026-10-29-appearance-studio-design.md: the compiled theme keeps its
// contrast under every surface value.
const variants: [string, SurfaceRule][] = [];
for (const depth of ["soft", "standard", "deep", "oled"] as const)
  for (const step of ["standard", "wide"] as const)
    variants.push([`depth ${depth}, step ${step}`, groundRule(depth, step)]);
for (const value of ["none", "subtle", "strong"] as const)
  variants.push([`borders ${value}`, surfaceRecipe.borders[value]]);
for (const value of ["standard", "high"] as const)
  variants.push([`contrast ${value}`, surfaceRecipe.contrast[value]]);

for (const [name, rule] of variants) {
  const variant = extendTheme(
    theme,
    {
      recipe: {
        ...theme.recipe,
        dark: { ...theme.recipe.dark, ...derivations(rule.dark) },
        light: { ...theme.recipe.light, ...derivations(rule.light) },
      },
    },
    { name: `equori-${name.replace(/[^a-z]+/g, "-")}` },
  );
  themeConformance({
    contract,
    theme: flattenTheme(variant),
    css: renderTheme(variant),
  });
}

// The standard values repeat the compiled theme, so an element under another value returns to it.
test("the standard grounds, borders and secondary text repeat equori.theme.ts", () => {
  const standard = {
    ...groundRule("standard", "standard").dark,
    ...surfaceRecipe.borders.subtle.dark,
  };
  for (const [token, derivation] of Object.entries(standard))
    assert.deepEqual(derivation, theme.recipe.dark[token], token);

  const lightStandard = {
    ...groundRule("standard", "standard").light,
    ...surfaceRecipe.borders.subtle.light,
    ...surfaceRecipe.contrast.standard.light,
  };
  for (const [token, derivation] of Object.entries(lightStandard))
    assert.deepEqual(derivation, theme.recipe.light[token], token);
  assert.deepEqual(
    surfaceRecipe.contrast.standard.dark?.["--slotted-text-muted"],
    theme.recipe.dark["--slotted-text-muted"],
  );
});

function derivations(tokens: SurfaceRule["dark"]): Record<string, Derivation> {
  return Object.fromEntries(
    Object.entries(tokens ?? {}).filter(
      (entry): entry is [string, Derivation] => typeof entry[1] !== "string",
    ),
  );
}
