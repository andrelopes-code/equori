import { describe, expect, it } from "vitest";

import { formatRate, parseRate } from "@/features/instruments/rate";

describe("formatRate", () => {
  it("writes the decimal separator of the locale and keeps every digit", () => {
    expect(formatRate("1003.035884937853", "pt-BR")).toBe("1003,035884937853");
    expect(formatRate("1003.035884937853", "en-US")).toBe("1003.035884937853");
    expect(formatRate("38", "pt-BR")).toBe("38");
  });
});

describe("parseRate", () => {
  it.each([
    ["38.45", "38.45"],
    ["38,45", "38.45"],
    [" 7 ", "7"],
    ["0.000000000001", "0.000000000001"],
  ])("reads %s as %s", (text, rate) => {
    expect(parseRate(text)).toBe(rate);
  });

  it.each(["", "abc", "0", "0.0", "-1", "1.0000000000001", "1.2.3", "1e3"])(
    "refuses %s",
    (text) => {
      expect(parseRate(text)).toBeNull();
    },
  );
});
