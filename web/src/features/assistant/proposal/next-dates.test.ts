import { describe, expect, it } from "vitest";

import { nextDates } from "@/features/assistant/proposal/next-dates";

describe("nextDates", () => {
  it("lists six monthly dates by default", () => {
    expect(
      nextDates("2026-11-15", { frequency: "monthly", interval: 1, day: 15 }),
    ).toEqual([
      "2026-11-15",
      "2026-12-15",
      "2027-01-15",
      "2027-02-15",
      "2027-03-15",
      "2027-04-15",
    ]);
  });

  it("uses the last day of a shorter month", () => {
    expect(
      nextDates(
        "2027-01-31",
        { frequency: "monthly", interval: 1, day: 31 },
        3,
      ),
    ).toEqual(["2027-01-31", "2027-02-28", "2027-03-31"]);
  });

  it("steps by the interval", () => {
    expect(
      nextDates(
        "2026-11-15",
        { frequency: "monthly", interval: 2, day: 15 },
        3,
      ),
    ).toEqual(["2026-11-15", "2027-01-15", "2027-03-15"]);
  });

  it("returns nothing for other frequencies", () => {
    expect(
      nextDates("2026-11-15", { frequency: "weekly", interval: 1 }),
    ).toEqual([]);
  });
});
