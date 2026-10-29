import { describe, expect, it } from "vitest";

import type { components } from "@/api/schema.gen";
import { openDefaultAccount } from "@/features/transactions/capture-default-account";

type Account = components["schemas"]["Account"];

const accounts = new Map<string, Account>(
  [account("checking"), account("old", "2026-05-01")].map((a) => [a.id, a]),
);

describe("openDefaultAccount", () => {
  it.each([
    ["an open account", "checking", "checking"],
    ["a closed account", "old", null],
    ["an unknown account", "gone", null],
    ["no account", null, null],
  ])("returns the id only for an open account: %s", (_, id, want) => {
    expect(openDefaultAccount(id, accounts)).toBe(want);
  });
});

function account(id: string, closedOn?: string): Account {
  return {
    id,
    name: id,
    class: "asset",
    currency: "BRL",
    opened_on: "2026-01-01",
    yield_mode: "none",
    ...(closedOn === undefined ? {} : { closed_on: closedOn }),
  };
}
