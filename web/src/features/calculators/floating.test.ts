import { describe, expect, it } from "vitest";

import { floatingKeys, readFloating } from "@/features/calculators/floating";

describe("readFloating", () => {
  it.each([
    [{}, "cdi", { form: "percent", text: "100", value: 1 }],
    [{}, "sofr", { form: "spread", text: "0", value: 0 }],
    [{ percent: "110" }, "sofr", { form: "percent", text: "110", value: 1.1 }],
    [{ spread: "2" }, "cdi", { form: "spread", text: "2", value: 0.02 }],
    [
      { form: "spread", percent: "110" },
      "cdi",
      { form: "spread", text: "0", value: 0 },
    ],
    [{ spread: "x" }, "sofr", { form: "spread", text: "x", value: null }],
  ] as const)("reads %o over %s", (search, id, want) => {
    expect(readFloating(search, floatingKeys, id)).toEqual(want);
  });
});
