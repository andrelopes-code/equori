import { describe, expect, it } from "vitest";

import {
  kindCount,
  kindCounts,
} from "@/features/accounts/kind-chooser/kind-count";
import type { Kind } from "@/features/accounts/model/account-kinds";
import { accountFixtures } from "@/testing/account-api";

type Accounts = Parameters<typeof kindCount>[0];

const accounts = accountFixtures as unknown as Accounts;

describe("kindCount", () => {
  it.each([
    ["checking", 2],
    ["reserve", 1],
    ["credit_card", 1],
    ["brokerage", 1],
    ["wallet", 1],
    ["cash", 1],
    ["loan", 1],
    ["savings", 0],
    ["benefit", 0],
    ["receivable", 0],
    ["property", 0],
    ["payable", 0],
  ] as const satisfies readonly (readonly [Kind, number])[])(
    "counts %s accounts: %i",
    (kind, count) => {
      expect(kindCount(accounts, kind)).toBe(count);
    },
  );
});

describe("kindCounts", () => {
  it("counts every kind", () => {
    expect(kindCounts(accounts)).toEqual({
      checking: 2,
      reserve: 1,
      credit_card: 1,
      brokerage: 1,
      wallet: 1,
      cash: 1,
      loan: 1,
      savings: 0,
      benefit: 0,
      receivable: 0,
      property: 0,
      payable: 0,
    });
  });
});
