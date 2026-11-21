import { describe, expect, it } from "vitest";

import type { components } from "@/api/schema.gen";
import { recordShape } from "@/features/accounts/kind-figures/record-shape";

type Account = components["schemas"]["Account"];

describe("recordShape", () => {
  it.each([
    ["property", "asset", "property"],
    ["loan", "liability", "loan"],
    ["loan", "asset", "cash"],
    ["checking", "asset", "cash"],
    ["credit_card", "liability", "cash"],
  ] as const)("%s on the %s side is %s", (kind, cls, want) => {
    const account = { id: "a", kind, class: cls } as unknown as Account;

    expect(recordShape(account)).toBe(want);
  });
});
