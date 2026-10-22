import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { test } from "node:test";

const web = new URL("../../", import.meta.url);
const registry = readFileSync(
  new URL("../docs/slotted-findings.md", web),
  "utf8",
);

function markedText(file: string): string {
  const source = readFileSync(new URL(file, web), "utf8");
  // The prose of CLAUDE.md quotes the comment form as a template; only its HTML comments are markers.
  const marked = file.endsWith(".md")
    ? (source.match(/<!--[\s\S]*?-->/g) ?? []).join("\n")
    : source;
  // Comment leaders are dropped and lines joined, so a title wrapped over comment lines reads whole.
  return marked
    .replace(/\n\s*(\/\/|\*|\/\*|\{\/\*)\s?/g, " ")
    .replace(/\s+/g, " ");
}

function referencedTitles(): Set<string> {
  const files = [
    "CLAUDE.md",
    ...readdirSync(new URL("src", web), { recursive: true })
      .filter(
        (name) =>
          /\.(ts|tsx|css)$/.test(name) &&
          !name.includes(".gen.") &&
          !name.endsWith("slotted-findings.test.ts"),
      )
      .map((name) => `src/${name}`),
  ];
  const titles = new Set<string>();
  for (const file of files) {
    const mentions = markedText(file).matchAll(
      /Slotted findings? ((?:\([^)]*\) ?)?"[^"]+"(?: \([^)]*\))?(?: and "[^"]+")*)/g,
    );
    for (const mention of mentions) {
      for (const title of (mention[1] ?? "").matchAll(/"([^"]+)"/g)) {
        titles.add(title[1] ?? "");
      }
    }
  }
  return titles;
}

const states = new Map<string, string>();
for (const line of registry.split("\n")) {
  const cells = line.split("|").map((cell) => cell.trim());
  const state = cells[2] ?? "";
  if (cells.length >= 4 && ["open", "reported", "fixed"].includes(state)) {
    states.set(cells[1] ?? "", state);
  }
}
const referenced = referencedTitles();

test("the registry lists every finding a comment names", () => {
  assert.deepEqual(
    [...referenced].filter((title) => !states.has(title)),
    [],
  );
});

test("a finding is open only while a comment names it", () => {
  assert.deepEqual(
    [...states]
      .filter(([title, state]) => state === "open" && !referenced.has(title))
      .map(([title]) => title),
    [],
  );
});

test("no comment names a finding the library has fixed", () => {
  assert.deepEqual(
    [...states]
      .filter(([title, state]) => state === "fixed" && referenced.has(title))
      .map(([title]) => title),
    [],
  );
});
