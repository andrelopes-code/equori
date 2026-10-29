import { describe, expect, it } from "vitest";

import { fieldOf } from "@/features/transactions/field-of";

describe("fieldOf", () => {
  it.each([
    ["expense", "postings[0].account_id", "account"],
    ["expense", "postings[1].account_id", "category"],
    ["transfer", "postings[1].account_id", "to"],
    ["income", "tags[0]", "tags"],
    ["advanced", "postings[0].account_id", "postings[0].account_id"],
    ["expense", "date", "date"],
  ] as const)("%s %s", (kind, field, want) => {
    expect(fieldOf(kind, field)).toBe(want);
  });
});
