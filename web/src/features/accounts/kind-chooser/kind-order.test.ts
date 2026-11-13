import { describe, expect, it } from "vitest";

import {
  kindOrder,
  nextKind,
} from "@/features/accounts/kind-chooser/kind-order";
import type { Kind } from "@/features/accounts/model/account-kinds";

describe("kindOrder", () => {
  it("lists the assets, then the liabilities", () => {
    expect(kindOrder).toEqual([
      "checking",
      "cash",
      "wallet",
      "benefit",
      "savings",
      "reserve",
      "brokerage",
      "receivable",
      "credit_card",
      "loan",
      "payable",
    ]);
  });
});

describe("nextKind", () => {
  it.each([
    ["checking", "ArrowRight", "cash"],
    ["checking", "ArrowLeft", "checking"],
    ["checking", "ArrowDown", "benefit"],
    ["receivable", "ArrowDown", "payable"],
    ["payable", "ArrowDown", "payable"],
    ["cash", "ArrowUp", "checking"],
    [null, "ArrowRight", "checking"],
    ["checking", "a", null],
  ] as const satisfies readonly (readonly [
    Kind | null,
    string,
    Kind | null,
  ])[])("from %s, %s gives %s", (current, key, expected) => {
    expect(nextKind(current, key)).toBe(expected);
  });
});
