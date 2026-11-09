import { describe, expect, it } from "vitest";

import { symbolsEdit } from "@/features/instruments/symbols-edit";

describe("symbolsEdit", () => {
  const cases: {
    name: string;
    stored: Record<string, string> | undefined;
    draft: Record<string, string>;
    symbols: Record<string, string> | undefined;
    invalid: string[];
  }[] = [
    {
      name: "nothing",
      stored: undefined,
      draft: {},
      symbols: undefined,
      invalid: [],
    },
    {
      name: "new value, trimmed",
      stored: undefined,
      draft: { yahoo_chart: " PETR4.SA " },
      symbols: { yahoo_chart: "PETR4.SA" },
      invalid: [],
    },
    {
      name: "unchanged",
      stored: { yahoo_chart: "PETR4.SA" },
      draft: { yahoo_chart: "PETR4.SA" },
      symbols: undefined,
      invalid: [],
    },
    {
      name: "cleared",
      stored: { yahoo_chart: "PETR4.SA" },
      draft: { yahoo_chart: "" },
      symbols: {},
      invalid: [],
    },
    {
      name: "invalid",
      stored: undefined,
      draft: { yahoo_chart: "BRK B" },
      symbols: undefined,
      invalid: ["yahoo_chart"],
    },
  ];

  it.each(cases)("$name", ({ stored, draft, symbols, invalid }) => {
    const got = symbolsEdit(stored, draft);
    expect(got.symbols).toEqual(symbols);
    expect(got.invalid).toEqual(invalid);
  });
});
