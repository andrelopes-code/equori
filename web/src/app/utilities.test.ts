import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const utilities = readFileSync("src/app/utilities.css", "utf8");

const marginProperties = {
  m: "margin",
  mx: "margin-inline",
  my: "margin-block",
  ms: "margin-inline-start",
  me: "margin-inline-end",
  mt: "margin-block-start",
  mb: "margin-block-end",
};

const paddingProperties = {
  p: "padding",
  px: "padding-inline",
  py: "padding-block",
  ps: "padding-inline-start",
  pe: "padding-inline-end",
  pt: "padding-block-start",
  pb: "padding-block-end",
};

const scale = [1, 2, 3, 4, 5, 6, 7, 8, 9];

describe("utilities.css", () => {
  it("declares each margin and padding class of the scale and no other", () => {
    expect(declaredClasses(withoutComments(utilities))).toEqual(
      expectedClasses(),
    );
  });

  it("keeps every rule inside one @layer app block", () => {
    const css = withoutComments(utilities);

    expect(css.trimStart().startsWith("@layer app {")).toBe(true);
    expect(css.match(/@layer/g)).toHaveLength(1);
  });
});

function expectedClasses(): Record<string, string> {
  const classes: Record<string, string> = {};

  for (const [prefix, property] of Object.entries(marginProperties)) {
    for (const step of ["0", "auto", ...scale.map(token)]) {
      classes[`${prefix}-${stepName(step)}`] = `${property}: ${step};`;
    }
  }

  for (const [prefix, property] of Object.entries(paddingProperties)) {
    for (const step of ["0", ...scale.map(token)]) {
      classes[`${prefix}-${stepName(step)}`] = `${property}: ${step};`;
    }
  }

  return classes;
}

function declaredClasses(css: string): Record<string, string> {
  const classes: Record<string, string> = {};

  for (const [, name = "", body = ""] of css.matchAll(
    /\.([a-z]+-[0-9a-z]+)\s*\{([^}]*)\}/g,
  )) {
    classes[name] = body.trim().replace(/\s+/g, " ");
  }

  return classes;
}

function token(step: number): string {
  return `var(--slotted-space-${String(step)})`;
}

function stepName(value: string): string {
  return value.replace(/^var\(--slotted-space-(\d+)\)$/, "$1");
}

function withoutComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, "");
}
