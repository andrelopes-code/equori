import { describe, expect, it } from "vitest";

import {
  journeyMonths,
  monthEnd,
} from "@/features/portfolio/projection/journey-block/journey-months";

describe("journeyMonths", () => {
  it("runs from the month after today to the birth month of the last age", () => {
    const { months, withdrawalFrom } = journeyMonths(
      "2026-11-25",
      "1994-03-10",
      33,
      34,
    );

    expect(withdrawalFrom).toBe("2027-03");
    expect(months).toHaveLength(16);
    expect(months[0]).toBe("2026-12");
    expect(months[3]).toBe("2027-03");
    expect(months.at(-1)).toBe("2028-03");
  });
});

describe("monthEnd", () => {
  it.each([
    ["2028-02", "2028-02-29"],
    ["2027-02", "2027-02-28"],
    ["2026-12", "2026-12-31"],
  ])("closes %s on %s", (month, end) => {
    expect(monthEnd(month)).toBe(end);
  });
});
