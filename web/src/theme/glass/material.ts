// The glass material: a tint of a theme surface at a partial alpha, a hairline of light on the
// edge and layered shadows. It is described once, as data, and every surface reads the variables
// written here, so no surface holds a number of its own.
//
// Roles say how much of the ground behind a surface may show, because that depends on what the
// surface carries and not on its family:
//   page    the shell's content card, which holds the working screens
//   card    a card, a KPI, a chart, a section: content over the page
//   overlay a menu, a popover, a picker: content over moving content, blurred
//   sticky  a header that pinned content scrolls under, blurred
//   frost   the tint under a strong blur: a stuck section header, where the blur does the work
//   modal   a dialog or a drawer over a scrim
//
// The material is lit by the text colour and shaded by the sunken ground: it is made for the dark
// scheme, where the aurora behind it is visible, and the theme applies it to that scheme only.

import type { Declarations } from "./css.ts";
import { mix } from "./css.ts";

export const ROLES = [
  "page",
  "card",
  "overlay",
  "sticky",
  "frost",
  "modal",
] as const;
export type Role = (typeof ROLES)[number];

interface Layer {
  readonly y: number;
  readonly blur: number;
  readonly spread: number;
  readonly opacity: number;
}

interface Elevation {
  readonly near: Layer;
  readonly far: Layer;
}

// Percent of the tint that stays opaque, per role.
const alpha: Readonly<Record<Role, number>> = {
  page: 34,
  card: 40,
  overlay: 66,
  sticky: 72,
  frost: 45,
  modal: 68,
};

// Percent of the light colour laid over a role's tint, so a raised surface reads lighter than the
// ground it stands on and not only less transparent.
const lift: Partial<Readonly<Record<Role, number>>> = { card: 4 };

// Percent of the light colour on the hairline and on the top edge.
const edge = 10;
const top = 7;

// The strong blur is for a bar with no fill of its own: the blur alone keeps what passes under it
// from competing with the bar.
const backdrop = { blur: 22, strongBlur: 40, saturate: 150 };

// Percent of the text colour in a hover, a press and a tinted surface over glass, and of a tone in
// its own hover, press and surface.
const wash = { hover: 6, active: 10, surface: 8 };
const tone = { hover: 10, active: 16, surface: 14 };

// The ring drawn around every elevation, in percent of the shade.
const ring = 55;

const elevations: Readonly<Record<1 | 2 | 3, Elevation>> = {
  1: {
    near: { y: 1, blur: 2, spread: 0, opacity: 30 },
    far: { y: 6, blur: 14, spread: -6, opacity: 50 },
  },
  2: {
    near: { y: 2, blur: 4, spread: 0, opacity: 20 },
    far: { y: 18, blur: 40, spread: -18, opacity: 62 },
  },
  3: {
    near: { y: 2, blur: 4, spread: 0, opacity: 20 },
    far: { y: 28, blur: 56, spread: -24, opacity: 70 },
  },
};

const percent = (value: number) => `${String(value)}%`;
const px = (value: number) => (value === 0 ? "0" : `${String(value)}px`);
const shade = (opacity: number) => mix("var(--glass-shade)", opacity);

function shadow({ near, far }: Elevation): string {
  return [
    `0 0 0 0.5px ${shade(ring)}`,
    "var(--glass-lit)",
    `0 ${px(near.y)} ${px(near.blur)} ${px(near.spread)} ${shade(near.opacity)}`,
    `0 ${px(far.y)} ${px(far.blur)} ${px(far.spread)} ${shade(far.opacity)}`,
  ].join(", ");
}

const tintOf = (role: Role) =>
  role === "page" || role === "sticky" || role === "frost"
    ? "var(--slotted-surface)"
    : "var(--slotted-surface-raised)";

type Entry = readonly [string, string];

const named = (
  prefix: string,
  values: Readonly<Record<string, number>>,
): Entry[] =>
  Object.entries(values).map(([key, value]) => [
    `--glass-${prefix}-${key}`,
    percent(value),
  ]);

// Written on every surface. The fills and the ring are read from the variables beside them at the
// element that uses them.
const entries: Entry[] = [
  ["--glass-light", "var(--slotted-text)"],
  ["--glass-shade", "var(--slotted-surface-sunken)"],
  ...named("alpha", alpha),
  ...named("lift", lift),
  ["--glass-edge", percent(edge)],
  ["--glass-top", percent(top)],
  ["--glass-blur", px(backdrop.blur)],
  ["--glass-blur-strong", px(backdrop.strongBlur)],
  ["--glass-saturate", percent(backdrop.saturate)],
  ...named("wash", wash),
  ...named("tone", tone),
  ...ROLES.map((role): Entry => {
    const tint = mix(tintOf(role), `var(--glass-alpha-${role})`);
    return [
      `--glass-fill-${role}`,
      lift[role] === undefined
        ? tint
        : mix("var(--glass-light)", `var(--glass-lift-${role})`, tint),
    ];
  }),
  ["--glass-ring", mix("var(--glass-light)", "var(--glass-edge)")],
  [
    "--glass-lit",
    `inset 0 1px 0 ${mix("var(--glass-light)", "var(--glass-top)")}`,
  ],
  ...([1, 2, 3] as const).map((level): Entry => [
    `--glass-shadow-${String(level)}`,
    shadow(elevations[level]),
  ]),
];

export const material: Declarations = Object.fromEntries(entries);

export const fill = (role: Role) => `var(--glass-fill-${role})`;
export const ringColor = "var(--glass-ring)";
export const elevation = (level: 1 | 2 | 3) =>
  `var(--glass-shadow-${String(level)})`;
