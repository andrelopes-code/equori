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

export default extendTheme(
  defaultTheme,
  {
    seeds: {
      accent: "#2dd4bf",
      neutral: "#71717a",
      warning: "#facc15",
      danger: "#f87171",
    },
    rules: [summaryRule],
  },
  { name: "equori" },
);
