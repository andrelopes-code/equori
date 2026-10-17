import { extendTheme } from "@slotted/theme";
import defaultTheme from "@slotted/themes/default";

export default extendTheme(
  defaultTheme,
  { seeds: { accent: "#0d9488" } },
  { name: "equori" },
);
