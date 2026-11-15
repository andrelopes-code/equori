import { describe, expect, it } from "vitest";

import { initials } from "@/features/assistant/proposal/initials";

describe("initials", () => {
  it.each([
    ["Padaria Real", "PR"],
    ["iFood lunch at noon", "IL"],
    ["Outback", "O"],
    ["  ", ""],
    ["égua nova", "ÉN"],
  ])("writes %s as %s", (description, expected) => {
    expect(initials(description)).toBe(expected);
  });
});
