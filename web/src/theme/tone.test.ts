import { beforeEach, describe, expect, it } from "vitest";

import { tone } from "@/theme/tone";

describe("tone", () => {
  beforeEach(() => {
    localStorage.clear();
    tone.apply(tone.fallback);
  });

  it("marks the document for every tone but the theme's own", () => {
    for (const value of ["slate", "sage", "#ff0000"] as const) {
      tone.apply(value);
      expect(document.documentElement, value).toHaveAttribute("data-tone");
    }
    expect(
      document.documentElement.style.getPropertyValue("--slotted-seed-neutral"),
    ).toBe("#ff0000");
  });

  it("leaves the theme's own tone unmarked", () => {
    tone.apply("sage");
    tone.apply(tone.fallback);
    expect(document.documentElement).not.toHaveAttribute("data-tone");
  });
});
