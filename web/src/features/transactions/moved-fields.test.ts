import { describe, expect, it } from "vitest";

import { emptyDraft } from "@/features/transactions/entry-kind";
import { movedFields } from "@/features/transactions/moved-fields";

describe("movedFields", () => {
  it("names the fields whose stored value moved since the form opened", () => {
    const opened = {
      ...emptyDraft("2026-10-10", "checking"),
      amount: 100,
      categoryId: "food",
      tags: ["a"],
    };
    const stored = {
      ...opened,
      amount: 250,
      date: "2026-10-11",
      tags: ["a", "b"],
    };
    expect(movedFields(opened, stored)).toEqual(["amount", "date", "tags"]);
    expect(movedFields(opened, opened)).toEqual([]);
  });

  it("names the postings when either side is edited row by row", () => {
    const opened = { ...emptyDraft("2026-10-10"), kind: "advanced" as const };
    const stored = {
      ...opened,
      rows: [
        { accountId: "a", amount: -1, memo: "" },
        { accountId: "b", amount: 1, memo: "" },
      ],
    };
    expect(movedFields(opened, stored)).toEqual(["postings"]);
  });
});
