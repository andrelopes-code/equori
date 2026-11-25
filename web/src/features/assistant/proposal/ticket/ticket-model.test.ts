import { describe, expect, it } from "vitest";

import type { components } from "@/api/schema.gen";
import { ticketOf } from "@/features/assistant/proposal/ticket/ticket-model";

type Preview = components["schemas"]["AssistantPreview"];
type Value = components["schemas"]["AssistantValue"];

const brl = (amount: string): Value => ({ amount, currency: "BRL" });
const text = (value: string): Value => ({ text: value });
const day = (date: string): Value => ({ date });

const buy: Preview = {
  action: "record_investment.buy",
  target: "XP",
  changes: [
    { field: "instrument", after: text("MUND11") },
    { field: "quantity", after: text("2") },
    { field: "price", after: text("105.47") },
    { field: "fees", after: brl("0.05") },
    { field: "amount", after: brl("210.94") },
    { field: "net", after: brl("-210.99") },
    { field: "account", after: text("Banco Inter") },
    { field: "date", after: day("2026-11-25") },
    { field: "settlement", after: day("2026-11-27") },
  ],
};

const order = (side: string, code: string, gross: string, date?: string) => ({
  description: code,
  side,
  quantity: text("10"),
  price: text("1"),
  amount: brl(gross),
  ...(date !== undefined && { date }),
});

const labels = (preview: Preview) =>
  ticketOf(preview).rows.map((row) => [
    row.label,
    row.value?.amount ?? row.value?.text ?? row.words,
    row.minus,
  ]);

