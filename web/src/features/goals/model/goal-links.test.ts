import { describe, expect, it } from "vitest";

import type { components } from "@/api/schema.gen";
import {
  canShare,
  linkBody,
  linksOf,
  schedulePreset,
  setLink,
  sharedLines,
  syncLinks,
} from "@/features/goals/model/goal-links";

type Account = components["schemas"]["Account"];
type Goal = components["schemas"]["Goal"];

const account = (id: string, extra: Partial<Account> = {}) =>
  ({ id, name: id, class: "asset", currency: "BRL", ...extra }) as Account;

describe("goal links", () => {
  it("shares an open asset account in a currency without sub-accounts", () => {
    const all = [
      account("savings"),
      account("broker"),
      account("cash", { parent_id: "broker" }),
      account("fund", { parent_id: "broker", currency: "WRLD11" }),
      account("card", { class: "liability" }),
      account("old", { closed_on: "2026-01-01" }),
    ];

    expect(all.filter((a) => canShare(a, all)).map((a) => a.id)).toEqual([
      "savings",
      "cash",
    ]);
  });

  it("reads the links of a goal and keeps them as the accounts change", () => {
    const goal = {
      account_ids: ["a"],
      allocated_accounts: [{ account_id: "b" }],
    } as unknown as Goal;

    const links = linksOf(goal);
    const next = syncLinks(links, ["b", "c"]);

    expect(links).toEqual([
      { id: "a", part: false, amount: 0 },
      { id: "b", part: true, amount: 0 },
    ]);
    expect(next).toEqual([
      { id: "b", part: true, amount: 0 },
      { id: "c", part: false, amount: 0 },
    ]);
  });

  it("splits the links into the two lists and the amounts to set aside", () => {
    const links = setLink(
      setLink(syncLinks([], ["a", "b", "c"]), "b", { part: true, amount: 500 }),
      "c",
      { part: true },
    );

    expect(linkBody(links)).toEqual({
      account_ids: ["a"],
      allocated_account_ids: ["b", "c"],
      allocations: [{ account: "b", amount: 500 }],
    });
  });

  it("names the other goal of each shared account", () => {
    const goal = (id: string, shared: string[], accounts: string[]) =>
      ({
        id,
        name: id,
        account_ids: [],
        allocated_accounts: accounts.map((account_id) => ({ account_id })),
        shared_with: shared,
      }) as unknown as Goal;
    const car = goal("car", ["trip"], ["savings", "wallet"]);
    const trip = goal("trip", ["car"], ["savings"]);
    const solo = goal("solo", [], ["other"]);

    expect(
      sharedLines(car, [car, trip, solo], new Map([["savings", "Savings"]])),
    ).toEqual([{ account: "Savings", goal: "trip" }]);
  });

  it("opens a saving into the goal's account, naming the goal of a shared one", () => {
    const whole = {
      id: "g1",
      name: "Trip",
      account_ids: ["a"],
      allocated_accounts: [{ account_id: "b" }],
    } as unknown as Goal;
    const shared = { ...whole, account_ids: [] } as unknown as Goal;

    expect(schedulePreset(whole, 50000)).toEqual({
      kind: "savings",
      counterpart: "a",
      amount: 50000,
      description: "Trip",
    });
    expect(schedulePreset(shared, 50000)).toEqual({
      kind: "savings",
      counterpart: "b",
      amount: 50000,
      description: "Trip",
      goal: "g1",
    });
    expect(schedulePreset(shared, 0)).toBeUndefined();
  });
});
