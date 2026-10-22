import { describe, expect, it } from "vitest";

import { previewCsv, splitCsv } from "@/features/accounts/csv-preview";

const base = {
  delimiter: "semicolon" as const,
  header_rows: 1,
  date_column: "Data",
  date_layout: "DD/MM/YYYY" as const,
  amount_column: "Valor",
  decimal_separator: "," as const,
  description_column: "Descrição",
};

describe("splitCsv", () => {
  it("keeps a quoted delimiter and doubled quotes inside a cell", () => {
    expect(splitCsv('a;"b;c";"say ""hi"""\n1;2;3\n', ";")).toEqual([
      ["a", "b;c", 'say "hi"'],
      ["1", "2", "3"],
    ]);
  });
});

describe("previewCsv", () => {
  it("reads dates, descriptions and amounts with the profile's separators", () => {
    const text =
      "Data;Descrição;Valor\n05/10/2026;Padaria;-1.234,56\n\n06/10/2026;Salário;5.000,00\n";
    expect(previewCsv(text, base, 2)).toEqual({
      headers: ["Data", "Descrição", "Valor"],
      rows: [
        {
          date: "2026-10-05",
          description: "Padaria",
          amount: -123456,
          problems: [],
        },
        {
          date: "2026-10-06",
          description: "Salário",
          amount: 500000,
          problems: [],
        },
      ],
      problem: null,
    });
  });

  it("reads a debit as money out and a credit as money in", () => {
    const text =
      "date,memo,out,in\n2026-10-05,Rent,1500.00,\n2026-10-06,Refund,,20.00\n";
    const profile = {
      delimiter: "comma" as const,
      header_rows: 1,
      date_column: "date",
      date_layout: "YYYY-MM-DD" as const,
      debit_column: "out",
      credit_column: "in",
      decimal_separator: "." as const,
      description_column: "memo",
    };
    expect(previewCsv(text, profile, 2).rows.map((r) => r.amount)).toEqual([
      -150000, 2000,
    ]);
  });

  it("flips every sign when the export lists charges as positive", () => {
    const text = "Data;Descrição;Valor\n05/10/2026;Mercado;99,90\n";
    expect(
      previewCsv(text, { ...base, amount_sign: "inverted" }, 2).rows[0]?.amount,
    ).toBe(-9990);
  });

  it("reads columns by position when the file has no header", () => {
    const text = "05/10/2026;Padaria;-10,00\n";
    const profile = {
      ...base,
      header_rows: 0,
      date_column: "1",
      description_column: "2",
      amount_column: "3",
    };
    expect(previewCsv(text, profile, 2)).toEqual({
      headers: ["1", "2", "3"],
      rows: [
        {
          date: "2026-10-05",
          description: "Padaria",
          amount: -1000,
          problems: [],
        },
      ],
      problem: null,
    });
  });

  it("marks a cell it cannot read and names a column the header lacks", () => {
    const text = "Data;Descrição;Valor\n2026-10-05;Padaria;abc\n";
    expect(previewCsv(text, base, 2).rows[0]?.problems).toEqual([
      "date",
      "amount",
    ]);
    expect(
      previewCsv(text, { ...base, amount_column: "Total" }, 2).problem,
    ).toEqual({
      field: "amount_column",
      column: "Total",
    });
  });

  it("stops at the limit", () => {
    const lines = Array.from(
      { length: 15 },
      (_, i) => `0${String((i % 9) + 1)}/10/2026;x;1,00`,
    );
    expect(
      previewCsv(`Data;Descrição;Valor\n${lines.join("\n")}`, base, 2).rows,
    ).toHaveLength(10);
  });
});
