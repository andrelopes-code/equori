import { describe, expect, it } from "vitest";

import { firstSteps } from "@/features/overview/first-steps";

describe("firstSteps", () => {
  it("lists every task undone on a new installation", () => {
    expect(
      firstSteps({
        hasAccount: false,
        hasTransaction: false,
        hasUncategorized: false,
      }),
    ).toEqual([
      { id: "account", done: false, destination: { to: "/accounts/new" } },
      {
        id: "transactions",
        done: false,
        destination: { to: "/transactions/new" },
      },
      {
        id: "categories",
        done: false,
        destination: { to: "/transactions", search: { uncategorized: true } },
      },
    ]);
  });

  it("keeps the categories undone while a transaction lacks one", () => {
    expect(
      firstSteps({
        hasAccount: true,
        hasTransaction: true,
        hasUncategorized: true,
      }),
    ).toMatchObject([
      { id: "account", done: true },
      { id: "transactions", done: true },
      { id: "categories", done: false },
    ]);
  });

  it("lists nothing once every task is done", () => {
    expect(
      firstSteps({
        hasAccount: true,
        hasTransaction: true,
        hasUncategorized: false,
      }),
    ).toEqual([]);
  });
});
