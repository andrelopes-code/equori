import { describe, expect, it } from "vitest";

import type { components } from "@/api/schema.gen";
import { draftFromSchedule } from "@/features/planning/draft-from-schedule";

type Schedule = components["schemas"]["Schedule"];
type ScheduleTerms = components["schemas"]["ScheduleTerms"];

const today = "2026-10-17";
const counterpartID = "e2000000-0000-4000-8000-000000000001";
const payeeID = "e2000000-0000-4000-8000-000000000002";

function terms(
  from: string,
  amount: number,
  recurrence: Partial<ScheduleTerms["recurrence"]> = {},
): ScheduleTerms {
  return {
    effective_from: from,
    amount: { amount, currency: "BRL" },
    recurrence: {
      frequency: "monthly",
      interval: 1,
      adjustment: "none",
      business_day_ordinal: 5,
      start: "2026-01-01",
      ...recurrence,
    },
  };
}

function salary(patch: Partial<Schedule> = {}): Schedule {
  return {
    id: "e1000000-0000-4000-8000-000000000002",
    kind: "income",
    account_id: "e2000000-0000-4000-8000-000000000003",
    counterpart_id: counterpartID,
    description: "Salary",
    calendar: "br_banking",
    match_tolerance_bp: 500,
    grace_days: 2,
    match_window_days: 14,
    terms: [terms("2026-01-01", 500000)],
    pauses: [],
    ...patch,
  };
}

describe("draftFromSchedule", () => {
  it("copies the schedule and leaves the account empty", () => {
    expect(draftFromSchedule(salary(), "2026-11-05", today)).toMatchObject({
      kind: "income",
      accountID: null,
      counterpartID,
      payeeID: null,
      description: "Salary",
      amount: 500000,
      calendar: "br_banking",
      toleranceBP: 500,
      graceDays: 2,
      windowDays: 14,
    });
  });

  it("starts the rule on the next expected date and keeps its selector", () => {
    expect(draftFromSchedule(salary(), "2026-11-05", today).recurrence).toEqual(
      {
        frequency: "monthly",
        interval: 1,
        adjustment: "none",
        business_day_ordinal: 5,
        start: "2026-11-05",
      },
    );
  });

  it("starts on today without an expected occurrence", () => {
    expect(draftFromSchedule(salary(), null, today).recurrence.start).toBe(
      today,
    );
  });

  it("copies the terms in force on the start date, not the first version", () => {
    const versions = salary({
      terms: [terms("2026-01-01", 3990), terms("2027-01-01", 4490)],
    });

    expect(draftFromSchedule(versions, "2026-12-05", today).amount).toBe(3990);
    expect(draftFromSchedule(versions, "2027-02-05", today).amount).toBe(4490);
  });

  it("drops the count of the rule and keeps its end date", () => {
    const counted = salary({
      terms: [terms("2026-01-01", 10000, { count: 12, until: "2026-12-01" })],
    });

    const { recurrence } = draftFromSchedule(counted, "2026-11-05", today);

    expect(recurrence).not.toHaveProperty("count");
    expect(recurrence).toHaveProperty("until", "2026-12-01");
  });

  it("copies the payee of the schedule", () => {
    expect(
      draftFromSchedule(salary({ payee_id: payeeID }), null, today).payeeID,
    ).toBe(payeeID);
  });
});
