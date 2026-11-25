import { describe, expect, it } from "vitest";

import { wholeShare } from "@/features/portfolio/projection/model/whole-share";

describe("wholeShare", () => {
  it.each([
    { share: 0.999, whole: 0.99 },
    { share: 1 - 1e-12, whole: 1 },
    { share: 1, whole: 1 },
    { share: 1.189, whole: 1.18 },
    { share: 0.29, whole: 0.29 },
    { share: 0, whole: 0 },
  ])("PX18: $share reads as $whole", ({ share, whole }) => {
    expect(wholeShare(share)).toBe(whole);
  });
});
