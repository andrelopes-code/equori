import { describe, expect, it } from "vitest";

import { fieldTarget } from "@/features/cards/field-target";

describe("fieldTarget", () => {
  it.each([
    "card_account_id",
    "postings[2].account_id",
    "postings[0].statement",
  ])("maps %s to settings", (field) => {
    expect(fieldTarget(field)).toEqual({ kind: "settings" });
  });

  it.each(["amount", "splits[1].amount", "installment_count"])(
    "maps %s to the input of the same name",
    (field) => {
      expect(fieldTarget(field)).toEqual({ kind: "field", name: field });
    },
  );
});
