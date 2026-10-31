import { describe, expect, it } from "vitest";

import { groupsOfFour } from "@/features/setup/groups-of-four";

describe("groupsOfFour", () => {
  it.each([
    { text: "ABCDEFGHIJKLMNOP", want: "ABCD EFGH IJKL MNOP" },
    { text: "ABCDEF", want: "ABCD EF" },
    { text: "", want: "" },
  ])("groups $text", ({ text, want }) => {
    expect(groupsOfFour(text)).toBe(want);
  });
});
