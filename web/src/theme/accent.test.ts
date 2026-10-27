import { beforeEach, describe, expect, it } from "vitest";

import { accentSeeds, applyAccent, readAccent } from "@/theme/accent";

describe("accent", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.style.removeProperty("--slotted-seed-accent");
  });

  it("defaults to the theme's own accent when storage is empty", () => {
    expect(readAccent()).toBe("indigo");
  });

  it("returns the stored accent", () => {
    localStorage.setItem("equori.accent", "emerald");
    expect(readAccent()).toBe("emerald");
  });

  it("ignores a stored value that is not an accent", () => {
    localStorage.setItem("equori.accent", "red");
    expect(readAccent()).toBe("indigo");
  });

  it("keeps a custom colour and writes it as the accent seed", () => {
    applyAccent("#123abc");
    expect(readAccent()).toBe("#123abc");
    expect(
      document.documentElement.style.getPropertyValue("--slotted-seed-accent"),
    ).toBe("#123abc");
  });

  it("stores the accent and writes its seed on the document", () => {
    applyAccent("rose");
    expect(localStorage.getItem("equori.accent")).toBe("rose");
    expect(
      document.documentElement.style.getPropertyValue("--slotted-seed-accent"),
    ).toBe(accentSeeds.rose);
  });

  it("leaves the theme's seed in force for the default accent", () => {
    applyAccent("rose");
    applyAccent("indigo");
    expect(
      document.documentElement.style.getPropertyValue("--slotted-seed-accent"),
    ).toBe("");
  });
});
