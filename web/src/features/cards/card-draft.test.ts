import { afterEach, describe, expect, it, vi } from "vitest";

import {
  clearCardDraft,
  loadCardDraft,
  saveCardDraft,
} from "@/features/cards/card-draft";

interface PayDraft {
  amount: number;
}

function isPayDraft(raw: unknown): raw is PayDraft {
  return (
    typeof raw === "object" &&
    raw !== null &&
    Number.isSafeInteger((raw as { amount?: unknown }).amount)
  );
}

afterEach(() => {
  vi.restoreAllMocks();
  sessionStorage.clear();
});

describe("card draft", () => {
  it("round-trips under cards.<form>.<accountId>", () => {
    saveCardDraft("pay", "acc-1", { amount: 5000 });
    expect(sessionStorage.getItem("cards.pay.acc-1")).toBe('{"amount":5000}');
    expect(loadCardDraft("pay", "acc-1", isPayDraft)).toEqual({ amount: 5000 });
  });

  it("returns null when nothing is stored", () => {
    expect(loadCardDraft("pay", "acc-1", isPayDraft)).toBeNull();
  });

  it("returns null for a stored value the validator rejects", () => {
    sessionStorage.setItem("cards.pay.acc-1", '{"amount":"x"}');
    expect(loadCardDraft("pay", "acc-1", isPayDraft)).toBeNull();
  });

  it("returns null for unparseable text", () => {
    sessionStorage.setItem("cards.pay.acc-1", "{");
    expect(loadCardDraft("pay", "acc-1", isPayDraft)).toBeNull();
  });

  it("keeps drafts of different forms and cards apart", () => {
    saveCardDraft("pay", "acc-1", { amount: 1 });
    expect(loadCardDraft("finance", "acc-1", isPayDraft)).toBeNull();
    expect(loadCardDraft("pay", "acc-2", isPayDraft)).toBeNull();
  });

  it("clears a stored draft", () => {
    saveCardDraft("pay", "acc-1", { amount: 5000 });
    clearCardDraft("pay", "acc-1");
    expect(sessionStorage.getItem("cards.pay.acc-1")).toBeNull();
  });

  it("tolerates unavailable storage", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.spyOn(Storage.prototype, "removeItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    expect(loadCardDraft("pay", "acc-1", isPayDraft)).toBeNull();
    expect(() => {
      saveCardDraft("pay", "acc-1", { amount: 1 });
    }).not.toThrow();
    expect(() => {
      clearCardDraft("pay", "acc-1");
    }).not.toThrow();
  });
});
