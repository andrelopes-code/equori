// Declarations for the Node-runner theme test; @types/node and a typed conformance entry are not installed.
declare module "node:fs" {
  export function readFileSync(path: URL | string, encoding: "utf8"): string;
}

declare module "@slotted/theme/conformance" {
  import type { FlatTheme } from "@slotted/theme";

  export function themeConformance(input: {
    contract: unknown;
    theme: FlatTheme;
    css: string;
  }): void;
}
