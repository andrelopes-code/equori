import { describe, expect, it } from "vitest";

import { floatingKeys, readFloating } from "@/features/calculators/floating";

describe("readFloating", () => {
  it.each([
    [{}, "cdi", { form: "percent", text: "100", value: 1, basis: "current" }],
    [{}, "sofr", { form: "spread", text: "0", value: 0, basis: "current" }],
    [
      { percent: "110" },
      "sofr",
      { form: "percent", text: "110", value: 1.1, basis: "current" },
    ],
    [
      { spread: "2" },
      "cdi",
      { form: "spread", text: "2", value: 0.02, basis: "current" },
    ],
    [
      { form: "spread", percent: "110" },
      "cdi",
      { form: "spread", text: "0", value: 0, basis: "current" },
    ],
    [
      { spread: "x" },
      "sofr",
      { form: "spread", text: "x", value: null, basis: "current" },
    ],
    [
      { basis: "trailing" },
      "cdi",
      { form: "percent", text: "100", value: 1, basis: "trailing" },
    ],
  ] as const)("reads %o over %s", (search, id, want) => {
    expect(readFloating(search, floatingKeys, id)).toEqual(want);
  });
});
