import { describe, expect, it } from "vitest";

import { comparisonStart } from "@/features/portfolio/projection/versus-block/versus-start";

describe("comparisonStart", () => {
  it("is the first day of the month after the baseline", () => {
    expect(comparisonStart("2026-10-17")).toBe("2026-11-01");
  });

  it("rolls December over to January of the next year", () => {
    expect(comparisonStart("2025-12-05")).toBe("2026-01-01");
  });
});
