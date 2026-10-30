import { extendTheme } from "@slotted/theme";
import defaultTheme from "@slotted/themes/default";

// A total closes its table with one rule in the softened rule colour; the double rule of a
// ledger sheet read as a heavy line (owner review item 17).
const summaryRule = `
[data-ui="table"] [data-part="summary"] [data-part="row"]:first-child [data-part="cell"],
[data-ui="table"] [data-part="summary"] [data-part="row"]:first-child [data-part="row-header"] {
  border-block-start: var(--slotted-border-width-thin) solid var(--slotted-table-border-color-strong);
  font-weight: var(--slotted-font-weight-medium);
}
`;

// The family's current edge frames the whole link; the sheet underlines it instead.
const currentDestinationRule = `
[data-ui="top-navigation"] [data-part="list"] [data-part="link"][data-current] {
  box-shadow: inset 0 calc(var(--slotted-border-width-thick) * -1) 0 var(--slotted-text);
  border-radius: 0;
}

[data-ui="top-navigation"] [data-part="name"] {
  color: var(--slotted-text);
}
`;

// Workaround for Slotted issue #57: a question's legend was drawn at 14 px, a section title's
// size; it takes a field label's 13 px. FormSection restores 14 px.
const questionLegendRule = `
[data-ui="field-group"] > [data-part="legend"] {
  font-size: var(--slotted-control-font-size-md);
}
`;

// A light palette dims the page less: the material already sets it apart.
const paletteScrimRule = `
&[data-slotted-scheme="light"] [data-ui="dialog"]:has([data-ui="command-palette"]) {
  --slotted-dialog-scrim: color-mix(in srgb, var(--slotted-scrim) 30%, transparent);
}
`;

const defaultDark = defaultTheme.recipe.dark;

// The default turns the dark accent edge and text 10 to 13 degrees toward blue and lifts them to
// a pastel; the indigo keeps its own hue and more of its chroma. The default's bounds stay, so the
// contrast floor still holds.
const indigoKept = (token: string, offset: number, scale: number) => {
  const derivation = defaultDark[token];
  if (!derivation || !("seed" in derivation))
    throw new Error(`${token} is not a seed derivation`);
  return { ...derivation, l: { offset }, c: { scale, max: 0.25 }, h: 0 };
};

// The cap leaves room for a saturated tone (settings, appearance): at 0.03 a red ground read as
// black. The graphite seed scales to under 0.008 and never reaches it.
const darkNeutral = (l: number) => ({
  seed: "neutral" as const,
  l,
  c: { scale: 0.22, max: 0.08 },
});

// A tag's text stands 2 px further from its border than the family's default at each size; the
// height stays.
const tagInsetRule = `
[data-ui="tag"] {
  --slotted-tag-inset-inline: calc(var(--slotted-space-4) + var(--slotted-space-1));
}

[data-ui="tag"][data-size="sm"] {
  --slotted-tag-inset-inline: var(--slotted-space-4);
}

[data-ui="tag"][data-size="lg"] {
  --slotted-tag-inset-inline: calc(var(--slotted-space-5) + var(--slotted-space-1));
}
`;

