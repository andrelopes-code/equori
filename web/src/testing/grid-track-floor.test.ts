import { readdirSync, readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

// A repeated track whose floor is a fixed length keeps that floor in a column narrower than it,
// and the grid runs past the edge of the screen. The floor is written min(<length>, 100%).
describe("fixedFloors", () => {
  it.each([
    ["grid-template-columns: repeat(auto-fit, minmax(28rem, 1fr));", ["28rem"]],
    [
      "grid-template-columns: repeat(\n  auto-fill,\n  minmax(300px, 1fr)\n);",
      ["300px"],
    ],
    [
      "grid-template-columns: repeat(auto-fit, minmax(min(28rem, 100%), 1fr));",
      [],
    ],
    ["grid-template-columns: repeat(auto-fill, minmax(0, 1fr));", []],
    ["grid-template-columns: max-content minmax(6rem, 1fr) max-content;", []],
  ])("finds the fixed floors of %s", (source, expected) => {
    expect(fixedFloors(source)).toEqual(expected);
  });
});

describe("stylesheets under src", () => {
  it("give no repeated track a floor wider than its column", () => {
    const found: string[] = [];

    for (const file of stylesheets()) {
      for (const floor of fixedFloors(readFileSync(file, "utf8"))) {
        found.push(`${file}: ${floor}`);
      }
    }

    expect(found).toEqual([]);
  });
});

function stylesheets(): string[] {
  return readdirSync("src", { recursive: true })
    .filter((file) => file.endsWith(".module.css"))
    .map((file) => `src/${file}`);
}

function fixedFloors(source: string): string[] {
  const flat = source.replace(/\s+/g, " ");
  const floors: string[] = [];

  for (const match of flat.matchAll(
    /repeat\( ?auto-(?:fit|fill) ?, ?minmax\( ?([0-9.]+[a-z]+) ?,/g,
  )) {
    floors.push(match[1] ?? "");
  }

  return floors;
}
