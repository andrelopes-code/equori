import { extendTheme } from "@slotted/theme";
import defaultTheme from "@slotted/themes/default";

// A total closes its table with a double rule, as on a ledger sheet; no table token draws one.
const summaryRule = `
[data-ui="table"] [data-part="summary"] [data-part="row"]:first-child [data-part="cell"],
[data-ui="table"] [data-part="summary"] [data-part="row"]:first-child [data-part="row-header"] {
  border-block-start: calc(var(--slotted-border-width-thin) * 3) double var(--slotted-border-strong);
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

export default extendTheme(
  defaultTheme,
  {
    seeds: {
      accent: "#2dd4bf",
      neutral: "#71717a",
      warning: "#facc15",
      danger: "#f87171",
    },
    // Accent marks forecasts only (ledger sheet L10): destinations read muted, the
    // current one in the full text colour over the bar's own ground, underlined.
    components: {
      "--slotted-top-navigation-color": "var(--slotted-text-muted)",
      "--slotted-top-navigation-current-color": "var(--slotted-text)",
      "--slotted-top-navigation-current-background": "transparent",
      // Ledger sheet L12: a table is lines on the page, not a surface over it.
      "--slotted-table-surface": "transparent",
      "--slotted-table-header-surface": "transparent",
    },
    rules: [summaryRule, currentDestinationRule],
  },
  { name: "equori" },
);
