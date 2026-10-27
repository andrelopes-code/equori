import { describe, expect, it } from "vitest";

import { decodeDebts, encodeDebts } from "@/features/calculators/debt-rows";
import { validateCalculatorSearch } from "@/features/calculators/calculator-search";

const rows = [
  {
    name: "Visa",
    balance: "100000",
    rate: "3",
    minimum: "5000",
    account: "a1",
  },
  { name: "Car", balance: "300000", rate: "", minimum: "", account: undefined },
];

describe("debt rows in the address", () => {
  it("round-trips the rows", () => {
    expect(decodeDebts(encodeDebts(rows))).toEqual(rows);
  });

  it("drops the separators from a name", () => {
    const text = encodeDebts([
      { ...rows[1], name: "A~B;C" } as (typeof rows)[1],
    ]);
    expect(decodeDebts(text)?.[0]?.name).toBe("ABC");
  });

  it("drops every row of an invalid value", () => {
    expect(decodeDebts("Visa~abc~3~5000")).toBeNull();
    expect(decodeDebts("only-a-name")).toBeNull();
    expect(decodeDebts(Array(21).fill("x~1~1~1").join(";"))).toBeNull();
  });

  it("keeps a long debts value in the search", () => {
    const debts = Array(10).fill("A name~100000~1.5~5000").join(";");
    expect(validateCalculatorSearch({ debts })).toEqual({ debts });
  });
});
