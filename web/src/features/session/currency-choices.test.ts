import { describe, expect, it } from "vitest";

import { currencyChoices } from "@/features/session/currency-choices";

describe("currencyChoices", () => {
  it("starts with the default choice, whose value is empty", () => {
    const choices = currencyChoices("en", "Region default");

    expect(choices[0]).toEqual({ value: "", label: "Region default" });
  });

  it("names each currency by its code and its name in the language", () => {
    const choices = currencyChoices("pt-BR", "Padrão da região");

    expect(choices).toContainEqual({
      value: "BRL",
      label: "BRL Real brasileiro",
    });
    expect(choices).toContainEqual({ value: "EUR", label: "EUR Euro" });
  });

  it("lists every currency the runtime knows once", () => {
    const choices = currencyChoices("en", "Region default");

    expect(choices).toHaveLength(1 + Intl.supportedValuesOf("currency").length);
  });
});
