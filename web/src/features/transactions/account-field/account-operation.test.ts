import { describe, expect, it } from "vitest";

import { operationOf } from "@/features/transactions/account-field/account-operation";
import type { Operation } from "@/features/transactions/account-field/account-operation";

describe("operationOf", () => {
  it.each<["expense" | "income" | "transfer", "out" | "in", Operation]>([
    ["expense", "out", "expense"],
    ["income", "in", "income"],
    ["transfer", "out", "transfer-out"],
    ["transfer", "in", "transfer-in"],
  ])("%s with direction %s is %s", (kind, direction, want) => {
    expect(operationOf(kind, direction)).toBe(want);
  });
});
