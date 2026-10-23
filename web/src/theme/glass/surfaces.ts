// Every surface the application shows as glass, one entry per family. An entry says what the
// family reads (its tokens), what it paints that no token reaches, and which of its elements blur
// what is behind them. Adding a family is adding an entry; nothing else changes.

import type { Declarations } from "./css.ts";
import { child, family, part } from "./css.ts";
import { elevation, fill, ringColor as ring } from "./material.ts";

export interface Surface {
  readonly family: string;
  // Tokens the family reads, written on the family's elements. A family whose popup reads its
  // tokens on a positioner names it, so the trigger and the chosen chips keep the library's look.
  readonly tokens?: Declarations;
  readonly tokenPart?: string;
  // Elements that paint a ground of their own, with the declarations that replace it.
  readonly paint?: readonly {
    readonly select: string;
    readonly declarations: Declarations;
  }[];
  // Elements over moving content: they blur what is behind them. A card over the aurora blurs a
  // gradient that is already smooth, and the aurora moves, so a blurred card is redrawn each frame.
  readonly blur?: readonly string[];
  // A family that reads its blur as a token: the token it reads, written on the family.
  readonly blurToken?: string;
}

// A family whose tokens are all named `--slotted-<family>-<token>`.
const byToken = (name: string, tokens: Record<string, string>): Surface => ({
  family: name,
  tokens: Object.fromEntries(
    Object.entries(tokens).map(([token, value]) => [
      `--slotted-${name}-${token}`,
      value,
    ]),
  ),
});

// The families whose popup is a content element under a positioner.
const picker = (name: string): Surface => ({
  family: name,
  tokenPart: "positioner",
  tokens: {
    [`--slotted-${name}-surface`]: fill("overlay"),
    [`--slotted-${name}-content-border-color`]: ring,
    [`--slotted-${name}-content-shadow`]: elevation(2),
  },
  blur: [child(name, "content")],
});

// The command palette is a dialog whose content carries the palette's own material (see the
// palette rule in equori.theme.ts), so the dialog's ground stays out of it.
// A drawer over the page: an inline drawer is part of the layout and blurs nothing.
const OVERLAY_DRAWER = `${family("drawer")}[data-mode="overlay"] > [data-part="panel"]`;

const NOT_PALETTE = ':not(:has(> [data-ui="command-palette"]))';

export const surfaces: readonly Surface[] = [
  byToken("card", {
    background: fill("card"),
    "border-color": ring,
    shadow: elevation(1),
    "shadow-hover": elevation(2),
  }),
  byToken("stat-card", {
    background: fill("card"),
    "border-color": ring,
    shadow: elevation(1),
    "shadow-elevated": elevation(2),
  }),
  byToken("section", { surface: fill("card") }),
  {
    family: "menu",
    tokens: {
      "--slotted-menu-surface": fill("overlay"),
      "--slotted-menu-border-color": ring,
      "--slotted-menu-shadow": elevation(2),
    },
    blur: [child("menu", "content")],
  },
  {
    family: "popover",
    tokens: {
      "--slotted-popover-surface": fill("overlay"),
      "--slotted-popover-border-color": ring,
      "--slotted-popover-shadow": elevation(2),
    },
    blur: [child("popover", "content")],
  },
  {
    family: "tooltip",
    tokens: {
      "--slotted-tooltip-surface-raised": fill("overlay"),
      "--slotted-tooltip-border-color": ring,
      "--slotted-tooltip-shadow": elevation(1),
    },
    blur: [child("tooltip", "content")],
  },
  byToken("listbox", {
    surface: fill("overlay"),
    "border-color": ring,
    shadow: elevation(1),
  }),
  picker("select"),
  picker("combobox"),
  picker("entity-picker"),
  {
    family: "date-picker",
    tokens: {
      "--slotted-date-picker-surface": fill("overlay"),
      "--slotted-date-picker-content-border-color": ring,
      "--slotted-date-picker-content-shadow": elevation(2),
    },
    blur: [`${family("date-picker")} [data-part="content"]`],
  },
  {
    family: "toast",
    tokens: {
      "--slotted-toast-surface": fill("overlay"),
      "--slotted-toast-border-color": ring,
      "--slotted-toast-shadow": elevation(2),
    },
  },
  {
    family: "dialog",
    // The library draws the blur of a dialog on its content, which fades in with opacity: the
    // blur is a token it reads there.
    blurToken: "--slotted-dialog-backdrop-filter",
    tokens: { "--slotted-dialog-border-color": ring },
    paint: [
      {
        select: `${family("dialog")} > [data-part="viewport"] > [data-part="content"]${NOT_PALETTE}`,
        declarations: {
          "background-color": fill("modal"),
          "box-shadow": elevation(3),
        },
      },
    ],
  },
  {
    family: "drawer",
    tokens: {
      "--slotted-drawer-surface": fill("modal"),
      "--slotted-drawer-border-color": ring,
    },
    paint: [
      {
        select: OVERLAY_DRAWER,
        declarations: { "box-shadow": elevation(3) },
      },
    ],
    blur: [OVERLAY_DRAWER],
  },
  {
    family: "action-sheet",
    tokens: { "--slotted-action-sheet-footer-surface": fill("overlay") },
  },
  {
    family: "action-bar",
    // The bar a selection raises over the rows.
    tokens: {
      "--slotted-action-bar-background": fill("overlay"),
      "--slotted-action-bar-border-color": ring,
    },
    blur: [family("action-bar")],
  },
  byToken("filter-bar", {
    surface: fill("card"),
    "group-surface": fill("card"),
  }),
  byToken("description-list", { surface: fill("card") }),
  byToken("list", { background: fill("card"), "border-color": ring }),
  // A calendar sits in a popup or in a card, which already are the glass.
  byToken("calendar", { background: "transparent" }),
  {
    family: "chart",
    // The chart's own surface stays opaque: the library mixes its series colours with it. Only
    // the card variant's ground and the tooltip are glass; the tooltip's fill is a token, so only its
    // blur is declared here.
    tokens: { "--slotted-chart-tooltip-surface": fill("overlay") },
    paint: [
      {
        select: `${family("chart")}[data-variant="card"]`,
        declarations: {
          "background-color": fill("card"),
          "box-shadow": elevation(1),
        },
      },
      ...["menu", "help-content"].map((name) => ({
        select: `${family("chart")} [data-part="${name}"]`,
        declarations: {
          "background-color": fill("overlay"),
          "box-shadow": elevation(2),
        },
      })),
    ],
    blur: ["tooltip", "menu", "help-content"].map(
      (name) => `${family("chart")} [data-part="${name}"]`,
    ),
  },
  {
    family: "app-shell",
    // The shell's content card takes the base surface at a low alpha, so the aurora shows through
    // it; the Page inside it is transparent (see ground.ts).
    // The section surface is read by the application's own panes, which sit under the shell.
    tokens: {
      "--slotted-app-shell-main-surface": fill("page"),
      "--slotted-section-surface": fill("card"),
    },
  },
];

export const tokenSelector = (surface: Surface) =>
  surface.tokenPart === undefined
    ? family(surface.family)
    : part(surface.family, surface.tokenPart);

export const scope = surfaces.map((surface) => family(surface.family));

export const blurred = surfaces.flatMap((surface) => surface.blur ?? []);

export const blurTokens = surfaces.flatMap((surface) =>
  surface.blurToken === undefined
    ? []
    : [{ family: surface.family, token: surface.blurToken }],
);
