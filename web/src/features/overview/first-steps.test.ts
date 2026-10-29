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
      { id: "account", done: false },
      { id: "transactions", done: false },
      { id: "categories", done: false },
    ]);
  });

  it("keeps the categories undone while a transaction lacks one", () => {
    expect(
      firstSteps({
        hasAccount: true,
        hasTransaction: true,
        hasUncategorized: true,
      }),
    ).toEqual([
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
