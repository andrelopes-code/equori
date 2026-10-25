import { describe, expect, it } from "vitest";

import { usageDayRows } from "@/features/setup/usage-days";

describe("usageDayRows", () => {
  it("returns one row per day of the range, summing the models and filling empty days with zero", () => {
    const rows = usageDayRows(
      [
        {
          day: "2026-10-23",
          provider_id: "a",
          model: "m1",
          requests: 3,
          errors: 1,
          tokens: 100,
        },
        {
          day: "2026-10-23",
          provider_id: "b",
          model: "m2",
          requests: 2,
          errors: 0,
          tokens: 50,
        },
        {
          day: "2026-10-25",
          provider_id: "a",
          model: "m1",
          requests: 7,
          errors: 2,
          tokens: 400,
        },
      ],
      "2026-10-22",
      "2026-10-25",
    );
    expect(rows).toEqual([
      { day: "2026-10-22", requests: 0, errors: 0, tokens: 0 },
      { day: "2026-10-23", requests: 5, errors: 1, tokens: 150 },
      { day: "2026-10-24", requests: 0, errors: 0, tokens: 0 },
      { day: "2026-10-25", requests: 7, errors: 2, tokens: 400 },
    ]);
  });
});
