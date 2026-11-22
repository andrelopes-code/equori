import { describe, expect, it } from "vitest";

import {
  meterFraction,
  statusLine,
  type StatusRow,
} from "@/features/transactions/reimbursement/reimbursement-status";

describe("statusLine", () => {
  it.each<{
    name: string;
    rows: StatusRow[];
    leftover: number;
    error: string | null;
    want: ReturnType<typeof statusLine>;
  }>([
    {
      name: "nothing checked",
      rows: [
        { description: "Dinner", checked: false, amount: 0, remaining: 5000 },
      ],
      leftover: 13200,
      error: null,
      want: { tone: "muted", kind: "none" },
    },
    {
      name: "two checked",
      rows: [
        { description: "Dinner", checked: true, amount: 5000, remaining: 5000 },
        { description: "Coffee", checked: true, amount: 1000, remaining: 1960 },
        { description: "Bakery", checked: false, amount: 0, remaining: 1139 },
      ],
      leftover: 7200,
      error: null,
      want: { tone: "muted", kind: "count", count: 2 },
    },
    {
      name: "a zero share names its expense",
      rows: [
        {
          description: "Dinner",
          checked: true,
          amount: 13200,
          remaining: 26400,
        },
        { description: "Coffee", checked: true, amount: 0, remaining: 1960 },
      ],
      leftover: 0,
      error: null,
      want: { tone: "danger", kind: "zero", description: "Coffee" },
    },
    {
      name: "a share above what is left names its expense",
      rows: [
        { description: "Coffee", checked: true, amount: 2000, remaining: 1960 },
      ],
      leftover: 11200,
      error: null,
      want: { tone: "danger", kind: "above", description: "Coffee" },
    },
    {
      name: "an excess over the inflow",
      rows: [
        {
          description: "Dinner",
          checked: true,
          amount: 13200,
          remaining: 26400,
        },
        { description: "Pix", checked: true, amount: 8000, remaining: 8000 },
      ],
      leftover: -8000,
      error: null,
      want: { tone: "danger", kind: "over" },
    },
    {
      name: "the submit error comes first",
      rows: [
        { description: "Coffee", checked: true, amount: 0, remaining: 1960 },
      ],
      leftover: 13200,
      error: "The transaction changed",
      want: { tone: "danger", kind: "error", text: "The transaction changed" },
    },
  ])("$name", ({ rows, leftover, error, want }) => {
    const got = statusLine(rows, leftover, error);

    expect(got).toEqual(want);
  });
});

describe("meterFraction", () => {
  it.each([
    { allocated: 0, inflow: 13200, want: 0 },
    { allocated: 6600, inflow: 13200, want: 0.5 },
    { allocated: 21200, inflow: 13200, want: 1 },
    { allocated: 0, inflow: 0, want: 0 },
  ])("$allocated of $inflow", ({ allocated, inflow, want }) => {
    const got = meterFraction(allocated, inflow);

    expect(got).toBe(want);
  });
});
