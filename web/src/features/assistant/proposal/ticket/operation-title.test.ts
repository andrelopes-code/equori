import { describe, expect, it } from "vitest";

import { operationTitle } from "@/features/assistant/proposal/ticket/operation-title";
import { catalogEn } from "@/i18n/catalog.en";
import type { MessageKey } from "@/i18n/catalog.en";
import type { TFunction } from "@/i18n/i18n-provider";

const t: TFunction = (key: MessageKey, params) =>
  Object.entries(params ?? {}).reduce<string>(
    (text, [name, value]) => text.replace(`{${name}}`, String(value)),
    catalogEn[key],
  );

const order = (side: string) => ({ description: "PETR4", side });

describe("operationTitle", () => {
  it.each([
    [
      "a purchase",
      { action: "record_investment.buy", changes: [] },
      "Purchase",
    ],
    [
      "a note with one order, by its side",
      {
        action: "record_brokerage_note",
        changes: [],
        items: [order("sell")],
      },
      "Sale",
    ],
    [
      "a note with several orders",
      {
        action: "record_brokerage_note",
        changes: [],
        items: [order("buy"), order("sell")],
      },
      "Note with 2 orders",
    ],
    [
      "an income, by its type",
      {
        action: "record_investment.income",
        changes: [{ field: "income_type", after: { text: "dividend" } }],
      },
      "Dividend",
    ],
    [
      "an income of a type without a label, by its code",
      {
        action: "record_investment.income",
        changes: [{ field: "income_type", after: { text: "rent_x" } }],
      },
      "rent_x",
    ],
    [
      "a correction, by what it corrects",
      {
        action: "record_investment.correct",
        changes: [{ field: "kind", after: { text: "sell" } }],
      },
      "Correction of sale",
    ],
    [
      "any other action",
      { action: "void_transaction", changes: [] },
      catalogEn["assistant.action.void_transaction"],
    ],
  ])("names %s", (_, preview, want) => {
    expect(operationTitle(preview, t)).toBe(want);
  });
});
