import { describe, expect, it } from "vitest";

import {
  currentQuoteOf,
  currentQuotesSummary,
  currentQuotesText,
} from "@/features/portfolio/model/current-quote";
import type { Holding } from "@/features/portfolio/model/portfolio-holdings";
import { catalogPtBR } from "@/i18n/catalog.pt-BR";
import type { TFunction } from "@/i18n/i18n-provider";

describe("currentQuoteOf", () => {
  it.each([
    ["no prices", undefined, undefined],
    ["a price without an instant", [{}], undefined],
    [
      "one open quote",
      [{ at: "2026-11-03T14:58:00Z", open: true }],
      { at: "2026-11-03T14:58:00Z", open: true },
    ],
    [
      "the earliest instant, open when any is open",
      [
        { at: "2026-11-03T14:58:00Z", open: false },
        { at: "2026-11-03T14:40:00Z", open: true },
      ],
      { at: "2026-11-03T14:40:00Z", open: true },
    ],
    [
      "a price without an instant beside a quote",
      [{ at: "2026-11-03T14:58:00Z", open: false }, {}],
      { at: "2026-11-03T14:58:00Z", open: false },
    ],
  ] as const)("reads %s", (_name, prices, want) => {
    expect(currentQuoteOf(prices)).toEqual(want);
  });
});

const ptBR: TFunction = (key, vars) =>
  catalogPtBR[key].replace(/\{(\w+)\}/g, (whole, name: string) =>
    String(vars?.[name] ?? whole),
  );

function holding(value: number | undefined, prices: object[]): Holding {
  return { value, position: { prices } } as unknown as Holding;
}

describe("currentQuotesSummary", () => {
  it("is undefined without holdings", () => {
    expect(currentQuotesSummary([])).toBeUndefined();
  });

  it("is undefined when every holding took a close", () => {
    expect(currentQuotesSummary([holding(1, [{}])])).toBeUndefined();
  });

  it("counts current quotes and closes of valued holdings", () => {
    const got = currentQuotesSummary([
      holding(1, [{ at: "2026-11-03T14:58:00Z", open: true }]),
      holding(1, [{ at: "2026-11-03T14:40:00Z", open: false }]),
      holding(1, [{}]),
      holding(undefined, [{ at: "2026-11-03T14:00:00Z", open: true }]),
    ]);

    expect(got).toEqual({
      current: 2,
      close: 1,
      oldestAt: "2026-11-03T14:40:00Z",
      open: true,
    });
  });
});

describe("currentQuotesText", () => {
  it.each([
    [
      { current: 2, close: 1, oldestAt: "2026-11-03T14:40:00Z", open: true },
      "2 ativos com cotação desde 11:40 · 1 no último fechamento · Pregão aberto: valores parciais",
    ],
    [
      { current: 1, close: 0, oldestAt: "2026-11-03T14:58:00Z", open: false },
      "1 ativo com cotação de 11:58",
    ],
    [
      { current: 1, close: 3, oldestAt: "2026-11-03T14:58:00Z", open: false },
      "1 ativo com cotação de 11:58 · 3 no último fechamento",
    ],
  ])("writes %j", (summary, want) => {
    expect(currentQuotesText(summary, ptBR, "pt-BR", "America/Sao_Paulo")).toBe(
      want,
    );
  });
});
