// Translucent "glass" over the aurora (src/app/aurora-background.tsx), as an extension of the
// equori theme. `equori-glass.theme.ts` extends the theme with `glassRules`, and the application
// loads the result only when its reader turns the experimental visual style on.
//
//   material.ts   the material as data: roles, numbers, fills, ring and shadows
//   surfaces.ts   one entry per family: its tokens, its own paint, the elements that blur
//   states.ts     hover, press, selection and tinted surfaces as washes over glass
//   sticky.ts     bars that pinned content scrolls under
//   ground.ts     what the theme leaves clear so the aurora shows through
//   lite.ts       phones and touch screens: bars without a blur
//   fallbacks.ts  reduced transparency
//   css.ts        rules as data, and their rendering
//
// To change how much of the ground shows, edit an alpha in material.ts. To cover another family,
// add an entry to surfaces.ts. To tune a state, edit states.ts. Every rule is held to the dark
// scheme here, so no file repeats the scope.

import type { Block } from "./css.ts";
import { blur, family, render, rule } from "./css.ts";
import { fallbackRules } from "./fallbacks.ts";
import { groundRules } from "./ground.ts";
import { liteRules } from "./lite.ts";
import { material } from "./material.ts";
import { stateRules } from "./states.ts";
import { stickyRules } from "./sticky.ts";
import {
  blurred,
  blurTokens,
  scope,
  surfaces,
  tokenSelector,
} from "./surfaces.ts";

const surfaceRules = surfaces.flatMap((surface) => [
  ...(surface.tokens === undefined
    ? []
    : [rule(tokenSelector(surface), surface.tokens)]),
  ...(surface.paint ?? []).map(({ select, declarations }) =>
    rule(select, declarations),
  ),
]);

// A family with a backdrop-filter token reads its blur from it.
const blurRules = [
  rule(blurred, blur("var(--glass-blur)", "var(--glass-saturate)")),
  ...blurTokens.map(({ family: name, token }) =>
    rule(family(name), {
      [token]: "blur(var(--glass-blur)) saturate(var(--glass-saturate))",
    }),
  ),
];

const blocks: readonly Block[] = [
  rule(scope, material),
  ...groundRules,
  ...surfaceRules,
  ...blurRules,
  ...stateRules,
  ...stickyRules,
  ...liteRules,
  ...fallbackRules,
];

// `&` is the theme's root element inside the theme's scope, and it is the element that carries the
// scheme; a bare `[data-slotted-scheme="dark"]` would look for a descendant of the root instead.
const inDark = (selector: string) =>
  `&[data-slotted-scheme="dark"] ${selector}`;

export const glassRules: readonly string[] = render(blocks, inDark);
