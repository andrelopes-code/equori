import { extendTheme } from "@slotted/theme";
import defaultTheme from "@slotted/themes/default";

import { overlayItemRules } from "./overlay-items.ts";

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

// Owner review of 2026-11-02: the choices of a question stood against its description (0.375rem,
// the family's gap between a legend and its choices). A group's description and error are inline
// messages; the choices stand 1rem below them.
const questionChoicesRule = `
[data-ui="field-group"] > [data-ui="inline-message"] + [data-part="content"] {
  margin-block-start: var(--slotted-space-6);
}
`;

// Owner review of 2026-11-03: an empty or failed region spoke louder than the page around it. Its
// title reads at the body size, and the page-wide one a step above; the inline one keeps its own
// small size.
const resultStateRule = `
[data-ui="result-state"] {
  --slotted-result-state-title-font-size: var(--slotted-font-size-md);
}

[data-ui="result-state"][data-reach="page"] {
  --slotted-result-state-title-font-size: var(--slotted-font-size-lg);
}

[data-ui="result-state"][data-reach="inline"] {
  --slotted-result-state-title-font-size: var(--slotted-font-size-sm);
}
`;

// Owner review of 2026-11-02 (trial): a section title spaced further from the fields read as a
// label, and a change of background does not show where the page has the same background. The
// section reserves a bar in the gutter, transparent at rest, so the content stays aligned with
// the page. Under the pointer or holding the focus, the bar takes the accent colour; the title
// keeps its colour (owner review, 2026-11-02).
const sectionRule = `
[data-ui="field-group"][data-kind="section"] {
  margin-inline-start: calc(var(--slotted-space-6) * -1);
  padding-inline-start: calc(var(--slotted-space-6) - var(--slotted-border-width-thick) * 1.5);
  border-inline-start: calc(var(--slotted-border-width-thick) * 1.5) solid transparent;
  transition: border-color var(--slotted-duration-short) var(--slotted-easing-standard);
}

[data-ui="field-group"][data-kind="section"]:is(:hover, :focus-within) {
  border-inline-start-color: var(--slotted-tone-accent-solid);
}
`;

// Workaround for Slotted issue #98: the description keeps a fixed 2 px margin under the title,
// and with the line boxes the title and the description stood 7 px apart, close to the 11 px of
// the body. The margin goes, and the description sits at the title's line box.
const sectionDescriptionRule = `
[data-ui="section"] > [data-part="header"] > [data-part="title"] > [data-part="description"] {
  margin-block-start: 0;
}
`;

// Workaround for Slotted issue #100: the actions of a section stand in the row of the heading, so
// their height sets the distance to the description (15 px with none, 39 px beside 64 px). The
// actions span the three rows and the first row, empty, is the flexible one that takes their
// height: the title and its description keep one distance beside any actions.
const sectionActionsRule = `
[data-ui="section"] > [data-part="header"]:has(> [data-part="title"] > [data-part="description"]) {
  grid-template-rows: 1fr auto auto;
}

[data-ui="section"] > [data-part="header"]:has(> [data-part="title"] > [data-part="description"]) > [data-part="actions"] {
  grid-row: 1 / span 3;
  align-self: center;
}
`;

// Workaround for Slotted issue #116: a top-level section always titles itself as a 13 px uppercase
// label. A large section on a surface is a panel of the page, and a conclusion inside it (15 px,
// semibold) outweighed its label, so the panels read as one block. The panel's title reads in mixed
// case, one step above that conclusion.
const panelTitleRule = `
[data-ui="section"][data-ground="surface"][data-size="lg"] > [data-part="header"] > [data-part="title"] > [data-part="heading"] {
  font-size: var(--slotted-font-size-xl);
  line-height: var(--slotted-line-height-xl);
  letter-spacing: normal;
  text-transform: none;
}
`;

// Workaround for Slotted issue #99: the actions of a card header occupy its first row, and a
// control taller than the title stretches that row, which pushes the description away. The
// actions span the rows of the header's text, so its height is shared and adds nothing.
const cardActionsRule = `
[data-ui="card"] > [data-part="header"]:has(> :nth-child(2 of :not([data-part="actions"]))) > [data-part="actions"] {
  grid-row: 1 / span 2;
}

[data-ui="card"] > [data-part="header"]:has(> :nth-child(3 of :not([data-part="actions"]))) > [data-part="actions"] {
  grid-row: 1 / span 3;
}
`;

// Workaround for Slotted issue #120: the header of a chart holds its description 0.125rem under its
// title by a literal gap with no token, and the theme cannot select the unnamed element that
// carries it. The description takes the gap back as a negative margin. The card variant keeps the
// gap in its minimum height, so the header ends 0.125rem below the description.
const chartHeaderRule = `
[data-ui="chart"] > [data-part="header"] [data-part="description"] {
  margin-block-start: calc(var(--slotted-space-1) * -1);
}
`;

