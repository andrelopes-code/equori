import { describe, expect, it } from "vitest";

import { fieldKind, toBody, toDraft } from "@/features/admin/draft";

const scaleOf = (code: string) => (code === "BRL" ? 2 : 0);

describe("toDraft and toBody", () => {
  it("edits money as a decimal and sends it in minor units", () => {
    const draft = toDraft(
      { amount: { amount: -5000, currency: "BRL" } },
      scaleOf,
    );
    expect(draft).toEqual({ amount: { amount: "-50.00", currency: "BRL" } });
    expect(
      toBody({ amount: { amount: "12.3", currency: "BRL" } }, {}, scaleOf),
    ).toEqual({ amount: { amount: 1230, currency: "BRL" } });
  });

  it("omits empty text and money without an amount", () => {
    expect(
      toBody(
        {
          date: "2026-10-19",
          memo: "",
          interest: { amount: "", currency: "BRL" },
          postings: [{ statement: "", account_id: "a" }],
        },
        {},
        scaleOf,
      ),
    ).toEqual({ date: "2026-10-19", postings: [{ account_id: "a" }] });
  });

  it("sends a number where the template held one or the key is numeric", () => {
    expect(
      toBody(
        { closing_day: "5", grace_days: "2", description: "12" },
        { closing_day: 3, grace_days: "", description: "" },
        scaleOf,
      ),
    ).toEqual({ closing_day: 5, grace_days: 2, description: "12" });
  });

  it("keeps text that is not a number for the backend to reject", () => {
    expect(toBody({ closing_day: "5a" }, { closing_day: 3 }, scaleOf)).toEqual({
      closing_day: "5a",
    });
  });

  it("keeps booleans, string lists and nested objects", () => {
    const value = {
      rollover: false,
      tags: ["a", "b"],
      recurrence: { frequency: "monthly", interval: 1 },
    };
    expect(toBody(toDraft(value, scaleOf), value, scaleOf)).toEqual(value);
  });
});

describe("fieldKind", () => {
  it.each([
    ["account_id", "", "account"],
    ["from_account_id", "", "account"],
    ["category_id", "", "account"],
    ["counterpart_id", "", "account"],
    ["payee_id", "", "payee"],
    ["institution_id", "", "institution"],
    ["transaction_id", "", "text"],
    ["date", "", "date"],
    ["effective_from", "2026-10", "month"],
    ["effective_from", "2026-10-19", "date"],
    ["statement", "", "month"],
    ["kind", "bill", "enum"],
    ["description", "", "text"],
  ])("reads %s holding %j as %s", (key, value, kind) => {
    expect(fieldKind(key, value).kind).toBe(kind);
  });

  it("picks the option list that holds the current value", () => {
    expect(fieldKind("kind", "bill")).toEqual({
      kind: "enum",
      options: ["bill", "income", "subscription", "transfer", "savings"],
    });
    expect(fieldKind("type", "stock")).toMatchObject({
      options: expect.arrayContaining(["crypto"]) as unknown,
    });
  });
});
