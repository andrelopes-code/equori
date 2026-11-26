import { describe, expect, it } from "vitest";

import { historyWords } from "@/features/overview/cards/history-words";

describe("historyWords", () => {
  it("writes each month with its amount, and the mean", () => {
    const words = historyWords(
      {
        bars: [
          bar("2026-10", 125000, false),
          bar("2026-11", 291838, false),
          bar("2026-12", 56587, true),
        ],
        mean: { amount: 208419, currency: "BRL" },
        meanHeight: 71.4,
      },
      "pt-BR",
      (m) => String(m.amount),
    );

    expect(words).toEqual({
      months: "out/2026 125000, nov/2026 291838, dez/2026 56587",
      mean: "208419",
    });
  });

  it("writes nothing for a face without bars", () => {
    const words = historyWords(
      { bars: [], mean: undefined, meanHeight: 0 },
      "pt-BR",
      (m) => String(m.amount),
    );

    expect(words).toBeUndefined();
  });
});

function bar(reference: string, amount: number, open: boolean) {
  return { reference, amount: { amount, currency: "BRL" }, open, height: 0 };
}
