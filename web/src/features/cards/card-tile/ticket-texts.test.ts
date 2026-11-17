import { describe, expect, it } from "vitest";

import type { StatementLeadResult } from "@/features/cards/card-tile/statement-lead";
import { cycleKeys, ticketKeys } from "@/features/cards/card-tile/ticket-texts";

function lead(
  kind: "closed" | "open",
  word: StatementLeadResult["word"],
  days: number,
): StatementLeadResult {
  return {
    statement: {} as StatementLeadResult["statement"],
    kind,
    word,
    status: "neutral",
    days,
  };
}

describe("ticketKeys", () => {
  it.each([
    [
      "no lead",
      undefined,
      "cards.ticket.openName",
      "cards.ticket.word.none",
      undefined,
    ],
    [
      "open",
      lead("open", "open", 14),
      "cards.ticket.openName",
      "cards.ticket.word.open",
      "cards.ticket.closes",
    ],
    [
      "closed ahead",
      lead("closed", "due", 8),
      "cards.stub.name",
      "cards.ticket.word.due",
      "cards.stub.due",
    ],
    [
      "closed due today",
      lead("closed", "soon", 0),
      "cards.stub.name",
      "cards.ticket.word.soon",
      "cards.stub.due",
    ],
    [
      "closed past due",
      lead("closed", "overdue", -2),
      "cards.stub.name",
      "cards.ticket.word.overdue",
      "cards.stub.overdue",
    ],
  ] as const)("names %s", (_, input, name, word, time) => {
    expect(ticketKeys(input)).toEqual({ name, word, time });
  });
});

describe("cycleKeys", () => {
  it.each([
    ["2026-11-10", "2026-11-17", "2026-11-09", "closing", "dueOn"],
    ["2026-11-10", "2026-11-17", "2026-11-10", "closing", "dueOn"],
    ["2026-11-10", "2026-11-17", "2026-11-11", "closed", "dueOn"],
    ["2026-11-10", "2026-11-17", "2026-11-17", "closed", "dueOn"],
    ["2026-11-10", "2026-11-17", "2026-11-18", "closed", "wasDue"],
  ])("labels %s and %s on %s", (closing, due, today, c, d) => {
    expect(cycleKeys(closing, due, today)).toEqual({
      closing: `cards.ticket.${c}`,
      due: `cards.ticket.${d}`,
    });
  });
});
