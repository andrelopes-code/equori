import { describe, expect, it } from "vitest";

import { shareText } from "@/features/portfolio/contribution-plan/model/share-text";

describe("shareText", () => {
  it.each([
    [0, "0%"],
    [0.074, "7,4%"],
    [0.263, "26%"],
    [0.0995, "10%"],
    [1, "100%"],
  ])("writes %s as %s in pt-BR", (fraction, want) => {
    expect(shareText(fraction, "pt-BR")).toBe(want);
  });

  it("writes one decimal below 10% in en-US", () => {
    expect(shareText(0.074, "en-US")).toBe("7.4%");
  });
});
