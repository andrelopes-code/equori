// How a popup enters and leaves over glass. The library fades and slides a popup's positioner,
// and the glass blurs the content inside it (surfaces.ts). Chromium makes an element whose opacity
// is below 1 the backdrop root of its descendants, so the content blurs nothing until the fade
// ends and the blur appears at once.
//
// Workaround for Slotted finding "A popup's positioner fade suppresses its content's backdrop blur until the fade ends":
// the positioner stays opaque, and the content takes the library's own fade and slide. An
// element's own opacity applies after its backdrop filter, so the blur fades in with it.
//
// The library unmounts a closing popup once its positioner's transitions end, so the positioner
// keeps one: it slides back by the entrance distance while the content fades. A translate does
// not make the positioner a backdrop root, as an opacity does.

import type { Rule } from "./css.ts";
import { family, part, rule } from "./css.ts";

interface Popup {
  // The family whose keyframes the popup plays: slotted-<name>-enter-down and -enter-up.
  readonly name: string;
  // The element the library fades: a positioner part, or the family's root for the families whose
  // root is the positioner.
  readonly positioner: string;
}

const popups: readonly Popup[] = [
  ...["select", "combobox", "entity-picker", "date-picker"].map((name) => ({
    name,
    positioner: part(name, "positioner"),
  })),
  ...["menu", "popover", "tooltip"].map((name) => ({
    name,
    positioner: family(name),
  })),
];

// The slide distance the library writes for every positioner, read from its token.
const distance = "var(--slotted-space-2)";
const exit = "var(--slotted-duration-short) var(--slotted-easing-exit)";

const rules = ({ name, positioner }: Popup): Rule[] => {
  const open = `${positioner}[data-open]`;
  const entering = `${open}[data-positioned]`;
  const content = (selector: string) => `${selector} > [data-part="content"]`;
  return [
    rule(positioner, {
      opacity: "1",
      translate: `0 calc(-1 * ${distance})`,
      transition: `translate ${exit}`,
    }),
    rule(`${positioner}[data-side="top"]`, { translate: `0 ${distance}` }),
    rule(open, { translate: "0", transition: "none" }),
    rule(entering, { animation: "none" }),
    rule(content(positioner), {
      opacity: "0",
      transition: `opacity ${exit}`,
    }),
    rule(content(open), { opacity: "1", transition: "none" }),
    rule(content(entering), {
      animation: `slotted-${name}-enter-down var(--slotted-duration-medium) var(--slotted-easing-enter)`,
    }),
    rule(content(`${entering}[data-side="top"]`), {
      "animation-name": `slotted-${name}-enter-up`,
    }),
  ];
};

export const popupRules: readonly Rule[] = popups.flatMap(rules);
