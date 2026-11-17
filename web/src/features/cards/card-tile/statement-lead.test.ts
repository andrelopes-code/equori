import { describe, expect, it } from "vitest";

import type { components } from "@/api/schema.gen";
import {
  cyclePosition,
  statementLead,
} from "@/features/cards/card-tile/statement-lead";

type Statement = components["schemas"]["StatementSummary"];

const today = "2026-11-17";

describe("statementLead", () => {
  it("returns nothing without an open or an unpaid statement", () => {
    expect(statementLead(undefined, [], today)).toBeUndefined();
  });

  it("leads with the open statement when nothing is unpaid", () => {
    const current = open("2026-12-01");

    expect(statementLead(current, [], today)).toEqual({
      statement: current,
      kind: "open",
      word: "open",
      status: "neutral",
      days: 14,
    });
  });

  it.each([
    ["to pay", "2026-11-25", 95000, 95000, "due", "info", 8],
    ["due soon", "2026-11-19", 95000, 95000, "soon", "warning", 2],
    ["due today", "2026-11-17", 95000, 95000, "soon", "warning", 0],
    ["overdue", "2026-10-28", 95000, 95000, "overdue", "danger", -20],
    ["paid in part", "2026-11-26", 95000, 55000, "partial", "info", 9],
    [
      "paid in part and due soon",
      "2026-11-19",
      95000,
      55000,
      "soon",
      "warning",
      2,
    ],
  ])("%s", (_name, due, amountDue, unpaid, word, status, days) => {
    const closed = unpaidStatement(due, amountDue, unpaid);

    expect(statementLead(undefined, [closed], today)).toEqual({
      statement: closed,
      kind: "closed",
      word,
      status,
      days,
    });
  });

  it("leads with the first unpaid statement over the open one", () => {
    const first = unpaidStatement("2026-11-25", 95000, 95000);
    const second = unpaidStatement("2026-12-25", 40000, 40000);

    const lead = statementLead(open("2026-12-01"), [first, second], today);

    expect(lead?.kind).toBe("closed");
    expect(lead?.statement).toBe(first);
  });
});

describe("cyclePosition", () => {
  it.each([
    ["before closing", "2026-12-10", "2026-12-25", 12.83],
    ["at closing", "2026-11-17", "2026-11-27", 55],
    ["between closing and due", "2026-11-10", "2026-11-25", 72.27],
    ["on the due day", "2026-11-07", "2026-11-17", 92],
    ["past due", "2026-10-21", "2026-10-28", 97],
    ["before its start", "2027-03-10", "2027-03-25", 0],
  ])("%s", (_name, closing, due, expected) => {
    expect(cyclePosition(closing, due, today)).toBeCloseTo(expected, 2);
  });

  it("reads the start of a cycle closing on the 31st from a shorter month", () => {
    // start 2026-02-28, 31 days to closing, 7 elapsed on 2026-03-07
    expect(cyclePosition("2026-03-31", "2026-04-10", "2026-03-07")).toBeCloseTo(
      (55 * 7) / 31,
      2,
    );
  });
});

function open(closing: string): Statement {
  return statementOf("open", closing, closing, 0, 0);
}

function unpaidStatement(
  due: string,
  amountDue: number,
  unpaid: number,
): Statement {
  return statementOf("closed", "2026-10-21", due, amountDue, unpaid);
}

function statementOf(
  status: string,
  closing: string,
  due: string,
  amountDue: number,
  unpaid: number,
): Statement {
  return {
    id: `${status}-${due}`,
    status,
    closing_date: closing,
    due_date: due,
    amount_due: { amount: amountDue, currency: "BRL" },
    unpaid: { amount: unpaid, currency: "BRL" },
  } as Statement;
}
