import { describe, expect, it } from "vitest";

import { readPriceSeries } from "@/features/instruments/price-series";

interface Row {
  name: string;
  text: string;
  choice?: { dateColumn?: string; valueColumn?: string };
  columns: string[];
  dateColumn: string | null;
  valueColumn: string | null;
  prices: { date: string; value: string }[];
  skipped: { line: number; text: string }[];
}

const rows: Row[] = [
  {
    name: "semicolon file with a header and decimal commas",
    text: "Data;Fechamento\n02/01/2024;5,12\n03/01/2024;5,15\n",
    columns: ["Data", "Fechamento"],
    dateColumn: "Data",
    valueColumn: "Fechamento",
    prices: [
      { date: "2024-01-02", value: "5.12" },
      { date: "2024-01-03", value: "5.15" },
    ],
    skipped: [],
  },
  {
    name: "tab file without a header and descending dates",
    text: "2024-01-03\t1234.50\n2024-01-02\t1230.00\n",
    columns: ["1", "2"],
    dateColumn: "1",
    valueColumn: "2",
    prices: [
      { date: "2024-01-02", value: "1230" },
      { date: "2024-01-03", value: "1234.5" },
    ],
    skipped: [],
  },
  {
    name: "a chosen value column replaces the first amount column",
    text: "Date,Open,Close\n2024-01-02,10.00,10.50\n2024-01-03,10.50,10.75\n",
    choice: { valueColumn: "Close" },
    columns: ["Date", "Open", "Close"],
    dateColumn: "Date",
    valueColumn: "Close",
    prices: [
      { date: "2024-01-02", value: "10.5" },
      { date: "2024-01-03", value: "10.75" },
    ],
    skipped: [],
  },
  {
    name: "total row, zero value and repeated date are skipped",
    text: "Data;Valor\n02/01/2024;5,12\nTotal;10,24\n03/01/2024;0\n02/01/2024;5,13\n",
    columns: ["Data", "Valor"],
    dateColumn: "Data",
    valueColumn: "Valor",
    prices: [{ date: "2024-01-02", value: "5.12" }],
    skipped: [
      { line: 3, text: "Total | 10,24" },
      { line: 4, text: "03/01/2024 | 0" },
      { line: 5, text: "02/01/2024 | 5,13" },
    ],
  },
  {
    name: "text without a date column",
    text: "hello",
    columns: ["1"],
    dateColumn: null,
    valueColumn: null,
    prices: [],
    skipped: [],
  },
  {
    name: "a value with 13 decimals is skipped",
    text: "Data;Valor\n02/01/2024;€ 5,123456789012345\n",
    columns: ["Data", "Valor"],
    dateColumn: "Data",
    valueColumn: "Valor",
    prices: [],
    skipped: [{ line: 2, text: "02/01/2024 | € 5,123456789012345" }],
  },
];

describe("readPriceSeries", () => {
  it.each(rows)("$name", (row) => {
    const series = readPriceSeries(row.text, row.choice);

    expect(series).toEqual({
      columns: row.columns,
      dateColumn: row.dateColumn,
      valueColumn: row.valueColumn,
      prices: row.prices,
      skipped: row.skipped,
    });
  });
});

describe("readPriceSeries decimals", () => {
  it("keeps 12 decimals and skips 13 when the decimal is a dot", () => {
    const text =
      "Date,Close\n2024-01-02,1.123456789012\n2024-01-03,1.1234567890123\n";

    const series = readPriceSeries(text);

    expect(series.prices).toEqual([
      { date: "2024-01-02", value: "1.123456789012" },
    ]);
    expect(series.skipped).toEqual([
      { line: 3, text: "2024-01-03 | 1.1234567890123" },
    ]);
  });
});
