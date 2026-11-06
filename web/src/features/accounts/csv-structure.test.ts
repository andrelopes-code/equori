import { describe, expect, it } from "vitest";

import {
  detectStructure,
  isAmountShaped,
  isDateShaped,
} from "@/features/accounts/csv-structure";

describe("detectStructure", () => {
  it.each([
    ["Data;Valor\n05/10/2026;1,00\n", "semicolon", 1, 0],
    [
      'Data,Valor,Hist\n05/10/2026,"1,00",x\n06/10/2026,"2,00",y\n',
      "comma",
      1,
      0,
    ],
    [
      "Banco X\nConta: 12\n\nData;Hist;Valor\n05/10/2026;x;1,00\nTotal;;1,00\n",
      "semicolon",
      3,
      1,
    ],
    ["05/10/2026\tx\t1.00\n06/10/2026\ty\t2.00\n", "tab", 0, 0],
    [
      "Banco\n05/10/2026;x;1,00\n06/10/2026;y;2,00\n",
      "semicolon",
      undefined,
      0,
    ],
    ["a,b,c\n1,2,3\n", "comma", 1, 0],
    [
      "Data;Hist;Valor\n05/10/2026;x;1,00\nSaldo\nTotal geral\n",
      "semicolon",
      1,
      2,
    ],
  ] as const)(
    "reads the structure of %j",
    (text, delimiter, headerRows, footerRows) => {
      const found = detectStructure(text);

      expect(found.delimiter).toBe(delimiter);
      expect(found.headerRows).toBe(headerRows);
      expect(found.footerRows).toBe(footerRows);
    },
  );

  it("returns the non-blank rows split by the delimiter", () => {
    const found = detectStructure("Banco\n\nData;Valor\n05/10/2026;1,00\n");

    expect(found.rows).toEqual([
      ["Banco"],
      ["Data", "Valor"],
      ["05/10/2026", "1,00"],
    ]);
  });
});

describe("isDateShaped", () => {
  it.each([
    ["05/10/2026", true],
    ["2026-10-05 14:22:11", true],
    ["5.10.26", true],
    ["Data", false],
    ["1,00", false],
  ])("reads %j as %s", (cell, expected) => {
    expect(isDateShaped(cell)).toBe(expected);
  });
});

describe("isAmountShaped", () => {
  it.each([
    ["1,00", true],
    ["-12,50", true],
    ["(1.234,00)", true],
    ["1 234,56", true],
    ["10,00 D", true],
    ["100,00 BRL", true],
    ["10,00 a b", true],
    ["10,00 a b c", false],
    ["Conta: 12", false],
    ["Data", false],
    ["", false],
  ])("reads %j as %s", (cell, expected) => {
    expect(isAmountShaped(cell)).toBe(expected);
  });
});
