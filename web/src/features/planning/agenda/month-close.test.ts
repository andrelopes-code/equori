import { describe, expect, it } from "vitest";

import type { components } from "@/api/schema.gen";
import {
  lowestPoint,
  monthClose,
  pendingGroups,
  runningBalance,
} from "@/features/planning/agenda/month-close";
import { agenda } from "@/features/planning/model/agenda";
import type { AgendaRow } from "@/features/planning/model/agenda";
import * as fixtures from "@/testing/planning-api";

type Occurrence = components["schemas"]["Occurrence"];
type Schedule = components["schemas"]["Schedule"];

// The fixtures type their enums as strings.
const rentSeptember = fixtures.rentSeptember as Occurrence;
const rentOctober = fixtures.rentOctober as Occurrence;
const salary = fixtures.salary as Occurrence;
const streaming = fixtures.streaming as Occurrence;
const schedules = fixtures.schedules as unknown as Schedule[];

const today = "2026-10-17";

// The agenda of October 2026 as the tab builds it: the overdue rent of September joins the
// current month.
function rows(
  month: readonly Occurrence[] = [rentOctober, streaming, salary],
  overdue: readonly Occurrence[] = [rentSeptember, rentOctober],
): AgendaRow[] {
  const view = agenda(month, overdue, schedules, {});
  return [...view.overdue, ...view.days.flatMap((d) => d.rows)];
}

// A move between two accounts of the owner.
const transferSchedule = {
  ...schedules[0],
  id: "e1000000-0000-4000-8000-0000000000bb",
  kind: "transfer",
} as Schedule;
const transfer: Occurrence = {
  ...rentOctober,
  id: "f1000000-0000-4000-8000-0000000000bb",
  schedule_id: transferSchedule.id,
  expected_on: "2026-10-22",
  state: "expected",
  expected_amount: { amount: 500000, currency: "BRL" },
};

function rowsWithTransfer(): AgendaRow[] {
  const view = agenda(
    [rentOctober, streaming, salary, transfer],
    [rentSeptember, rentOctober],
    [...schedules, transferSchedule],
    {},
  );

  return [...view.overdue, ...view.days.flatMap((d) => d.rows)];
}

// The transfer of 5,000.00 with the sets it moves between (planning coherence A253).
function rowsMoving(from: string, to: string): AgendaRow[] {
  const view = agenda(
    [rentOctober, streaming, salary, transfer],
    [rentSeptember, rentOctober],
    [...schedules, { ...transferSchedule, moves: { from, to } } as Schedule],
    {},
  );

  return [...view.overdue, ...view.days.flatMap((d) => d.rows)];
}

const usd: Occurrence = {
  ...salary,
  id: "f1000000-0000-4000-8000-0000000000aa",
  expected_on: "2026-10-21",
  expected_amount: { amount: 2000, currency: "USD" },
};

