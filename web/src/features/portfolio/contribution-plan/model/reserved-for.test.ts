import { describe, expect, it } from "vitest";

import type { components } from "@/api/schema.gen";
import { reservedFor } from "@/features/portfolio/contribution-plan/model/reserved-for";

type Account = components["schemas"]["Account"];
type Goal = components["schemas"]["Goal"];

const account = (id: string, currency = "BRL", parent?: string) =>
  ({
    id,
    currency,
    ...(parent === undefined ? {} : { parent_id: parent }),
  }) as Account;
const goal = (name: string, whole: string[], allocated: string[] = []) =>
  ({
    name,
    account_ids: whole,
    allocated_accounts: allocated.map((account_id) => ({ account_id })),
  }) as unknown as Goal;

const accounts = [
  account("broker"),
  account("cash", "BRL", "broker"),
  account("fund", "WRLD11", "broker"),
  account("other-broker"),
  account("other-fund", "ABCD11", "other-broker"),
  account("savings"),
];

// CN20: a member is reserved for the goal that holds its account.
describe("reservedFor", () => {
  const goals = [goal("Retirement", ["broker"]), goal("Trip", [], ["savings"])];

  it("names the goal of a member's account, whole or allocated", () => {
    expect(reservedFor({ account_id: "cash" }, goals, accounts)).toBe(
      "Retirement",
    );
    expect(reservedFor({ account_id: "savings" }, goals, accounts)).toBe(
      "Trip",
    );
  });

  it("names the goal that holds an account of the member's instrument", () => {
    expect(reservedFor({ instrument: "WRLD11" }, goals, accounts)).toBe(
      "Retirement",
    );
  });

  it("is undefined for a member no goal holds", () => {
    expect(
      reservedFor({ instrument: "ABCD11" }, goals, accounts),
    ).toBeUndefined();
    expect(
      reservedFor({ account_id: "other-broker" }, goals, accounts),
    ).toBeUndefined();
  });
});