// Workaround for Slotted issue #39: only the tooltip's content fades, so its arrow stays opaque
// and reads as a separate piece on open and close. The arrow takes the content's three fade rules.
// Half of the arrow's square lies over the content: while both fade, that half composites twice
// and the whole diamond shows through. The clip keeps the half outside the content, plus an
// overlap that covers the content's border under the arrow's base.
const tooltipArrowFadeRule = `
[data-ui="tooltip"] > [data-part="arrow"] {
  --equori-tooltip-arrow-overlap: 0.5px;
  opacity: 0;
  transition: opacity var(--slotted-duration-short) var(--slotted-easing-exit);
}

[data-ui="tooltip"][data-variant="surface"] > [data-part="arrow"] {
  --equori-tooltip-arrow-overlap: 1.5px;
}

[data-ui="tooltip"][data-side="bottom"] > [data-part="arrow"] {
  clip-path: polygon(
    0 0,
    calc(100% + var(--equori-tooltip-arrow-overlap)) 0,
    0 calc(100% + var(--equori-tooltip-arrow-overlap))
  );
}

[data-ui="tooltip"][data-side="top"] > [data-part="arrow"] {
  clip-path: polygon(
    100% 100%,
    100% calc(0% - var(--equori-tooltip-arrow-overlap)),
    calc(0% - var(--equori-tooltip-arrow-overlap)) 100%
  );
}

[data-ui="tooltip"][data-side="left"] > [data-part="arrow"] {
  clip-path: polygon(
    100% 0,
    100% calc(100% + var(--equori-tooltip-arrow-overlap)),
    calc(0% - var(--equori-tooltip-arrow-overlap)) 0
  );
}

[data-ui="tooltip"][data-side="right"] > [data-part="arrow"] {
  clip-path: polygon(
    0 100%,
    0 calc(0% - var(--equori-tooltip-arrow-overlap)),
    calc(100% + var(--equori-tooltip-arrow-overlap)) 100%
  );
}

[data-ui="tooltip"][data-open] > [data-part="arrow"] {
  opacity: 1;
  transition: none;
}

[data-ui="tooltip"][data-open][data-positioned] > [data-part="arrow"] {
  animation: slotted-tooltip-fade var(--slotted-duration-medium) var(--slotted-easing-enter);
}
`;

// A bottom sheet slides in 480 ms and out in 260 ms; 240 ms and 280 ms read abrupt on the way in.
const sheetSlideRule = `
[data-ui="drawer"][data-mode="overlay"][data-side="bottom"][data-drag] {
  --slotted-drawer-slide-duration: 480ms;
  --slotted-drawer-slide-exit-duration: 260ms;
}
`;

