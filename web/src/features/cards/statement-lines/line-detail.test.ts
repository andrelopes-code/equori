import { describe, expect, it } from "vitest";

import type { components } from "@/api/schema.gen";
import { lineDetail } from "@/features/cards/statement-lines/line-detail";

type Line = components["schemas"]["StatementPosting"];

const base: Line = {
  transaction_id: "tx",
  date: "2026-10-01",
  description: "Geladeira",
  card_role: "charge",
  amount: { amount: -100000, currency: "BRL" },
  provisional: false,
};

const t = (key: string, vars?: Record<string, string | number>) =>
  vars === undefined
    ? key
    : `${key}:${String(vars.number)}/${String(vars.count)}`;

describe("lineDetail", () => {
  it("writes nothing for a plain charge", () => {
    expect(lineDetail(base, false, t)).toEqual({ flag: undefined, text: "" });
  });

  it("writes the role of a payment and the installment of a charge", () => {
    expect(lineDetail({ ...base, card_role: "payment" }, false, t).text).toBe(
      "statement.role.payment",
    );
    expect(
      lineDetail(
        { ...base, installment: { number: 2, count: 10 } } as Line,
        false,
        t,
      ).text,
    ).toBe("statement.installment:2/10");
  });

  it("names a line the bank has not reported before a provisional one", () => {
    expect(lineDetail({ ...base, provisional: true }, true, t).flag).toEqual({
      key: "statement.unconfirmed",
      tone: "warning",
    });
    expect(lineDetail({ ...base, provisional: true }, false, t).flag).toEqual({
      key: "statement.provisional",
      tone: "info",
    });
  });
});
