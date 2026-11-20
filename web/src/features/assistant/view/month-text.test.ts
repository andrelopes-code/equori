import { describe, expect, it } from "vitest";

import { monthText } from "@/features/assistant/view/month-text";

describe("monthText", () => {
  it("names the month and the year", () => {
    expect(monthText("2026-10", "pt-BR")).toBe("outubro 2026");
    expect(monthText("2026-10", "en")).toBe("October 2026");
  });
});
