import { extendTheme } from "@slotted/theme";

import { glassRules } from "./glass/index.ts";
import equori from "./equori.theme.ts";

// The equori theme with translucent glass surfaces over the aurora, in the dark scheme. It is a
// theme of its own, compiled to equori-glass.gen.css, so an application that does not turn the
// experimental visual style on never loads it (theme/visual.ts).
export default extendTheme(
  equori,
  { rules: glassRules },
  { name: "equori-glass" },
);
