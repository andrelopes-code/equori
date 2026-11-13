import { describe, expect, it } from "vitest";

import type { components } from "@/api/schema.gen";
import { catalogRows } from "@/features/instruments/model/catalog-rows";

type Quote = components["schemas"]["InstrumentQuote"];

const item = (code: string, type: string) =>
  ({ code, type, name: code, scale: 2 }) as never;

const noReferences = {
  week: null,
  month: null,
  quarter: null,
  year: null,
  year_to_date: null,
};

describe("catalogRows", () => {
  it("PC20: lists securities first, by type then code, and the currencies last", () => {
    const rows = catalogRows(
      [
        item("AED", "currency"),
        item("VALE3", "stock"),
        item("CDB1", "fixed_income"),
        item("BRL", "currency"),
        item("ITUB4", "stock"),
      ],
      "BRL",
      [],
    );

    expect(rows.map((r) => r.code)).toEqual([
      "CDB1",
      "ITUB4",
      "VALE3",
      "AED",
      "BRL",
    ]);
  });

  it("IQ6: joins the last price and the change in basis points of each period", () => {
    const quote: Quote = {
      instrument: "VALE3",
      quote_instrument: "BRL",
      last: { date: "2026-10-16", value: "110" },
      trend: [null, "100", "105.5", "110"],
      references: {
        week: { date: "2026-10-09", value: "100" },
        month: { date: "2026-09-16", value: "200" },
        quarter: { date: "2026-07-16", value: "110" },
        year: { date: "2025-10-16", value: "88" },
        year_to_date: null,
      },
    };

    const [row] = catalogRows([item("VALE3", "stock")], "BRL", [quote]);

    expect(row).toMatchObject({
      lastValue: "110",
      lastDate: "2026-10-16",
      week: 1000,
      month: -4500,
      quarter: 0,
      year: 2500,
      yearToDate: null,
      trend: [null, 100, 105.5, 110],
    });
  });

  it("IQ8: a row without a quote, or without a price, has an empty date and null changes", () => {
    const empty: Quote = {
      instrument: "CDB1",
      quote_instrument: "BRL",
      last: null,
      trend: [],
      references: noReferences,
    };

    const rows = catalogRows(
      [item("CDB1", "fixed_income"), item("ITUB4", "stock")],
      "BRL",
      [empty],
    );

    for (const row of rows) {
      expect(row).toMatchObject({
        lastValue: "",
        lastDate: "",
        week: null,
        month: null,
        quarter: null,
        year: null,
        yearToDate: null,
        trend: [],
      });
    }
  });
});
