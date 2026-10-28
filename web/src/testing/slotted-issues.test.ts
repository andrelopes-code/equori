import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { test } from "node:test";

const web = new URL("../../", import.meta.url);

function sources(): { file: string; text: string }[] {
  const files = [
    "CLAUDE.md",
    ...readdirSync(new URL("src", web), { recursive: true })
      .filter(
        (name) =>
          /\.(ts|tsx|css)$/.test(name) &&
          !name.includes(".gen.") &&
          !name.endsWith("slotted-issues.test.ts"),
      )
      .map((name) => `src/${name}`),
  ];
  return files.map((file) => {
    const source = readFileSync(new URL(file, web), "utf8");
    // The prose of CLAUDE.md quotes the comment form as a template; only its HTML comments are markers.
    const text = file.endsWith(".md")
      ? (source.match(/<!--[\s\S]*?-->/g) ?? []).join("\n")
      : source;
    return { file, text: text.replace(/\s+/g, " ") };
  });
}

// A workaround cites the issue that tracks it in andrelopes-code/slotted (web/CLAUDE.md).
test("a workaround names its Slotted issue by number", () => {
  const malformed = sources().flatMap(({ file, text }) =>
    [...text.matchAll(/Workaround for Slotted issue(?! #\d+\b)/g)].map(
      () => file,
    ),
  );
  assert.deepEqual(malformed, []);
});

test("no comment keeps the registry's title form", () => {
  const legacy = sources().flatMap(({ file, text }) =>
    /Workaround for Slotted findings? "/.test(text) ? [file] : [],
  );
  assert.deepEqual(legacy, []);
});
