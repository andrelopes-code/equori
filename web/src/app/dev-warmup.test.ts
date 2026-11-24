import { matchesGlob } from "node:path";

import { describe, expect, it } from "vitest";

// The configuration sits outside src/, where no alias reaches.
// eslint-disable-next-line no-restricted-imports
import config from "../../vite.config";

const routes = import.meta.glob<string>("../features/*/routes.ts", {
  query: "?raw",
  import: "default",
  eager: true,
});

describe("Warm-up of the dev server", () => {
  // A page outside the warm-up is read from disk on its first visit, level by level of its imports.
  it("transforms at start every page a route loads on demand", () => {
    const pages = Object.values(routes)
      .flatMap((source) => [...source.matchAll(/import\("@\/([^"]+)"\)/g)])
      .map((match) => `./src/${match[1] ?? ""}.tsx`)
      // Preview pages check one element in isolation.
      .filter((page) => !page.endsWith("-preview.tsx"));
    const globs = config.server?.warmup?.clientFiles ?? [];

    const cold = pages.filter(
      (page) => !globs.some((glob) => matchesGlob(page, glob)),
    );

    expect(pages.length).toBeGreaterThan(40);
    expect(cold).toEqual([]);
  });
});