export default extendTheme(
  defaultTheme,
  {
    seeds: {
      accent: "#7c6cff",
      // Graphite carrying the accent's hue at a chroma the surfaces scale down to under 0.008.
      neutral: "#6f6f86",
      warning: "#facc15",
      danger: "#f87171",
    },
    // The dark ground sits near black. The page steps 0.025 above the sunken layer and a card or a
    // menu 0.015 above the page: it reads apart without standing out (owner review, 2026-10-21).
    recipe: {
      ...defaultTheme.recipe,
      dark: {
        ...defaultDark,
        "--slotted-tone-accent-border": indigoKept(
          "--slotted-tone-accent-border",
          0.1,
          0.9,
        ),
        "--slotted-tone-accent-text": indigoKept(
          "--slotted-tone-accent-text",
          0.17,
          0.7,
        ),
        "--slotted-surface-sunken": darkNeutral(0.13),
        "--slotted-surface": darkNeutral(0.155),
        "--slotted-surface-raised": darkNeutral(0.2),
        "--slotted-border-subtle": {
          seed: "neutral",
          l: 0.275,
          c: { scale: 0.22, max: 0.051 },
        },
        "--slotted-control-border-color": {
          seed: "neutral",
          l: 0.36,
          c: { scale: 0.332, max: 0.06 },
        },
        "--slotted-disabled-background": darkNeutral(0.19),
        "--slotted-disabled-border": {
          seed: "neutral",
          l: 0.25,
          c: { scale: 0.22, max: 0.046 },
        },
        "--slotted-text-inverse": darkNeutral(0.155),
      },
    },
    // Series take eight hues at one OKLCH lightness per scheme (0.66 dark, 0.58 light), indigo
    // first, so no slot outweighs another and each sits beside the accent.
    schemes: {
      dark: {
        "--slotted-data-1": "#8a82e9",
        "--slotted-data-2": "#cb7f00",
        "--slotted-data-3": "#00a8a8",
        "--slotted-data-4": "#de6674",
        "--slotted-data-5": "#069ce4",
        "--slotted-data-6": "#68a63f",
        "--slotted-data-7": "#c46dbd",
        "--slotted-data-8": "#db703b",
      },
      light: {
        // Set by owner review (2026-10-21): the material reads white over the light page.
        "--slotted-surface-material":
          "color-mix(in oklab, var(--slotted-surface) 84%, transparent)",
        "--slotted-data-1": "#7368d4",
        "--slotted-data-2": "#b46400",
        "--slotted-data-3": "#009597",
        "--slotted-data-4": "#c6495b",
        "--slotted-data-5": "#0083ce",
        "--slotted-data-6": "#4d8e16",
        "--slotted-data-7": "#ad51a7",
        "--slotted-data-8": "#c4530f",
      },
    },
    base: {
      "--slotted-control-shadow-focus-geometry": "0 0 0 0",
      // A focused field draws its ring over its own edge; a button keeps the gap that separates
      // its ring from a solid fill of the same hue.
      "--slotted-control-focus-ring-offset":
        "calc(var(--slotted-control-border-width) * -1)",
    },
    // Destinations read muted, the current one in the full text colour over the bar's own
    // ground, underlined.
    components: {
      // Workaround for Slotted issue #38: at 0.25rem a description or an error touched the
      // control above it.
      "--slotted-field-group-message-gap": "var(--slotted-space-4)",
      "--slotted-top-navigation-color": "var(--slotted-text-muted)",
      "--slotted-top-navigation-current-color": "var(--slotted-text)",
      "--slotted-top-navigation-current-background": "transparent",
      // A table is lines on the page, not a surface over it.
      "--slotted-table-surface": "transparent",
      "--slotted-table-header-surface": "transparent",
      // The rule under a header and over a total stands halfway between a row's rule and the
      // strong border: the strong border read as a heavy line (owner review item 17).
      "--slotted-table-border-color-strong":
        "color-mix(in oklch, var(--slotted-border-subtle) 50%, var(--slotted-border-strong))",
      "--slotted-data-grid-border-color-strong":
        "var(--slotted-table-border-color-strong)",
      // A saved value is not a state: choosing one keeps the field's own surface instead of the
      // library's accent tint.
      "--slotted-text-field-autofill-background":
        "var(--slotted-control-surface)",
      "--slotted-combobox-autofill-background":
        "var(--slotted-control-surface)",
      "--slotted-multi-select-autofill-background":
        "var(--slotted-control-surface)",
      "--slotted-entity-picker-autofill-background":
        "var(--slotted-control-surface)",
      "--slotted-tags-input-autofill-background":
        "var(--slotted-control-surface)",
      "--slotted-otp-input-autofill-background":
        "var(--slotted-control-surface)",
      // The bars held at the bottom edge are materials, as the header is at the top.
      "--slotted-page-footer-background": "var(--slotted-surface-material)",
      "--slotted-page-footer-backdrop-filter":
        "var(--slotted-material-backdrop)",
      "--slotted-detail-panel-footer-background":
        "var(--slotted-surface-material)",
      "--slotted-detail-panel-footer-backdrop-filter":
        "var(--slotted-material-backdrop)",
      // The palette floats over the page as a material; its footer keeps a tint of the sunken
      // layer instead of an opaque band across the glass.
      "--slotted-command-palette-surface": "var(--slotted-surface-material)",
      "--slotted-command-palette-backdrop-filter":
        "var(--slotted-material-backdrop)",
      "--slotted-toast-surface": "var(--slotted-surface-material)",
      "--slotted-toast-backdrop-filter": "var(--slotted-material-backdrop)",
      "--slotted-command-palette-footer-surface":
        "color-mix(in oklab, var(--slotted-surface-sunken) 50%, transparent)",
    },
    rules: [
      summaryRule,
      currentDestinationRule,
      questionLegendRule,
      paletteScrimRule,
      sheetSlideRule,
      tooltipArrowFadeRule,
      tagInsetRule,
    ],
  },
  { name: "equori" },
);
