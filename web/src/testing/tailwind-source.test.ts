import { readdirSync, readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

describe("arbitraryValues", () => {
  it.each([
    ['<Text className="ms-[13px]" />', ["ms-[13px]"]],
    ['<Box className="flex mt-[2rem] p-2" />', ["mt-[2rem]"]],
    ["<Box className={'w-[50%] ms-2'} />", ["w-[50%]"]],
    ['<Text className="ms-2 p-4" />', []],
    ["<Text className={styles.note} />", []],
  ])("finds the arbitrary values of %s", (source, expected) => {
    expect(arbitraryValues(source)).toEqual(expected);
  });
});

describe("sources under src", () => {
  it("hold no arbitrary Tailwind value in a className literal", () => {
    const found: string[] = [];

    for (const file of sourceFiles()) {
      for (const value of arbitraryValues(readFileSync(file, "utf8"))) {
        found.push(`${file}: ${value}`);
      }
    }

    expect(found).toEqual([]);
  });
});

function sourceFiles(): string[] {
  return readdirSync("src", { recursive: true })
    .filter((file) => file.endsWith(".tsx") && !file.endsWith(".test.tsx"))
    .map((file) => `src/${file}`);
}

function arbitraryValues(source: string): string[] {
  const values: string[] = [];

  for (const match of source.matchAll(
    /className=(?:"([^"]*)"|\{\s*['"`]([^'"`]*)['"`]\s*\})/g,
  )) {
    const classes = (match[1] ?? match[2] ?? "").split(/\s+/);

    values.push(...classes.filter((name) => /\[.*\]/.test(name)));
  }

  return values;
}
