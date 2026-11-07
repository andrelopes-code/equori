import { describe, expect, it } from "vitest";

import { catalogRows } from "@/features/instruments/catalog-rows";

const item = (code: string, type: string) =>
  ({ code, type, name: code, scale: 2 }) as never;

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
    );

    expect(rows.map((r) => r.code)).toEqual([
      "CDB1",
      "ITUB4",
      "VALE3",
      "AED",
      "BRL",
    ]);
  });
});
