import { beforeEach, describe, expect, it } from "vitest";

import { statusSeeds } from "@/theme/status";

describe("status seeds", () => {
  beforeEach(() => {
    localStorage.clear();
    for (const seed of Object.values(statusSeeds)) seed.apply(seed.fallback);
  });

  it("paints a picked colour on the root and remembers it", () => {
    statusSeeds.success.apply("#14b8a6");

    expect(
      document.documentElement.style.getPropertyValue("--slotted-seed-success"),
    ).toBe("#14b8a6");
    expect(localStorage.getItem("equori.success")).toBe("#14b8a6");
  });

  it("returns to the theme's own seed", () => {
    statusSeeds.danger.apply("#f97066");

    statusSeeds.danger.apply("theme");

    expect(
      document.documentElement.style.getPropertyValue("--slotted-seed-danger"),
    ).toBe("");
  });

  it("reads a stored value that is not a colour as the theme's own", () => {
    localStorage.setItem("equori.warning", "red; color: red");

    expect(statusSeeds.warning.read()).toBe("theme");
  });
});