// A light palette dims the page less: the material already sets it apart.
const paletteScrimRule = `
&[data-slotted-scheme="light"] [data-ui="dialog"]:has([data-ui="command-palette"]) {
  --slotted-dialog-scrim: color-mix(in srgb, var(--slotted-scrim) 30%, transparent);
}
`;

// Workaround for Slotted issue #83: the group label paints the panel's surface a second time, and
// over the translucent material the two layers read as a lighter band. A fill that matches the
// material cannot be set from outside (the page behind varies), and a blur lightens the band
// again, so the label keeps no fill and scrolls with its rows instead of sticking above them.
const paletteGroupLabelRule = `
[data-ui="command-palette"] [data-part="group-label"] {
  background: transparent;
  position: static;
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
// A table is lines on the page, so its header surface is transparent. A header pinned to the top
// has rows passing under it, and takes the ground the table stands on.
// Workaround for Slotted issue #89: the plain trigger paints its hover and active fill with no
// corner, a square box under any corner style.
const collapsibleCornerRule = `
[data-ui="collapsible"] > [data-part="header"] > [data-part="trigger"] {
  border-radius: var(--slotted-control-radius);
}
`;

// Workaround for Slotted issue #90: an outline or ghost Button in the danger tone changes only its
// text color. The hover and active fills take the danger tone, and the outline border takes it on hover.
const dangerButtonRule = `
[data-ui="button"][data-tone="danger"]:is([data-variant="outline"], [data-variant="ghost"]):hover:not(:disabled):not([data-disabled]):not([data-loading]) {
  background: color-mix(in oklch, var(--slotted-tone-danger-solid) 12%, transparent);
}

[data-ui="button"][data-tone="danger"][data-variant="outline"]:is(:hover, :active):not(:disabled):not([data-disabled]):not([data-loading]) {
  border-color: color-mix(in oklch, var(--slotted-tone-danger-text) 45%, transparent);
}

[data-ui="button"][data-tone="danger"]:is([data-variant="outline"], [data-variant="ghost"]):active:not(:disabled):not([data-disabled]):not([data-loading]) {
  background: color-mix(in oklch, var(--slotted-tone-danger-solid) 20%, transparent);
}
`;

// Workaround for Slotted issue #91: the help control of a widget is a control-height button. It
// draws as a 1.5rem muted glyph that fills on hover.
const widgetHelpRule = `
[data-ui="dashboard-grid"] [data-part="widget"] [data-part="title-row"] > [data-part="help"] {
  block-size: 1.5rem;
  min-block-size: 0;
  inline-size: 1.5rem;
  min-inline-size: 0;
  padding: 0;
  border-radius: var(--slotted-control-radius);
  color: var(--slotted-text-muted);
  margin-inline-start: var(--slotted-space-2);
  margin-block: calc((1.5rem - var(--slotted-font-size-md, 0.8125rem) * var(--slotted-line-height-md, 1.5)) / -2);
}
`;

// Workaround for Slotted issue #85: the page does not publish its ground, so the sunken one stands
// in where no section sets it.
const stickyHeaderRule = `
[data-ui="table"][data-sticky-header] {
  --slotted-table-header-surface: var(--slotted-ground, var(--slotted-surface-sunken));
}
`;

// Workaround for Slotted issue #86: a column pinned to a side paints the raised surface, a shade off
// the ground the table stands on. It takes that ground: the section's, or the page's sunken one
// where no section sets it, because the page does not publish its ground (issue #85).
const stickyColumnRule = `
[data-ui="table"] {
  --slotted-table-sticky-surface: var(--slotted-ground, var(--slotted-surface-sunken));
}
`;

// Workaround for Slotted issue #145: an invalid switch paints the thumb and the inside of the track
// in the danger tone. Only the outer border of the track keeps it; the thumb keeps its own border.
const invalidSwitchRule = `
[data-ui="switch"][data-invalid] > [data-part="track"] {
  box-shadow: none;
}

[data-ui="switch"][data-invalid] > [data-part="track"] > [data-part="thumb"] {
  border-color: var(--slotted-switch-thumb-border-color, var(--slotted-control-border-color));
  box-shadow: var(--slotted-switch-thumb-shadow, var(--slotted-control-shadow, none));
}

[data-ui="switch"][data-invalid][data-checked] > [data-part="track"] > [data-part="thumb"] {
  border-color: var(--slotted-switch-checked-thumb-border-color, var(--slotted-tone-accent-solid));
}

