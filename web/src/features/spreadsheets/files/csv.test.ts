import { describe, expect, it } from "vitest";

import {
  detectDelimiter,
  fieldValue,
  formatCsv,
  parseCsv,
} from "@/features/spreadsheets/files/csv";

describe("parseCsv", () => {
  it.each([
    [
      "a,b\n1,2\n",
      [
        ["a", "b"],
        ["1", "2"],
      ],
    ],
    [
      "a;b\r\n1,5;2",
      [
        ["a", "b"],
        ["1,5", "2"],
      ],
    ],
    ["a\tb\n", [["a", "b"]]],
    ['"x, y","say ""hi"""\n', [["x, y", 'say "hi"']]],
    ['"two\nlines",b\n', [["two\nlines", "b"]]],
    ["\uFEFFa,b", [["a", "b"]]],
    [
      "a,,c\n,\n",
      [
        ["a", "", "c"],
        ["", ""],
      ],
    ],
    ["", []],
  ])("reads %j", (text, rows) => {
    expect(parseCsv(text)).toEqual(rows);
  });
});

describe("detectDelimiter", () => {
  it.each([
    ["a,b;c,d", ","],
    ['"a,b,c";d;e', ";"],
    ["one", ","],
    ["a;b\nc,d,e,f", ";"],
  ])("finds the delimiter of %j", (text, delimiter) => {
    expect(detectDelimiter(text)).toBe(delimiter);
  });
});

describe("fieldValue", () => {
  it.each([
    ["12", ",", 12],
    ["-3.5", ",", -3.5],
    ["1,5", ";", 1.5],
    ["1.234,56", ";", 1234.56],
    ["1,5", ",", "1,5"],
    ["1.234.56", ";", "1.234.56"],
    ["007", ",", "007"],
    ["0.5", ",", 0.5],
    ["23/11/2026", ";", "23/11/2026"],
    [" x ", ",", " x "],
    ["", ",", ""],
  ] as const)("reads %j under %j as %j", (field, delimiter, value) => {
    expect(fieldValue(field, delimiter)).toBe(value);
  });
});

describe("formatCsv", () => {
  it("quotes what would break a row and writes an empty field for no value", () => {
    expect(
      formatCsv([
        ["a", 'say "hi"', "x,y"],
        [1.5, null, true],
        ["two\nlines", undefined, ""],
      ]),
    ).toBe('a,"say ""hi""","x,y"\r\n1.5,,true\r\n"two\nlines",,');
  });

  it("round-trips through parseCsv with a semicolon", () => {
    const rows = [
      ["Descrição", "Valor"],
      ["Aluguel; casa", "1.500,00"],
    ];

    expect(parseCsv(formatCsv(rows, ";"))).toEqual(rows);
  });
});
