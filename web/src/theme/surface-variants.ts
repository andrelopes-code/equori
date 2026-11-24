import {
  groundName,
  groundRule,
  surfaceRecipe,
  surfaceSets,
} from "./surface-recipe.ts";

// The variants of the compiled theme (spec A13, docs/specs/2026-10-29-appearance-studio-design.md):
// one axis per surface preference, and one for depth and step together, because both set the raised
// layer. surface.ts writes the attributes that choose them.
export const surfaceVariants = {
  ground: Object.fromEntries(
    surfaceSets.depth.flatMap((depth) =>
      surfaceSets.step.map((step) => [
        groundName(depth, step),
        groundRule(depth, step),
      ]),
    ),
  ),
  ...surfaceRecipe,
};
