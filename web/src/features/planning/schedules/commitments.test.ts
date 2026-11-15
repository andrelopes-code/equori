import { describe, expect, it } from "vitest";

import type { components } from "@/api/schema.gen";
import {
  balanceColumns,
  commitments,
} from "@/features/planning/schedules/commitments";
import * as fixtures from "@/testing/planning-api";

type Schedule = components["schemas"]["Schedule"];

const today = "2026-10-17";
// The fixtures type their enums as strings.
const base = fixtures.schedules as unknown as Schedule[];
const salary = fixtures.salarySchedule as unknown as Schedule;
const rent = fixtures.rent as unknown as Schedule;
const streaming = fixtures.streamingSchedule as unknown as Schedule;
const salaryTerms = first(salary.terms);

function monthly(
  id: string,
  kind: Schedule["kind"],
  amount: number,
  currency = "BRL",
) {
  return {
    ...salary,
    id,
    kind,
    terms: [
      {
        ...salaryTerms,
        amount: { amount, currency },
      },
    ],
  } satisfies Schedule;
}

describe("commitments", () => {
  it.each([
    {
      name: "rent, salary and streaming",
      input: base,
      want: {
        income: 500000,
        bills: 210000,
        subscriptions: 3990,
        savings: 0,
        free: 286010,
        shareBp: 4280,
        counts: { income: 1, billsAndSubscriptions: 2, savings: 0 },
        leftOut: [],
      },
    },
    {
      name: "a saving takes from the free amount, a transfer does not",
      input: [
        ...base,
        monthly("s1", "savings", 30000),
        monthly("t1", "transfer", 50000),
      ],
      want: {
        income: 500000,
        bills: 210000,
        subscriptions: 3990,
        savings: 30000,
        free: 256010,
        shareBp: 4280,
        counts: { income: 1, billsAndSubscriptions: 2, savings: 1 },
        leftOut: [],
      },
    },
    {
      name: "another currency is named, never added",
      input: [...base, monthly("u1", "subscription", 2000, "USD")],
      want: {
        income: 500000,
        bills: 210000,
        subscriptions: 3990,
        savings: 0,
        free: 286010,
        shareBp: 4280,
        counts: { income: 1, billsAndSubscriptions: 2, savings: 0 },
        leftOut: [{ amount: 2000, currency: "USD" }],
      },
    },
    {
      name: "commitments above the income leave a negative free amount",
      input: [rent, streaming, monthly("i1", "income", 100000)],
      want: {
        income: 100000,
        bills: 210000,
        subscriptions: 3990,
        savings: 0,
        free: -113990,
        shareBp: 21399,
        counts: { income: 1, billsAndSubscriptions: 2, savings: 0 },
        leftOut: [],
      },
    },
    {
      name: "no income: no share",
      input: [rent, streaming],
      want: {
        income: 0,
        bills: 210000,
        subscriptions: 3990,
        savings: 0,
        free: -213990,
        shareBp: undefined,
        counts: { income: 0, billsAndSubscriptions: 2, savings: 0 },
        leftOut: [],
      },
    },
    {
      name: "an ended schedule commits nothing",
      input: [
        ...base,
        { ...monthly("e1", "bill", 99900), ends_on: "2026-09-01" },
      ],
      want: {
        income: 500000,
        bills: 210000,
        subscriptions: 3990,
        savings: 0,
        free: 286010,
        shareBp: 4280,
        counts: { income: 1, billsAndSubscriptions: 2, savings: 0 },
        leftOut: [],
      },
    },
  ])("$name", ({ input, want }) => {
    expect(commitments(input, today, "BRL")).toEqual({
      currency: "BRL",
      ...want,
    });
  });
});

describe("balanceColumns", () => {
  it.each([
    { sizes: [7, 10, 4, 4, 1], want: [0, 1, 0, 1, 0] },
    { sizes: [3], want: [0] },
    { sizes: [], want: [] },
    { sizes: [2, 2, 2], want: [0, 1, 0] },
  ])("places $sizes in $want", ({ sizes, want }) => {
    expect(balanceColumns(sizes)).toEqual(want);
  });
});

function first<T>(items: readonly T[]): T {
  const [item] = items;
  if (item === undefined) throw new Error("no item");

  return item;
}
