import { describe, expect, it } from "vitest";

import { receiptFields } from "@/features/assistant/proposal/receipt-fields";

const amount = {
  field: "amount",
  after: { amount: "-42.90", currency: "BRL" },
};
const description = { field: "description", after: { text: "Lunch" } };
const category = { field: "category", after: { text: "Food" } };
const destination = { field: "to_account", after: { text: "Savings" } };
const account = { field: "account", after: { text: "Checking" } };
const date = { field: "date", after: { date: "2026-11-15" } };

describe("receiptFields", () => {
  it("takes the amount apart and orders the rows", () => {
    const fields = receiptFields([
      date,
      account,
      category,
      amount,
      description,
    ]);

    expect(fields.amount).toEqual(amount.after);
    expect(fields.rows).toEqual([description, category, account, date]);
  });

  it("falls back to the destination account without a category", () => {
    const fields = receiptFields([amount, destination, account]);

    expect(fields.rows).toEqual([destination, account]);
  });

  it("prefers the category over the destination account", () => {
    const fields = receiptFields([destination, category]);

    expect(fields.rows).toEqual([category]);
  });

  it("leaves the amount undefined without an amount change", () => {
    expect(receiptFields([description]).amount).toBeUndefined();
  });
});
