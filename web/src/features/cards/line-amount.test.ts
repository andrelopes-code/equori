import { describe, expect, it } from "vitest";

import { lineAmount } from "@/features/cards/line-amount";
import type { StatementLine } from "@/features/cards/statement-groups";

function line(role: StatementLine["card_role"], amount: number): StatementLine {
  return {
    transaction_id: "tx",
    date: "2026-10-01",
    description: "line",
    card_role: role,
    amount: { amount, currency: "BRL" },
    provisional: false,
  };
}

describe("lineAmount", () => {
  it.each([
    ["S09 annual fee", line("charge", -4000), 4000, "neutral"],
    ["S12 cashback", line("credit", 1230), -1230, "positive"],
    ["payment", line("payment", 150000), -150000, "positive"],
  ] as const)("%s", (_name, input, amount, tone) => {
    expect(lineAmount(input)).toEqual({
      money: { amount, currency: "BRL" },
      tone,
    });
  });
});
