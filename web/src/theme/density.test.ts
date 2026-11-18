import { beforeEach, describe, expect, it } from "vitest";

import { applyDensity, readDensity } from "@/theme/density";

describe("density", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute("data-slotted-density");
  });

  it("defaults to compact when storage is empty", () => {
    expect(readDensity()).toBe("compact");
  });

  it("returns the stored density", () => {
    localStorage.setItem("equori.density", "dense");
    expect(readDensity()).toBe("dense");
  });

  it("ignores a stored value that is not a density", () => {
    localStorage.setItem("equori.density", "roomy");
    expect(readDensity()).toBe("compact");
  });

  it("stores the density and sets it on the document", () => {
    applyDensity("compact");
    expect(localStorage.getItem("equori.density")).toBe("compact");
    expect(document.documentElement).toHaveAttribute(
      "data-slotted-density",
      "compact",
    );
  });
});
