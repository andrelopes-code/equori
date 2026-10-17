import { describe, expect, it } from "vitest";

import {
  formatDate,
  formatMoney,
  formatPlain,
  parseAmount,
  todayISO,
} from "@/i18n/format";

describe("formatPlain", () => {
  it.each([
    [123456, 2, "1234.56"],
    [-5, 2, "-0.05"],
    [7, 0, "7"],
    [123456789, 8, "1.23456789"],
  ])("formats %d at scale %d as %s", (minor, scale, want) => {
    expect(formatPlain(minor, scale)).toBe(want);
  });
});

describe("formatMoney", () => {
  it.each([
    [{ amount: 123456, currency: "BRL" }, 2, "pt-BR", "R$ 1.234,56"],
    [{ amount: 123456, currency: "BRL" }, 2, "en", "R$1,234.56"],
    [{ amount: -5, currency: "USD" }, 2, "en", "-$0.05"],
  ] as const)("formats %j at scale %d in %s", (money, scale, locale, want) => {
    expect(formatMoney(money, scale, locale)).toBe(want);
  });

  it("appends the code when Intl rejects the currency", () => {
    expect(formatMoney({ amount: 123456, currency: "PETR4" }, 2, "en")).toBe(
      "1,234.56 PETR4",
    );
  });
});

describe("parseAmount", () => {
  it.each([
    ["1.234,56", 2, "pt-BR", 123456],
    ["1,234.56", 2, "en", 123456],
    ["0,1", 2, "pt-BR", 10],
    ["12", 2, "en", 1200],
    ["-3.5", 2, "en", -350],
    ["1,234", 2, "pt-BR", null],
    ["12a", 2, "en", null],
    ["99999999999999999", 2, "en", null],
    ["12,34", 2, "en", null],
    ["12.34", 2, "pt-BR", null],
    ["1,2.3", 2, "pt-BR", null],
    ["1.2,3", 2, "en", null],
    ["1,234,567.89", 2, "en", 123456789],
    ["1.234", 2, "en", null],
    ["12", 0, "en", 12],
    ["12.5", 0, "en", null],
  ] as const)(
    "parses %j at scale %d in %s as %s",
    (text, scale, locale, want) => {
      expect(parseAmount(text, scale, locale)).toBe(want);
    },
  );
});

describe("parseAmount negative zero", () => {
  it("returns 0, not -0", () => {
    expect(Object.is(parseAmount("-0", 2, "en"), 0)).toBe(true);
  });
});

describe("formatDate", () => {
  it.each([
    ["2026-10-17", "pt-BR", "17/10/2026"],
    ["2026-10-17", "en", "10/17/2026"],
  ] as const)("formats %s in %s as %s", (iso, locale, want) => {
    expect(formatDate(iso, locale)).toBe(want);
  });
});

describe("todayISO", () => {
  it("formats the local calendar date", () => {
    expect(todayISO(new Date(2026, 9, 7, 23, 59))).toBe("2026-10-07");
  });
});
