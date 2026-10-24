import { describe, expect, it } from "vitest";

import { latestPrice } from "@/features/instruments/instrument-groups";

describe("latestPrice", () => {
  it("returns the price with the greatest date", () => {
    const price = (date: string, value: string) => ({ date, value }) as never;
    expect(
      latestPrice([
        price("2026-10-01", "1"),
        price("2026-10-09", "3"),
        price("2026-10-05", "2"),
      ]),
    ).toEqual({ date: "2026-10-09", value: "3" });
    expect(latestPrice([])).toBeUndefined();
  });
});
