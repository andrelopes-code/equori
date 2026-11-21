import { describe, expect, it } from "vitest";

import { statementDetail } from "@/features/transactions/transactions-statement/statement-detail";

const base = {
  accounts: "Itaú Visa Platinum",
  uncategorized: false,
  transfer: false,
  voided: false,
};

describe("statementDetail", () => {
  it("names the category, then the accounts", () => {
    expect(statementDetail(base, "Presentes")).toEqual({
      flag: undefined,
      text: "Presentes · Itaú Visa Platinum",
    });
  });

  it("flags an uncategorized row before its accounts", () => {
    expect(
      statementDetail({ ...base, uncategorized: true }, undefined),
    ).toEqual({ flag: "uncategorized", text: "Itaú Visa Platinum" });
  });

  it("reads a transfer as its accounts", () => {
    expect(
      statementDetail(
        {
          ...base,
          transfer: true,
          accounts: "Conta Nubank → Nubank Mastercard",
        },
        undefined,
      ),
    ).toEqual({ flag: undefined, text: "Conta Nubank → Nubank Mastercard" });
  });

  it("flags a voided row before its accounts, over its category", () => {
    expect(statementDetail({ ...base, voided: true }, "Presentes")).toEqual({
      flag: "voided",
      text: "Itaú Visa Platinum",
    });
  });

  it("reads the category alone when no account is named", () => {
    expect(statementDetail({ ...base, accounts: "" }, "Bares")).toEqual({
      flag: undefined,
      text: "Bares",
    });
  });
});
