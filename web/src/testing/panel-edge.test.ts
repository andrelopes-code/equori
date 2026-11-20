import { readdirSync, readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

describe("unplacedEdges", () => {
  it.each([
    [".a {\n  composes: edge from 'x';\n  display: flex;\n}", [".a"]],
    [".a {\n  composes: edge from 'x';\n  position: relative;\n}", []],
    [".a {\n  composes: edge from 'x';\n  position: absolute;\n}", []],
    [".a {\n  display: flex;\n}", []],
  ])("finds the unplaced edges of %s", (source, expected) => {
    expect(unplacedEdges(source)).toEqual(expected);
  });
});

describe("stylesheets under src", () => {
  // The edge of panel-edge.module.css is an absolute ::before with inset 0: a class that composes
  // it and is not positioned draws the edge around its nearest positioned ancestor instead.
  it("position every class that composes the panel edge", () => {
    const offenders = stylesheets().flatMap((file) =>
      unplacedEdges(readFileSync(file, "utf8")).map(
        (rule) => `${file} ${rule}`,
      ),
    );

    expect(offenders).toEqual([]);
  });
});

function stylesheets(): string[] {
  return readdirSync("src", { recursive: true })
    .filter((file) => file.endsWith(".module.css"))
    .map((file) => `src/${file}`);
}

// unplacedEdges returns the selectors of the rules that compose `edge` without a position.
function unplacedEdges(source: string): string[] {
  return [...source.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
    .filter(
      ([, , body = ""]) =>
        /composes:\s*edge\b/.test(body) &&
        !/position:\s*(relative|absolute|fixed|sticky)/.test(body),
    )
    .map(([, selector = ""]) => selector.trim());
}
