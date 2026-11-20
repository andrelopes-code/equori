import { describe, expect, it } from "vitest";

import { currencySymbol } from "@/features/assistant/view/currency-symbol";
import type { ViewPayload } from "@/features/assistant/view/view-types";

const payload = (rows: ViewPayload["rows"]["rows"]): ViewPayload => ({
  title: { key: "k" },
  window: {},
  verdict: { key: "k" },
  next: [],
  rows: { head: [], rows },
  data: {},
});

describe("currencySymbol", () => {
  it("names the currency of the first amount", () => {
    expect(
      currencySymbol(
        payload([
          [{ text: "Moradia" }, { money: { amount: 1, currency: "BRL" } }],
        ]),
        "pt-BR",
      ),
    ).toBe("R$");
  });

  it("is undefined without an amount", () => {
    expect(currencySymbol(payload([[{ bp: 10 }]]), "pt-BR")).toBeUndefined();
  });
});
