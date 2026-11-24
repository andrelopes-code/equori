import { readFileSync } from "node:fs";

import { compile } from "tailwindcss";
import { describe, expect, it } from "vitest";

describe("tailwind.css", () => {
  it.each([
    ["ms-0", "margin-inline-start: 0;"],
    ["ms-2", "margin-inline-start: var(--slotted-space-2);"],
    ["mx-9", "margin-inline: var(--slotted-space-9);"],
    ["pt-12", "padding-top: var(--slotted-space-12);"],
    ["gap-5", "gap: var(--slotted-space-5);"],
    ["ms-auto", "margin-inline-start: auto;"],
  ])(
    "resolves %s to the Slotted space token",
    async (candidate, declaration) => {
      const css = await build([candidate]);

      expect(css).toContain(declaration);
    },
  );

  it.each([
    ["ms-13", "a step outside the Slotted scale"],
    ["bg-red-500", "a colour of the Tailwind palette"],
    ["text-lg", "a font size of the Tailwind scale"],
  ])("emits no rule for %s, %s", async (candidate) => {
    const css = await build([candidate]);

    expect(css).not.toContain(candidate);
  });

  it("writes the utilities in the utilities layer and nothing else", async () => {
    const css = await build(["ms-2", "flex"]);

    expect(css).toContain("@layer utilities");
    expect(css).not.toContain("@layer base");
    expect(css).not.toContain("box-sizing");
  });
});

describe("layer order", () => {
  // The stylesheet of a split part links before the one of the entry; a layer declared there first
  // would stand below "slotted".
  it("is declared by the first stylesheet of the page, before the application's", () => {
    const page = readFileSync("index.html", "utf8");
    const boot = readFileSync("public/boot.css", "utf8");
    const layers = /@layer [^;{]+[;{]/.exec(boot)?.[0];

    expect(/<link rel="stylesheet" href="([^"]+)"/.exec(page)?.[1]).toBe(
      "/boot.css",
    );
    expect(layers).toBe("@layer slotted, app, utilities;");
  });
});

async function build(candidates: string[]): Promise<string> {
  const compiler = await compile(readFileSync("src/app/tailwind.css", "utf8"), {
    base: "src/app",
    loadStylesheet,
  });

  return compiler.build(candidates);
}

function loadStylesheet(id: string, base: string) {
  const path = id.startsWith("tailwindcss/")
    ? `node_modules/${id}`
    : `${base}/${id}`;

  return Promise.resolve({
    path,
    base: path.slice(0, path.lastIndexOf("/")),
    content: readFileSync(path, "utf8"),
  });
}
