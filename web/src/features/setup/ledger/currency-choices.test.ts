import { describe, expect, it } from "vitest";

import { currencyChoices } from "@/features/setup/ledger/currency-choices";

const headings = { inUse: "In use", all: "All currencies" };

const instruments = [
  { code: "USD", name: "US dollar" },
  { code: "BRL", name: "Brazilian real" },
  { code: "EUR", name: "Euro" },
  { code: "XOF", name: "CFA Franc BCEAO" },
];

describe("currencyChoices", () => {
  it("names each currency in the language of the tag", () => {
    const choices = currencyChoices(instruments, "pt-BR", "USD", headings);

    expect(choices.find((c) => c.value === "BRL")?.label).toBe(
      "BRL Real brasileiro",
    );
  });

  it("falls back to the name of the record when the language has none", () => {
    const choices = currencyChoices(
      [{ code: "ZZZ", name: "Made-up unit" }],
      "en-US",
      null,
      headings,
    );

    expect(choices[0]?.label).toBe("ZZZ Made-up unit");
  });

  it("puts the currency in use first, under its own heading", () => {
    const choices = currencyChoices(instruments, "en-US", "USD", headings);

    expect(choices[0]).toMatchObject({ value: "USD", group: "In use" });
    expect(choices.slice(1).every((c) => c.group === "All currencies")).toBe(
      true,
    );
  });

  it("sorts the other currencies by their name in the language of the tag", () => {
    const choices = currencyChoices(instruments, "en-US", "USD", headings);

    expect(choices.slice(1).map((c) => c.value)).toEqual(["BRL", "EUR", "XOF"]);
  });

  it("gives each currency the flag of its country and none to a shared one", () => {
    const flags = Object.fromEntries(
      currencyChoices(instruments, "en-US", null, headings).map((c) => [
        c.value,
        c.flag,
      ]),
    );

    expect(flags).toEqual({ USD: "US", BRL: "BR", EUR: "EU", XOF: undefined });
  });
});
