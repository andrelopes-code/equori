import { describe, expect, it } from "vitest";

import { valueText } from "@/features/assistant/view/value-text";
import type { ValueFormat } from "@/features/assistant/view/value-text";

const format: ValueFormat = {
  money: (m) => `${m.currency} ${String(m.amount)}`,
  delta: (m) => `±${String(m.amount)}`,
  whole: (m) => String(m.amount),
  label: (key, count) => `${key}:${String(count)}`,
  locale: "pt-BR",
};

describe("valueText", () => {
  it("writes a share in basis points as a whole percent", () => {
    expect(valueText({ bp: 3907 }, format)).toBe("39%");
  });

  it("keeps one decimal for a share below 10%", () => {
    expect(valueText({ bp: 158 }, format)).toBe("1,6%");
  });

  it("keeps one decimal for a share below 1%", () => {
    expect(valueText({ bp: 45 }, format)).toBe("0,5%");
  });

  // Answer views design, V41: the ISO day of the week, 1 for Monday, named by the locale.
  it("names a day of the week in the locale", () => {
    const day = (count: number) => ({
      text: "assistantView.chart.weekday",
      count,
    });

    expect(valueText(day(1), format)).toBe("segunda-feira");
    expect(valueText(day(7), format)).toBe("domingo");
    expect(valueText(day(6), { ...format, locale: "en" })).toBe("Saturday");
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

  it("writes a multiple with one decimal", () => {
    expect(valueText({ times: 107098 }, format)).toBe("10,7×");
  });

  it("writes a return with one or two decimals", () => {
    expect(valueText({ rate: 1429 }, format)).toBe("14,29%");
    expect(valueText({ rate: 1380 }, format)).toBe("13,8%");
  });

  it("writes a difference of rates as points", () => {
    expect(valueText({ points: 19 }, format)).toBe(
      "assistantView.unit.points:19",
    );
  });

  it("writes a decimal in the locale with its own decimals", () => {
    expect(valueText({ decimal: "38.92" }, format)).toBe("38,92");
    expect(valueText({ decimal: "1250.5" }, format)).toBe("1.250,5");
  });

  it("names a month", () => {
    expect(valueText({ month: "2026-10" }, format)).toBe("outubro 2026");
  });

  it("writes plain text as given", () => {
    expect(valueText({ text: "Moradia" }, format)).toBe("Moradia");
  });
});
