import { describe, expect, it } from "vitest";

import { rowTextOf } from "@/features/transactions/account-field/account-row-text";
import type { RowTextContext } from "@/features/transactions/account-field/account-row-text";
import type { AccountChoice } from "@/features/transactions/account-field/use-account-choices";
import { catalogPtBR } from "@/i18n/catalog.pt-BR";

const context: RowTextContext = {
  t: (key, vars) =>
    Object.entries(vars ?? {}).reduce(
      (text, [name, value]) => text.replace(`{${name}}`, String(value)),
      catalogPtBR[key],
    ),
  locale: "pt-BR",
  money: (amount) => String(amount),
};

describe("rowTextOf", () => {
  it("returns the closed note apart from the statement text", () => {
    const { fact } = rowTextOf(
      cardOf({
        kind: "statement",
        dueDate: "2026-12-17",
        closedOn: "2026-12-10",
      }),
      context,
    );

    expect(fact?.short).toBe("Fatura de 17/12");
    expect(fact?.note).toBe("fechou dia 10");
    expect(fact?.long).toBe("Fatura de 17/12 · fechou dia 10");
  });

  it("returns no note for a statement that is not closed", () => {
    const { fact } = rowTextOf(
      cardOf({ kind: "statement", dueDate: "2026-12-17", closedOn: null }),
      context,
    );

    expect(fact?.note).toBeNull();
  });
});

function cardOf(consequence: AccountChoice["consequence"]): AccountChoice {
  return {
    account: {
      id: "c1",
      name: "Nubank Mastercard",
      class: "liability",
      kind: "credit_card",
      currency: "BRL",
    },
    group: "cards",
    shape: "card",
    institution: undefined,
    logo: undefined,
    progress: undefined,
    balance: undefined,
    freeLimit: 1000,
    creditLimit: 3000,
    consequence,
    unavailable: null,
  };
}
