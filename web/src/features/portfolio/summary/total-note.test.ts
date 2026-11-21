import { describe, expect, it } from "vitest";

import { totalNote } from "@/features/portfolio/summary/total-note";

const t = (key: string, vars?: Record<string, string | number>) =>
  `${key}${vars === undefined ? "" : JSON.stringify(vars)}`;
const writers = {
  signed: (amount: number) => `s${String(amount)}`,
  money: (m: { amount: number; currency: string }) =>
    `${m.currency}${String(m.amount)}`,
};

describe("totalNote", () => {
  it("writes the sales and the income (TR4)", () => {
    expect(
      totalNote(
        t as never,
        { realized: 300, income: 150, outside: [] },
        writers,
      ),
    ).toBe('holdings.total.note{"realized":"s300","income":"s150"}');
  });

  it("names the amounts in another currency", () => {
    expect(
      totalNote(
        t as never,
        {
          realized: 0,
          income: 0,
          outside: [
            { amount: 900, currency: "USD" },
            { amount: 300, currency: "USD" },
          ],
        },
        writers,
      ),
    ).toBe(
      [
        'holdings.total.note{"realized":"s0","income":"s0"}',
        'holdings.total.outside{"amounts":"USD900 · USD300"}',
      ].join(" · "),
    );
  });
});
