import { beforeEach, describe, expect, it } from "vitest";

import { emptyDraft } from "@/features/transactions/entry-kind";
import {
  clearDraft,
  readDraft,
  writeDraft,
} from "@/features/transactions/form-draft";

beforeEach(() => {
  sessionStorage.clear();
});

describe("form draft", () => {
  it("keeps what was typed until it is cleared", () => {
    const draft = {
      ...emptyDraft("2026-10-10"),
      amount: 900,
      description: "Lunch",
    };
    writeDraft("new", draft);
    expect(readDraft("new")).toEqual(draft);
    clearDraft("new");
    expect(readDraft("new")).toBeNull();
  });

  it("ignores a stored value that is not a draft", () => {
    sessionStorage.setItem("equori.draft.new", '{"kind":"other"}');
    expect(readDraft("new")).toBeNull();
    sessionStorage.setItem("equori.draft.new", "{");
    expect(readDraft("new")).toBeNull();
  });
});
