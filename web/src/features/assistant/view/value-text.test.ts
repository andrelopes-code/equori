import { describe, expect, it } from "vitest";

import { valueText } from "@/features/assistant/view/value-text";
import type { ValueFormat } from "@/features/assistant/view/value-text";

const format: ValueFormat = {
  money: (m) => `${m.currency} ${String(m.amount)}`,
  delta: (m) => `±${String(m.amount)}`,
  label: (key, count) => `${key}:${String(count)}`,
  locale: "pt-BR",
};

describe("valueText", () => {
  it("writes a share in basis points as a whole percent", () => {
    expect(valueText({ bp: 3907 }, format)).toBe("39%");
  });

  it("keeps one decimal for a share below 1%", () => {
    expect(valueText({ bp: 45 }, format)).toBe("0,5%");
  });

  it("writes zero as 0%", () => {
    expect(valueText({ bp: 0 }, format)).toBe("0%");
  });

  it("passes money to the money format", () => {
    expect(
      valueText({ money: { amount: 819105, currency: "BRL" } }, format),
    ).toBe("BRL 819105");
  });

  it("writes a count with the locale's grouping", () => {
    expect(valueText({ count: 1042 }, format)).toBe("1.042");
  });

  it("writes a date in the locale", () => {
    expect(valueText({ date: "2026-11-19" }, format)).toBe("19/11/2026");
  });

  it("reads a catalog key with its count as a label", () => {
    expect(
      valueText({ text: "assistantView.ranking.rest", count: 7 }, format),
    ).toBe("assistantView.ranking.rest:7");
  });

  it("writes plain text as given", () => {
    expect(valueText({ text: "Moradia" }, format)).toBe("Moradia");
  });
});
