import { describe, expect, it } from "vitest";

import { oneOf } from "@/features/setup/one-of";

describe("oneOf", () => {
  it("accepts a member of the set and refuses any other value", () => {
    const set = ["dark", "light"] as const;

    expect(oneOf(set, "light")).toBe(true);
    expect(oneOf(set, "sepia")).toBe(false);
  });
});
