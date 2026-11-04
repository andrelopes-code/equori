import { describe, expect, it } from "vitest";

import {
  draftProblems,
  emptyDraft,
  scheduleInput,
  type ScheduleDraft,
} from "@/features/planning/schedule-draft";

const accountID = "a0000000-0000-4000-8000-000000000001";
const categoryID = "a0000000-0000-4000-8000-000000000002";
const payeeID = "a0000000-0000-4000-8000-000000000003";

function filled(patch: Partial<ScheduleDraft> = {}): ScheduleDraft {
  return {
    ...emptyDraft("2026-11-04"),
    description: " Salary ",
    amount: 500000,
    accountID,
    counterpartID: categoryID,
    ...patch,
  };
}

describe("emptyDraft", () => {
  it("starts a monthly rule on the day and date given", () => {
    expect(emptyDraft("2026-11-04")).toMatchObject({
      kind: "bill",
      accountID: null,
      counterpartID: null,
      payeeID: null,
      description: "",
      amount: 0,
      calendar: null,
      toleranceBP: 1000,
      graceDays: 3,
      recurrence: {
        frequency: "monthly",
        interval: 1,
        day_of_month: 4,
        adjustment: "none",
        start: "2026-11-04",
      },
    });
  });
});

describe("draftProblems", () => {
  it("reports the four required fields of an empty draft", () => {
    expect(draftProblems(emptyDraft("2026-11-04"))).toEqual({
      description: "schedule.required.description",
      amount: "schedule.required.amount",
      account_id: "schedule.required.account",
      counterpart_id: "schedule.required.counterpart",
    });
  });

  it("reports a blank description and reports nothing for a filled draft", () => {
    expect(draftProblems(filled({ description: "   " }))).toEqual({
      description: "schedule.required.description",
    });
    expect(draftProblems(filled())).toEqual({});
  });
});

describe("scheduleInput", () => {
  const ctx = { currency: "BRL", defaultCalendar: "br_banking" };

  it("trims the description and sends the amount in the currency", () => {
    expect(scheduleInput(filled(), ctx)).toMatchObject({
      kind: "bill",
      account_id: accountID,
      counterpart_id: categoryID,
      description: "Salary",
      amount: { amount: 500000, currency: "BRL" },
      match_tolerance_bp: 1000,
      grace_days: 3,
    });
  });

  it("returns null without an account or a counterpart", () => {
    expect(scheduleInput(filled({ accountID: null }), ctx)).toBeNull();
    expect(scheduleInput(filled({ counterpartID: null }), ctx)).toBeNull();
  });

  it("sends the payee for a category kind and leaves it out for a transfer", () => {
    expect(scheduleInput(filled({ payeeID }), ctx)).toHaveProperty(
      "payee_id",
      payeeID,
    );
    expect(
      scheduleInput(filled({ kind: "transfer", payeeID }), ctx),
    ).not.toHaveProperty("payee_id");
  });

  it("omits the calendar when it is unset or the region's", () => {
    expect(scheduleInput(filled(), ctx)).not.toHaveProperty("calendar");
    expect(
      scheduleInput(filled({ calendar: "br_banking" }), ctx),
    ).not.toHaveProperty("calendar");
    expect(
      scheduleInput(filled({ calendar: "us_federal" }), ctx),
    ).toHaveProperty("calendar", "us_federal");
  });
});