describe("ticketOf", () => {
  it("draws a purchase as its figure, its parts, the net and two dates", () => {
    const ticket = ticketOf(buy);

    expect(ticket.hero).toEqual({
      figure: { kind: "quantity", value: text("2") },
      code: "MUND11",
      price: { value: brl("105.47") },
    });
    expect(labels(buy)).toEqual([
      ["assistant.ticket.gross", "210.94", false],
      ["assistant.field.fees", "0.05", false],
    ]);
    expect(ticket.net).toEqual({
      value: brl("210.99"),
      leaves: true,
      account: "Banco Inter",
    });
    expect(ticket.dates.map((d) => [d.label, d.date])).toEqual([
      ["assistant.ticket.date.trade", "2026-11-25"],
      ["assistant.ticket.date.settlement", "2026-11-27"],
    ]);
    expect(ticket.rest).toEqual([]);
  });

  it("leaves the gross out when it is the net", () => {
    const changes = buy.changes
      .filter((c) => c.field !== "fees")
      .map((c) => (c.field === "net" ? { ...c, after: brl("-210.94") } : c));

    expect(ticketOf({ ...buy, changes }).rows).toEqual([]);
  });

  it("writes one date when the trade settles on its day", () => {
    const changes = buy.changes.map((c) =>
      c.field === "settlement" ? { ...c, after: day("2026-11-25") } : c,
    );

    expect(ticketOf({ ...buy, changes }).dates).toEqual([
      { label: "assistant.ticket.date.same", date: "2026-11-25" },
    ]);
  });

  it("takes the costs of a sale from its gross", () => {
    const sale: Preview = {
      ...buy,
      action: "record_investment.sell",
      changes: buy.changes.map((c) =>
        c.field === "net" ? { ...c, after: brl("210.89") } : c,
      ),
    };

    expect(labels(sale)).toEqual([
      ["assistant.ticket.gross", "210.94", false],
      ["assistant.field.fees", "0.05", true],
    ]);
    expect(ticketOf(sale).net?.leaves).toBe(false);
  });

  it("draws a note with one order as that order", () => {
    const note: Preview = {
      action: "record_brokerage_note",
      target: "XP",
      changes: buy.changes.filter((c) =>
        ["fees", "net", "account", "date", "settlement"].includes(c.field),
      ),
      items: [
        {
          ...order("buy", "MUND11", "210.94"),
          quantity: text("2"),
          price: text("105.47"),
        },
      ],
    };
    const ticket = ticketOf(note);

    expect(ticket.orders).toEqual([]);
    expect(ticket.hero).toEqual(ticketOf(buy).hero);
    expect(labels(note)).toEqual(labels(buy));
  });

  it("totals the sales and the purchases of a note", () => {
    const note: Preview = {
      action: "record_brokerage_note",
      changes: [
        { field: "fees", after: brl("0.97") },
        { field: "taxes", after: brl("0.09") },
        { field: "net", after: brl("708.24") },
      ],
      items: [
        order("buy", "ITSA4", "1102.00"),
        order("buy", "MXRF11", "98.70"),
        order("sell", "PETR4", "1910.00"),
      ],
    };

    expect(ticketOf(note).orders).toHaveLength(3);
    expect(labels(note)).toEqual([
      ["assistant.ticket.sales", "1910.00", false],
      ["assistant.ticket.purchases", "1200.70", true],
      ["assistant.field.fees", "0.97", true],
      ["assistant.field.taxes", "0.09", true],
    ]);
  });

  it("leaves the total of a note of purchases out when it is the net", () => {
    const note: Preview = {
      action: "record_brokerage_note",
      changes: [{ field: "net", after: brl("-30.00") }],
      items: [order("buy", "A", "10.00"), order("buy", "B", "20.00")],
    };

    expect(ticketOf(note).rows).toEqual([]);
  });

  it("draws an income as its code and one payment date", () => {
    const income: Preview = {
      action: "record_investment.income",
      changes: [
        { field: "instrument", after: text("ITSA4") },
        { field: "amount", after: brl("184.20") },
        { field: "withheld", after: brl("27.63") },
        { field: "net", after: brl("156.57") },
        { field: "income_type", after: text("jcp") },
        { field: "date", after: day("2026-11-23") },
      ],
    };
    const ticket = ticketOf(income);

    expect(ticket.hero).toEqual({ figure: { kind: "code", value: "ITSA4" } });
    expect(labels(income)).toEqual([
      ["assistant.ticket.gross", "184.20", false],
      ["assistant.field.withheld", "27.63", true],
    ]);
    expect(ticket.dates).toEqual([
      { label: "assistant.ticket.date.payment", date: "2026-11-23" },
    ]);
    expect(ticket.rest).toEqual([]);
  });

  it("writes the gross and a cost of zero without a minus", () => {
    expect(
      labels({
        action: "record_investment.income",
        changes: [
          { field: "amount", after: brl("10.00") },
          { field: "withheld", after: brl("0.00") },
          { field: "net", after: brl("10.00") },
        ],
      }),
    ).toEqual([
      ["assistant.ticket.gross", "10.00", false],
      ["assistant.field.withheld", "0.00", false],
    ]);
  });

  it("draws a contract as its rate, from the application to the maturity", () => {
    const ticket = ticketOf({
      action: "record_fixed_income",
      target: "CDB Banco Inter",
      changes: [
        { field: "amount", after: brl("10000.00") },
        { field: "net", after: brl("-10000.00") },
        { field: "date", after: day("2026-11-25") },
        { field: "institution", after: text("Inter Investimentos") },
        { field: "rate", after: text("110") },
        { field: "index", after: text("cdi") },
        { field: "maturity", after: day("2028-11-20") },
      ],
    });

    expect(ticket.hero).toEqual({
      figure: { kind: "rate", rate: "110", index: "cdi" },
      name: "CDB Banco Inter",
    });
    expect(ticket.dates.map((d) => d.label)).toEqual([
      "assistant.ticket.date.application",
      "assistant.ticket.date.maturity",
    ]);
    expect(ticket.rest).toEqual([]);
  });

  it("draws a custody transfer from one brokerage to the other", () => {
    const custody: Preview = {
      action: "transfer_custody",
      target: "Clear ITSA4",
      changes: [
        { field: "account", before: text("Clear"), after: text("XP") },
        { field: "quantity", after: text("200") },
        { field: "instrument", after: text("ITSA4") },
        { field: "date", after: day("2026-11-25") },
      ],
    };

    expect(ticketOf(custody).hero?.code).toBe("ITSA4");
    expect(labels(custody)).toEqual([
      ["assistant.ticket.from", "Clear", false],
      ["assistant.ticket.to", "XP", false],
      ["assistant.ticket.cost", "assistant.ticket.cost.follows", false],
    ]);
  });

  it("draws a split as its ratio and a conversion as both codes", () => {
    const ratio = { field: "ratio", after: text("1 : 2") };

    expect(
      ticketOf({
        action: "record_corporate_action.split",
        changes: [ratio, { field: "instrument", after: text("WEGE3") }],
      }).hero,
    ).toEqual({
      figure: { kind: "ratio", from: "1", to: "2" },
      code: "WEGE3",
    });
    expect(
      ticketOf({
        action: "record_corporate_action.conversion",
        changes: [
          ratio,
          { field: "instrument", before: text("OLD3"), after: text("NEW3") },
        ],
      }).hero,
    ).toEqual({
      figure: { kind: "ratio", from: "1", to: "2" },
      codeBefore: "OLD3",
      code: "NEW3",
    });
  });

  it("keeps the value before of what a correction changes", () => {
    const ticket = ticketOf({
      ...buy,
      action: "record_investment.correct",
      changes: [
        { field: "reason", after: text("3 units") },
        { field: "kind", after: text("buy") },
        ...buy.changes.map((c) =>
          c.field === "quantity" ? { ...c, before: text("3") } : c,
        ),
      ],
    });

    expect(ticket.hero?.figure).toEqual({
      kind: "quantity",
      value: text("2"),
      was: text("3"),
    });
    expect(ticket.reason).toBe("3 units");
    expect(ticket.rest).toEqual([]);
  });

  it("leaves a change it has no place for as a field row", () => {
    const tags = { field: "tags", after: text("long term") };

    expect(ticketOf({ ...buy, changes: [...buy.changes, tags] }).rest).toEqual([
      tags,
    ]);
  });
});
