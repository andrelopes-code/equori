import { describe, expect, it } from "vitest";

import { openingLabel } from "@/features/accounts/opening-label";

describe("openingLabel", () => {
  it.each([
    ["credit_card", "liability", "accountForm.openingCard"],
    ["loan", "liability", "accountForm.openingOwed"],
    ["checking", "asset", "accountForm.opening"],
  ] as const)("labels %s as %s", (kind, cls, key) => {
    expect(openingLabel(kind, cls)).toBe(key);
  });
});
