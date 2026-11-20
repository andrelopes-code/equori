import { describe, expect, it } from "vitest";

import { slot } from "@/features/assistant/view/forms/more/slot";

describe("slot", () => {
  it("takes the theme's slots in order, then the neutral", () => {
    expect(slot(0)).toBe("var(--equori-slot-1)");
    expect(slot(7)).toBe("var(--equori-slot-8)");
    expect(slot(8)).toContain("color-mix");
  });
});