[data-ui="switch"][data-invalid][data-readonly] > [data-part="track"] > [data-part="thumb"] {
  border-color: var(--slotted-switch-readonly-border-color, var(--slotted-control-border-color));
}
`;

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

// Workaround for Slotted issue #39: half of the arrow's square lies over the content, so while both
// fade that half composites twice and the whole diamond shows through. The clip keeps the half
// outside the content, plus an overlap that covers the content's border under the arrow's base.
const tooltipArrowClipRule = `
[data-ui="tooltip"] > [data-part="arrow"] {
  --equori-tooltip-arrow-overlap: 0.5px;
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
`;

// A long list (150 currencies) in a select or a picker stops at 20 rem, 8 to 9 rows, and scrolls
// inside. The overlay token is not set on the root or on a menu: a popover, such as the calendar of
// a date field, and a menu of actions, such as the account menu, would read it too and clip
// their content.
const listHeightRule = `
[data-ui="select"],
[data-ui="multi-select"],
[data-ui="entity-picker"] {
  --slotted-overlay-max-block-size: 20rem;
}
`;

// Workaround for Slotted issue #125: a list with no match draws its empty message and, under it,
// the count message, which reads the same for a total of 0. The count stays in the accessibility
// tree as the live announcement and is not drawn. A leaf with no descendants, so the clip-path
// does not end a backdrop-filter (O11).
const emptyStatusRule = `
[data-part="empty"] + [data-part="status"] {
  position: absolute;
  inline-size: 1px;
  block-size: 1px;
  padding: 0;
  overflow: hidden;
  white-space: nowrap;
  clip-path: inset(50%);
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
        // Workaround for Slotted issue #92: the derived danger text keeps 48% of the seed's chroma
        // on a dark ground and reads pink, and its border is a lighter, paler step of it; both take the
        // danger seed itself.
        "--slotted-tone-danger-text": "#f87171",
        "--slotted-tone-danger-border": "#f87171",
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
      // The steps above the body text read large for what they head: an empty region, a dialog,
      // a section and the figure of a card spoke louder than the page around them. Each step from
      // lg up moves one size down; the order of the scale stays.
      "--slotted-font-size-lg": "0.9375rem",
      "--slotted-font-size-xl": "1rem",
      "--slotted-font-size-2xl": "1.125rem",
      "--slotted-font-size-3xl": "1.25rem",
      "--slotted-font-size-4xl": "1.75rem",
      // The default scale reads loose at the 12 to 18 px of an interface: a description that wraps
      // showed a gap between its lines. Text keeps the pair of its size, closer to 1.3.
      "--slotted-line-height-xs": "1.25",
      "--slotted-line-height-sm": "1.3",
      "--slotted-line-height-md": "1.3",
      "--slotted-line-height-lg": "1.3",
      "--slotted-line-height-xl": "1.3",
      "--slotted-line-height-2xl": "1.25",
      "--slotted-line-height-3xl": "1.2",
      "--slotted-line-height-4xl": "1.15",
      "--slotted-control-shadow-focus-geometry": "0 0 0 0",
      // A focused field draws its ring over its own edge; a button keeps the gap that separates
      // its ring from a solid fill of the same hue.
      "--slotted-control-focus-ring-offset":
        "calc(var(--slotted-control-border-width) * -1)",
    },
    // Destinations read muted, the current one in the full text colour over the bar's own
    // ground, underlined.
    components: {
      // A question's description or error stands 0.5rem under its legend. A field's own message
      // follows --slotted-field-row-gap.
      "--slotted-field-group-message-gap": "var(--slotted-space-4)",
      // Two fields stand 1.5rem apart, so a label reads with the control under it; two sections
      // stand 2.5rem apart, the rule under each legend marking the topic (owner review,
      // 2026-11-02).
      "--slotted-form-field-gap": "var(--slotted-space-8)",
      "--slotted-form-section-gap": "var(--slotted-space-10)",
      // Owner review of 2026-11-13: a section's title and description read as one unit, and the
      // body stands clear of both, 16 px under the description against about 5 px under the title.
      "--slotted-section-gap": "var(--slotted-space-6)",
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
      // Workaround for Slotted issue #91: a widget's help note is a few sentences; the 16rem popover
      // of that control wraps it into a tall column.
      "--slotted-popover-measure-sm": "24rem",
      // Owner review of 2026-11-15: the line boxes of the title and of the description already stand
      // apart by the leading of their fonts; the header's 0.25rem row gap on top read as a hole.
      "--slotted-card-header-gap": "0",
      "--slotted-list-item-body-gap": "0",
      "--slotted-stepper-description-gap": "0",
      "--slotted-toast-surface": "var(--slotted-surface-material)",
      "--slotted-toast-backdrop-filter": "var(--slotted-material-backdrop)",
      "--slotted-command-palette-footer-surface":
        "color-mix(in oklab, var(--slotted-surface-sunken) 50%, transparent)",
    },
    rules: [
      summaryRule,
      currentDestinationRule,
      questionLegendRule,
      questionChoicesRule,
      sectionRule,
      sectionDescriptionRule,
      sectionActionsRule,
      panelTitleRule,
      cardActionsRule,
      chartHeaderRule,
      resultStateRule,
      paletteScrimRule,
      paletteGroupLabelRule,
      sheetSlideRule,
      tooltipArrowClipRule,
      tagInsetRule,
      listHeightRule,
      emptyStatusRule,
      stickyHeaderRule,
      ...overlayItemRules,
      stickyColumnRule,
      collapsibleCornerRule,
      dangerButtonRule,
      widgetHelpRule,
      invalidSwitchRule,
    ],
  },
  { name: "equori" },
);
