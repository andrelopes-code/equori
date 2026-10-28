// Declarations for the Node-runner tests (theme, Slotted issues); @types/node and a typed conformance entry are not installed.
declare module "node:fs" {
  export function readFileSync(path: URL | string, encoding: "utf8"): string;
  export function readdirSync(
    path: URL | string,
    options: { recursive: true },
  ): string[];
}

declare module "@slotted/theme/conformance" {
  import type { FlatTheme } from "@slotted/theme";

  export function themeConformance(input: {
    contract: unknown;
    theme: FlatTheme;
    css: string;
  }): void;
}

declare module "node:test" {
  export function test(name: string, fn: () => void): void;
}

declare module "node:assert/strict" {
  const assert: {
    equal(actual: unknown, expected: unknown, message?: string): void;
    notEqual(actual: unknown, expected: unknown, message?: string): void;
    deepEqual(actual: unknown, expected: unknown, message?: string): void;
    match(actual: string, expected: RegExp, message?: string): void;
    doesNotMatch(actual: string, expected: RegExp, message?: string): void;
    ok(value: unknown, message?: string): void;
  };
  export default assert;
}
