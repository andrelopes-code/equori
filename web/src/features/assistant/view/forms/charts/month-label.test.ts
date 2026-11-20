import { describe, expect, it } from "vitest";

import { monthLabel } from "@/features/assistant/view/forms/charts/month-label";

describe("monthLabel", () => {
  it("writes the short month of the locale", () => {
    expect(monthLabel("2026-10", "pt-BR")).toBe("out.");
    expect(monthLabel("2026-10", "en")).toBe("Oct");
  });
});
