// A phone, or any touch screen: the bars that are always visible lose their blur and take a higher
// alpha, so they still hide what passes under them (a stuck section header is not one of them: it
// is on screen only while the page scrolls).
import type { Block } from "./css.ts";
import { media, noBlur, rule } from "./css.ts";
import { permanentBars } from "./sticky.ts";
import { scope } from "./surfaces.ts";

export const TOUCH = "(max-width: 599px), (pointer: coarse)";

export const liteRules: readonly Block[] = [
  media(TOUCH, [
    rule(scope, { "--glass-alpha-sticky": "90%" }),
    rule(permanentBars, noBlur),
  ]),
];
