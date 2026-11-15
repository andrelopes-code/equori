import { describe, expect, it } from "vitest";

import type { components } from "@/api/schema.gen";
import {
  dayMarks,
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
  ])("$name", ({ input, want }) => {
    expect(monthClose(input, "BRL")).toEqual({ currency: "BRL", ...want });
  });
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

  it("leaves another currency out", () => {
    const series = runningBalance(
      rows([rentOctober, streaming, salary, usd]),
      "2026-10",
      "BRL",
    );

    expect(series[30]).toEqual({ date: "2026-10-31", amount: 76010 });
  });
});

describe("dayMarks", () => {
  it("marks each day of the month by its most pressing state", () => {
    const marks = dayMarks(rows(), "2026-10");

    expect([...marks]).toEqual([
      ["2026-10-05", { count: 1, tone: "danger" }],
      ["2026-10-12", { count: 1, tone: "success" }],
      ["2026-10-20", { count: 1, tone: "accent" }],
    ]);
  });
});
