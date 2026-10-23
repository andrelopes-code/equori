// What a reader who asked for less transparency gets: an opaque material with no blur.

import type { Block, Declarations } from "./css.ts";
import { family, media, noBlur, rule } from "./css.ts";
import { ROLES } from "./material.ts";
import { blurredBars, stuckFill } from "./sticky.ts";
import { blurred, blurTokens, scope } from "./surfaces.ts";

const opaque: Declarations = Object.fromEntries(
  ROLES.map((role) => [`--glass-alpha-${role}`, "100%"]),
);

export const fallbackRules: readonly Block[] = [
  media("(prefers-reduced-transparency: reduce)", [
    rule(scope, opaque),
    rule([...blurred, ...blurredBars], noBlur),
    // A stuck header has no fill of its own, so without its blur it takes a solid one.
    rule(stuckFill, { "background-color": "var(--slotted-surface)" }),
    ...blurTokens.map(({ family: name, token }) =>
      rule(family(name), { [token]: "none" }),
    ),
  ]),
];
