import { describe, expect, it } from "vitest";

import { postingDetail } from "@/features/transactions/transaction-detail/posting-detail";
import { catalogEn } from "@/i18n/catalog.en";
import type { MessageKey } from "@/i18n/catalog.en";

describe("postingDetail", () => {
  it("joins the statement, the installment, the clearing date and the note", () => {
    const posting = {
      id: "p1",
      account_id: "a1",
      amount: { amount: -1000, currency: "BRL" },
      weight: { amount: -1000, currency: "BRL" },
      status: "cleared" as const,
      statement: "2026-11",
      installment: { plan_id: "plan1", number: 2, count: 10 },
      settled_on: "2026-11-05",
      memo: "Gift",
    };

    const text = postingDetail(posting, translate, "en");

    expect(text).toBe(
      "statement Nov 2026 · installment 2 of 10 · 11/05/2026 · Gift",
    );
  });

  it("is empty for a posting with none of them", () => {
    const posting = {
      id: "p1",
      account_id: "a1",
      amount: { amount: -1000, currency: "BRL" },
      weight: { amount: -1000, currency: "BRL" },
      status: "cleared" as const,
    };

    expect(postingDetail(posting, translate, "en")).toBe("");
  });
});

function translate(
  key: MessageKey,
  values: Record<string, string | number> = {},
) {
  return catalogEn[key].replace(/\{(\w+)\}/g, (_, name: string) =>
    String(values[name]),
  );
}