describe("monthClose", () => {
  it.each([
    {
      name: "pending at the expected amount, realized at the charged one",
      input: rows(),
      want: {
        inflow: 500000,
        outflow: 423990,
        inflowDone: 0,
        outflowDone: 3990,
        toPay: 420000,
        pendingCount: 3,
        close: 76010,
        leftOut: [],
      },
    },
    {
      name: "a realized occurrence counts at its actual amount",
      input: rows([
        rentOctober,
        { ...streaming, actual_amount: { amount: 4290, currency: "BRL" } },
        salary,
      ]),
      want: {
        inflow: 500000,
        outflow: 424290,
        inflowDone: 0,
        outflowDone: 4290,
        toPay: 420000,
        pendingCount: 3,
        close: 75710,
        leftOut: [],
      },
    },
    {
      name: "a skipped occurrence moves nothing",
      input: rows([rentOctober, streaming, { ...salary, state: "skipped" }]),
      want: {
        inflow: 0,
        outflow: 423990,
        inflowDone: 0,
        outflowDone: 3990,
        toPay: 420000,
        pendingCount: 2,
        close: -423990,
        leftOut: [],
      },
    },
    {
      name: "another currency stays out of the sums and is named",
      input: rows([rentOctober, streaming, salary, usd]),
      want: {
        inflow: 500000,
        outflow: 423990,
        inflowDone: 0,
        outflowDone: 3990,
        toPay: 420000,
        pendingCount: 4,
        close: 76010,
        leftOut: [{ amount: 2000, currency: "USD" }],
      },
    },
    {
      name: "a transfer between own accounts stays out of every figure",
      input: rowsWithTransfer(),
      want: {
        inflow: 500000,
        outflow: 423990,
        inflowDone: 0,
        outflowDone: 3990,
        toPay: 420000,
        pendingCount: 3,
        close: 76010,
        leftOut: [],
      },
    },
  ])("$name", ({ input, want }) => {
    expect(monthClose(input, "BRL")).toEqual({ currency: "BRL", ...want });
  });

  it.each([
    { from: "spending", to: "savings", inflow: 500000, outflow: 923990 },
    { from: "spending", to: "goals", inflow: 500000, outflow: 923990 },
    { from: "savings", to: "spending", inflow: 1000000, outflow: 423990 },
    { from: "savings", to: "goals", inflow: 500000, outflow: 423990 },
    { from: "spending", to: "spending", inflow: 500000, outflow: 423990 },
  ])(
    "a movement from $from to $to counts by the spending set",
    ({ from, to, inflow, outflow }) => {
      const close = monthClose(rowsMoving(from, to), "BRL");

      expect(close.inflow).toBe(inflow);
      expect(close.outflow).toBe(outflow);
      expect(close.close).toBe(inflow - outflow);
    },
  );
});

describe("pendingGroups", () => {
  it("splits the pending rows into overdue, the next 7 days and later", () => {
    const later = { ...salary, expected_on: "2026-10-25" };

    const now = pendingGroups(rows(), today);
    const moved = pendingGroups(rows([rentOctober, streaming, later]), today);

    expect(now.overdue.map((r) => r.occurrence.id)).toEqual([
      rentSeptember.id,
      rentOctober.id,
    ]);
    expect(now.week.map((r) => r.occurrence.id)).toEqual([salary.id]);
    expect(now.later).toEqual([]);
    expect(now.done.map((r) => r.occurrence.id)).toEqual([streaming.id]);
    expect(moved.week).toEqual([]);
    expect(moved.later.map((r) => r.occurrence.id)).toEqual([salary.id]);
  });
});

describe("runningBalance", () => {
  it("adds each day's flow, an overdue of an earlier month on day 1", () => {
    const series = runningBalance(rows(), "2026-10", "BRL");

    expect(series).toHaveLength(31);
    expect(series[0]).toEqual({ date: "2026-10-01", amount: -210000 });
    expect(series[4]).toEqual({ date: "2026-10-05", amount: -420000 });
    expect(series[11]).toEqual({ date: "2026-10-12", amount: -423990 });
    expect(series[19]).toEqual({ date: "2026-10-20", amount: 76010 });
    expect(series[30]).toEqual({ date: "2026-10-31", amount: 76010 });
    expect(lowestPoint(series)).toEqual({
      date: "2026-10-12",
      amount: -423990,
    });
  });

  it("leaves a transfer out", () => {
    const series = runningBalance(rowsWithTransfer(), "2026-10", "BRL");

    expect(series[30]).toEqual({ date: "2026-10-31", amount: 76010 });
  });

  it("counts a movement into the spending set as an inflow", () => {
    const series = runningBalance(
      rowsMoving("savings", "spending"),
      "2026-10",
      "BRL",
    );

    expect(series[30]).toEqual({ date: "2026-10-31", amount: 576010 });
  });

  it("leaves another currency out", () => {
    const series = runningBalance(
      rows([rentOctober, streaming, salary, usd]),
      "2026-10",
      "BRL",
    );

    expect(series[30]).toEqual({ date: "2026-10-31", amount: 76010 });
  });
});
