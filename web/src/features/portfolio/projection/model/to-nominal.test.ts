import { describe, expect, it } from "vitest";

import { toNominal } from "@/features/portfolio/projection/model/to-nominal";

describe("toNominal", () => {
  it("multiplies the amounts of the month k by (1 + inflation)^(k/12)", () => {
    const row = { contribution: 1, withdrawal: 2, gain: 3, value: 4 };
    const rows = [
      { month: "2026-11", ...row },
      { month: "2026-12", ...row },
    ];

    // 1268.25 bp is 1.01^12 within 3e-8: k = 1 gives 1.01 and k = 2 gives 1.0201.
    const [first, second] = toNominal(rows, 1268.25);

    expect(first?.month).toBe("2026-11");
    expect(first?.contribution).toBeCloseTo(1.01, 7);
    expect(first?.withdrawal).toBeCloseTo(2.02, 7);
    expect(first?.gain).toBeCloseTo(3.03, 7);
    expect(first?.value).toBeCloseTo(4.04, 7);
    expect(second?.contribution).toBeCloseTo(1.0201, 7);
    expect(second?.value).toBeCloseTo(4.0804, 7);
  });

  it("keeps the amounts at an inflation of zero", () => {
    const rows = [
      { month: "2026-11", contribution: 1, withdrawal: 2, gain: 3, value: 4 },
    ];

    expect(toNominal(rows, 0)).toEqual(rows);
  });
});
