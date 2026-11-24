import assert from "node:assert/strict";
import { test } from "node:test";
import theme from "./equori.theme.ts";
import { groundRule, surfaceRecipe } from "./surface-recipe.ts";

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
