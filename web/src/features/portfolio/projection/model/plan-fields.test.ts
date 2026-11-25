import { describe, expect, it } from "vitest";

import {
  draftFrom,
  fieldsFromPlan,
  planInput,
  restFields,
  startsTooEarly,
} from "@/features/portfolio/projection/model/plan-fields";
import type { PlanFields } from "@/features/portfolio/projection/model/plan-fields";
import { projectionPlan } from "@/testing/portfolio-api";

const changes = [{ month: "2026-10-01", amount: 0 }];

const typed: PlanFields = {
  withdrawalAge: "55",
  lastAge: "90",
  realReturn: "5,25",
  inflation: "4",
  mode: "income",
  income: 800000,
  rate: "",
};

describe("fieldsFromPlan", () => {
  it("writes the stored plan with the decimal separator of the locale", () => {
    expect(fieldsFromPlan(projectionPlan, "pt-BR")).toEqual({
      withdrawalAge: "60",
      lastAge: "90",
      realReturn: "4,00",
      inflation: "4,50",
      mode: "income",
      income: 500000,
      rate: "0,00",
    });
  });
});

describe("draftFrom", () => {
  it("reads percents typed with a comma or a dot into basis points", () => {
    expect(draftFrom(typed, changes, "BRL")).toEqual({
      withdrawalAge: 55,
      lastAge: 90,
      realReturnBp: 525,
      inflationBp: 400,
      withdrawal: { mode: "income", income: 800000 },
      changes,
      currency: "BRL",
    });
    expect(draftFrom({ ...typed, realReturn: "5.25" }, changes, "BRL")).toEqual(
      expect.objectContaining({ realReturnBp: 525 }),
    );
  });

  it("is null for the fields at rest", () => {
    expect(draftFrom(restFields, changes, "BRL")).toBeNull();
  });

  it.each([
    { name: "withdrawal age 17", patch: { withdrawalAge: "17" } },
    { name: "last age not above the first", patch: { lastAge: "55" } },
    { name: "last age 121", patch: { lastAge: "121" } },
    { name: "real return 30.01", patch: { realReturn: "30.01" } },
    { name: "negative inflation", patch: { inflation: "-1" } },
    { name: "income of zero", patch: { income: 0 } },
    { name: "rate of zero", patch: { mode: "rate", rate: "0" } },
    { name: "rate above 20", patch: { mode: "rate", rate: "20.01" } },
  ] as const)("is null for $name", ({ patch }) => {
    expect(draftFrom({ ...typed, ...patch }, changes, "BRL")).toBeNull();
  });

  it("holds the rate in rate mode", () => {
    const draft = draftFrom(
      { ...typed, mode: "rate", rate: "4" },
      changes,
      "BRL",
    );

    expect(draft?.withdrawal).toEqual({ mode: "rate", rate_bp: 400 });
  });
});

describe("planInput", () => {
  it("is the body of the save request", () => {
    const draft = draftFrom(typed, changes, "BRL");

    expect(draft && planInput(draft)).toEqual({
      withdrawal_age: 55,
      last_age: 90,
      real_return_bp: 525,
      inflation_bp: 400,
      withdrawal: { mode: "income", income: 800000 },
      changes,
    });
  });
});

describe("startsTooEarly", () => {
  it.each([
    { start: "32", age: 32, early: true },
    { start: "31", age: 32, early: true },
    { start: "33", age: 32, early: false },
    { start: "", age: 32, early: false },
    { start: "20", age: null, early: false },
  ])("$start at age $age is $early", ({ start, age, early }) => {
    expect(startsTooEarly({ ...typed, withdrawalAge: start }, age)).toBe(early);
  });
});
