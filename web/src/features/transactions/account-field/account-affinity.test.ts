import { describe, expect, it } from "vitest";

import type { components } from "@/api/schema.gen";
import {
  isPrimary,
  kindRank,
} from "@/features/transactions/account-field/account-affinity";
import type { Operation } from "@/features/transactions/account-field/account-operation";

type Kind = components["schemas"]["Account"]["kind"];

describe("isPrimary", () => {
  const cases: [Operation, Kind, boolean][] = [
    ["expense", "checking", true],
    ["expense", "cash", true],
    ["expense", "benefit", true],
    ["expense", "credit_card", true],
    ["expense", "reserve", false],
    ["expense", "brokerage", false],
    ["expense", "receivable", false],
    ["income", "credit_card", false],
    ["income", "savings", true],
    ["transfer-out", "credit_card", false],
    ["transfer-in", "credit_card", true],
    ["transfer-in", "brokerage", true],
    ["transfer-in", "receivable", false],
    ["transfer-in", "loan", false],
    ["expense", undefined, true],
    ["income", undefined, true],
    ["transfer-out", undefined, true],
    ["transfer-in", undefined, true],
  ];

  it.each(cases)("%s with %s is %s", (operation, kind, expected) => {
    expect(isPrimary(operation, kind)).toBe(expected);
  });
});

describe("kindRank", () => {
  const cases: [Operation, Kind, number][] = [
    ["expense", "checking", 0],
    ["expense", "cash", 1],
    ["expense", "benefit", 2],
    ["expense", "credit_card", 3],
    ["expense", "reserve", 99],
    ["income", "savings", 1],
  ];

  it.each(cases)("%s with %s ranks %s", (operation, kind, expected) => {
    expect(kindRank(operation, kind)).toBe(expected);
  });
});
