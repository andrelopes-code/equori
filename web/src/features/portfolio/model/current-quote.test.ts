import { describe, expect, it } from "vitest";

import { currentQuoteOf } from "@/features/portfolio/model/current-quote";

describe("currentQuoteOf", () => {
  it.each([
    ["no prices", undefined, undefined],
    ["a price without an instant", [{}], undefined],
    [
      "one open quote",
      [{ at: "2026-11-03T14:58:00Z", open: true }],
      { at: "2026-11-03T14:58:00Z", open: true },
    ],
    [
      "the earliest instant, open when any is open",
      [
        { at: "2026-11-03T14:58:00Z", open: false },
        { at: "2026-11-03T14:40:00Z", open: true },
      ],
      { at: "2026-11-03T14:40:00Z", open: true },
    ],
    [
      "a price without an instant beside a quote",
      [{ at: "2026-11-03T14:58:00Z", open: false }, {}],
      { at: "2026-11-03T14:58:00Z", open: false },
    ],
  ] as const)("reads %s", (_name, prices, want) => {
    expect(currentQuoteOf(prices)).toEqual(want);
  });
});
