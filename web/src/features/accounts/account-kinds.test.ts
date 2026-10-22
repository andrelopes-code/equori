import { describe, expect, it } from "vitest";

import {
  classOf,
  compatibleKinds,
  kindGroups,
  kindHint,
  kindLabel,
  kinds,
  yieldCapable,
} from "@/features/accounts/account-kinds";
import { catalogEn } from "@/i18n/catalog.en";

describe("account kinds", () => {
  it("gives every kind a class, one group, a label and a hint", () => {
    const grouped = kindGroups.flatMap((g) => g.kinds);
    expect([...grouped].sort()).toEqual([...kinds].sort());
    for (const kind of kinds) {
      expect(["asset", "liability"]).toContain(classOf(kind));
      expect(catalogEn[kindLabel[kind]]).toBeTruthy();
      expect(catalogEn[kindHint[kind]]).toBeTruthy();
    }
  });

  it.each([
    ["checking", "asset"],
    ["receivable", "asset"],
    ["brokerage", "asset"],
    ["credit_card", "liability"],
    ["loan", "liability"],
    ["payable", "liability"],
  ] as const)("classifies %s as %s", (kind, cls) => {
    expect(classOf(kind)).toBe(cls);
  });

  it.each([
    ["CHECKING_ACCOUNT", ["checking"]],
    ["SAVINGS_ACCOUNT", ["savings", "reserve"]],
    ["CREDIT_CARD", ["credit_card"]],
    ["RESERVED_BALANCE", ["reserve"]],
    ["INVESTMENT", []],
  ] as const)("maps the external subtype %s to %j (A35)", (subtype, want) => {
    expect(compatibleKinds(subtype)).toEqual(want);
  });

  it("lets only savings and reserves yield automatically", () => {
    expect(kinds.filter(yieldCapable)).toEqual(["savings", "reserve"]);
  });
});
