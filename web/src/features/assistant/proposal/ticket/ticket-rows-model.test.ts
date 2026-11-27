import { describe, expect, it } from "vitest";

import { ticketRows } from "@/features/assistant/proposal/ticket/ticket-rows-model";

describe("ticketRows", () => {
  it("lists the exchange rate and the base amount of a trade in foreign cash", () => {
    const rows = ticketRows(
      {
        action: "record_investment.buy",
        changes: [
          { field: "amount", after: { amount: "5000.00", currency: "USD" } },
          { field: "exchange_rate", after: { text: "5.20" } },
          {
            field: "base_amount",
            after: { amount: "26005.20", currency: "BRL" },
          },
        ],
      },
      "buy",
    );

    expect(rows.map((row) => [row.label, row.value])).toEqual([
      ["assistant.ticket.gross", { amount: "5000.00", currency: "USD" }],
      ["assistant.field.exchange_rate", { text: "5.20" }],
      ["assistant.field.base_amount", { amount: "26005.20", currency: "BRL" }],
    ]);
  });
});
