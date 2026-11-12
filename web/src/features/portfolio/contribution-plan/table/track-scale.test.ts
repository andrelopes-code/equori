import { describe, expect, it } from "vitest";

import { trackScale } from "@/features/portfolio/contribution-plan/table/track-scale";

describe("trackScale", () => {
  it.each([
    {
      name: "the largest share plus 500 basis points",
      shares: [5555, 1666, 557, 2222, 4000, 2000, 4545, 1818],
      want: 6055,
    },
    { name: "a share the response omits", shares: [undefined, 300], want: 800 },
    { name: "no share at all", shares: [], want: 500 },
  ])("is $want for $name", ({ shares, want }) => {
    expect(trackScale(shares)).toBe(want);
  });
});
