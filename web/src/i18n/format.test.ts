import { afterEach, describe, expect, it, vi } from "vitest";

import {
  formatDate,
  formatDayHeader,
  formatDayMonth,
  formatMoney,
  formatMoneyParts,
  formatMonthName,
  formatMonthTitle,
  formatSigned,
  formatPlain,
  formatReferenceMonth,
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
    [{ amount: -5, currency: "USD" }, 2, "en", "\u2212$0.05"],
    [{ amount: -64000, currency: "BRL" }, 2, "pt-BR", "\u2212R$\u00a0640,00"],
    [{ amount: 0, currency: "BRL" }, 2, "pt-BR", "R$\u00a00,00"],
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

describe("formatReferenceMonth", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it.each([
    ["2026-11", "pt-BR", "nov. de 2026"],
    ["2026-11", "en", "Nov 2026"],
  ] as const)("formats %s in %s as %s", (month, locale, want) => {
    expect(formatReferenceMonth(month, locale)).toBe(want);
  });

  it("keeps the first month of the year west of UTC", () => {
    vi.stubEnv("TZ", "America/Sao_Paulo");
    expect(formatReferenceMonth("2026-01", "en")).toBe("Jan 2026");
  });
});

describe("formatMoney without symbol", () => {
  it.each([
    [{ amount: -64000, currency: "BRL" }, "pt-BR", "\u2212640,00"],
    [{ amount: 123456, currency: "USD" }, "en", "1,234.56"],
  ] as const)("formats %j in %s as %s", (money, locale, want) => {
    expect(formatMoney(money, 2, locale, { symbol: false })).toBe(want);
  });
});

describe("formatMoneyParts", () => {
  it.each([
    [
      { amount: -5300, currency: "BRL" },
      2,
      "pt-BR",
      { sign: "\u2212", symbol: "R$", integer: "53", fraction: ",00" },
    ],
    [
      { amount: 123456, currency: "USD" },
      2,
      "en",
      { sign: "", symbol: "$", integer: "1,234", fraction: ".56" },
    ],
    [
      { amount: 1500, currency: "JPY" },
      0,
      "en",
      { sign: "", symbol: "\u00a5", integer: "1,500", fraction: "" },
    ],
    [
      { amount: 0, currency: "BRL" },
      2,
      "pt-BR",
      { sign: "", symbol: "R$", integer: "0", fraction: ",00" },
    ],
    [
      { amount: -250, currency: "PETR4" },
      0,
      "pt-BR",
      { sign: "\u2212", symbol: "PETR4", integer: "250", fraction: "" },
    ],
  ] as const)("splits %j at scale %d in %s", (money, scale, locale, want) => {
    expect(formatMoneyParts(money, scale, locale)).toEqual(want);
  });
});

describe("short dates", () => {
  it.each([
    ["2026-10-16", "pt-BR", "16 out"],
    ["2026-10-16", "en", "Oct 16"],
  ] as const)("day and month of %s in %s", (iso, locale, want) => {
    expect(formatDayMonth(iso, locale)).toBe(want);
  });

  const words = { today: "Hoje", yesterday: "Ontem" };
  it.each([
    ["2026-10-16", "pt-BR", "Hoje"],
    ["2026-10-15", "pt-BR", "Ontem"],
    ["2026-10-14", "pt-BR", "qua, 14 out"],
    ["2026-10-14", "en", "Wed, Oct 14"],
    ["2026-09-30", "pt-BR", "qua, 30 set"],
  ] as const)("day header of %s in %s", (iso, locale, want) => {
    expect(formatDayHeader(iso, "2026-10-16", locale, words)).toBe(want);
  });
});

describe("month and signed formats", () => {
  it.each([
    ["pt-BR", "Outubro de 2026", "Outubro"],
    ["en", "October 2026", "October"],
  ] as const)("names the month in %s", (locale, title, name) => {
    expect(formatMonthTitle("2026-10", locale)).toBe(title);
    expect(formatMonthName("2026-10", locale)).toBe(name);
  });

  it("writes the sign of a change", () => {
    expect(formatSigned({ amount: 1000, currency: "BRL" }, 2, "en")).toBe(
      "+R$10.00",
    );
    expect(
      formatSigned({ amount: -1000, currency: "BRL" }, 2, "en", {
        symbol: false,
      }),
    ).toBe("\u221210.00");
    expect(formatSigned({ amount: 0, currency: "BRL" }, 2, "en")).toBe(
      "R$0.00",
    );
  });
});
