import { derivationCss } from "@slotted/theme";

import {
  groundRule,
  surfaceRecipe,
  surfaceSchemes,
  surfaceSets,
} from "./surface-recipe.ts";
import type { SurfaceRule, SurfaceScheme } from "./surface-recipe.ts";

// Spec A13 and A14, docs/specs/2026-10-29-appearance-studio-design.md. Workaround for Slotted
// issue #44: a theme holds no recipe value chosen by an attribute, so this sheet sets the surface
// tokens under the data-equori-* attributes. make gen writes it to surface.gen.css (surface-gen.ts),
// because building it in the page would carry the whole of @slotted/theme into the bundle.
export function surfaceSheet(): string {
  const rules: string[] = [];
  for (const depth of surfaceSets.depth)
    for (const step of surfaceSets.step)
      rules.push(...ruleCss({ depth, step }, groundRule(depth, step)));

  for (const name of Object.keys(
    surfaceRecipe,
  ) as (keyof typeof surfaceRecipe)[]) {
    const values = surfaceRecipe[name] as Readonly<Record<string, SurfaceRule>>;
    for (const [value, rule] of Object.entries(values))
      rules.push(...ruleCss({ [name]: value }, rule));
  }

  return rules.join("\n\n");
}

// One block per scheme the rule sets. The element that carries the values takes them, and so do
// the scheme scopes and seed scopes under it that carry none of their own.
function ruleCss(
  values: Readonly<Record<string, string>>,
  rule: SurfaceRule,
): string[] {
  const own = Object.entries(values)
    .map(([name, value]) => `[data-equori-${name}="${value}"]`)
    .join("");
  const first = `[data-equori-${Object.keys(values)[0] ?? ""}]`;

  return surfaceSchemes.flatMap((scheme) => {
    const tokens = rule[scheme];
    if (tokens === undefined) return [];

    const selectors = schemeSelectors(own, first, scheme);
    const body = Object.entries(tokens)
      .map(([token, value]) => {
        const css = typeof value === "string" ? value : derivationCss(value);
        return `  ${token}: ${css};`;
      })
      .join("\n");

    return [`${selectors.join(",\n")} {\n${body}\n}`];
  });
}

function schemeSelectors(
  own: string,
  first: string,
  scheme: SurfaceScheme,
): string[] {
  const named = `[data-slotted-scheme="${scheme}"]`;

  return [
    `${own}${named}`,
    `${named} ${own}:not([data-slotted-scheme])`,
    `${own} ${named}:not(${first})`,
    `${own}${named} [data-slotted-seeds]:not([data-slotted-scheme], ${first})`,
  ];
}
