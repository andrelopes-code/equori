import { describe, expect, it } from "vitest";

import {
  dateLayouts,
  distinctValues,
  markerTokens,
  numberForm,
} from "@/features/accounts/csv-shape";

describe("dateLayouts", () => {
  it.each([
    [["05/10/2026", "16/10/2026"], ["DD/MM/YYYY"]],
    [["10/05/2026", "10/16/2026"], ["MM/DD/YYYY"]],
    [
      ["05/10/2026", "06/10/2026"],
      ["DD/MM/YYYY", "MM/DD/YYYY"],
    ],
    [["2026-10-05", "2026-10-16"], ["YYYY-MM-DD"]],
    [["5.10.26", "16.10.26"], ["DD.MM.YY"]],
    [["2026-11-03 14:22:11"], ["YYYY-MM-DD"]],
    [["abc"], []],
    [["31/02/2026"], []],
  ])("reads %j as %j", (cells, expected) => {
    expect(dateLayouts(cells)).toEqual(expected);
  });
});

describe("numberForm", () => {
  it.each([
    [["-12,50", "5.000,00"], { decimal: ",", group: "." }],
    [["1,234.56"], { decimal: ".", group: "," }],
    [["1 234,56"], { decimal: ",", group: " " }],
    [["1234.5"], { decimal: ".", group: "" }],
    [["1.234"], undefined],
    [["100"], undefined],
    [["R$ 10,00 D"], { decimal: ",", group: "" }],
  ])("reads %j as %j", (cells, expected) => {
    expect(numberForm(cells)).toEqual(expected);
  });
});

describe("markerTokens", () => {
  it.each([
    // A currency written after every amount is not a mark; one letter on every line still asks.
    [["10,00 kr", "5,00 kr"], []],
    [["10,00 D", "5,00 D"], ["D"]],
    [["10,00 kr", "5,00"], ["kr"]],
    [
      ["100,00 D", "50,00 C", "20,00"],
      ["D", "C"],
    ],
    [["100,00 BRL"], []],
    [["100,00"], []],
  ])("reads %j as %j", (cells, expected) => {
    expect(markerTokens(cells)).toEqual(expected);
  });
});

describe("distinctValues", () => {
  it("returns the distinct trimmed non-blank values", () => {
    expect(distinctValues(["Débito", "Crédito", "Débito", " "])).toEqual([
      "Débito",
      "Crédito",
    ]);
  });

  it("returns an empty list above eight values", () => {
    const nine = Array.from({ length: 9 }, (_, i) => `v${String(i)}`);

    expect(distinctValues(nine)).toEqual([]);
  });
});
