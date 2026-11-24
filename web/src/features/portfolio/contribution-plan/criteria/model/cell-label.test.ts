import { describe, expect, it } from "vitest";

import type { CellAnswer } from "@/features/portfolio/contribution-plan/criteria/model/cell-answer";
import {
  cellLabel,
  cellNote,
  nextAnswer,
} from "@/features/portfolio/contribution-plan/criteria/model/cell-label";
import { catalogPtBR } from "@/i18n/catalog.pt-BR";
import type { TFunction } from "@/i18n/i18n-provider";

const t = ((key, vars) =>
  catalogPtBR[key].replace(/\{(\w+)\}/g, (_, name: string) =>
    String(vars?.[name]),
  )) satisfies TFunction;
const context = {
  t,
  locale: "pt-BR",
  asset: "WEGE3",
  criterion: "P/L de até",
  fact: "price_earnings_max",
};

const cases: [string, CellAnswer, string, string][] = [
  [
    "a figure",
    {
      kind: "automatic",
      yes: false,
      detail: { value: "33.4057", date: "2026-09-30" },
    },
    "33,4",
    "WEGE3, P/L de até: não, 33,4, dado de 30/09/2026, respondido pelo equori",
  ],
  [
    "a loss",
    { kind: "automatic", yes: false, detail: { reason: "loss" } },
    "",
    "WEGE3, P/L de até: não, prejuízo em 12 meses, respondido pelo equori",
  ],
  [
    "a signal",
    { kind: "automatic", yes: true, detail: {} },
    "",
    "WEGE3, P/L de até: sim, respondido pelo equori",
  ],
  [
    "an answer of the investor without data",
    { kind: "own", yes: true, reason: "shares" },
    "sem dado",
    "WEGE3, P/L de até: sim, sua resposta: número de ações não conferido",
  ],
  [
    "a criterion outside the chart of accounts",
    { kind: "own", yes: false, reason: "chart" },
    "não se aplica",
    "WEGE3, P/L de até: não, sua resposta: não se aplica ao plano de contas",
  ],
  [
    "a blank answer without data",
    { kind: "own", yes: null, reason: "shares" },
    "sem dado",
    "WEGE3, P/L de até: sem resposta, número de ações não conferido",
  ],
  [
    "a blank answer before the limit",
    { kind: "own", yes: null, reason: undefined },
    "",
    "WEGE3, P/L de até: sem resposta",
  ],
  [
    "a company the method does not cover",
    { kind: "own", yes: null, reason: "financial" },
    "não se aplica",
    "WEGE3, P/L de até: sem resposta, o método não cobre companhias financeiras",
  ],
  [
    "an own criterion",
    { kind: "own", yes: false, reason: undefined },
    "",
    "WEGE3, P/L de até: não",
  ],
  ["a wait", { kind: "pending" }, "", "WEGE3, P/L de até: calculando"],
];

describe("cell texts", () => {
  it.each(cases)("write %s", (_, cell, note, label) => {
    expect(cellNote(cell, context)).toBe(note);
    expect(cellLabel(cell, context)).toBe(label);
  });
});

describe("nextAnswer", () => {
  const own = (yes: boolean | null, reason?: string) =>
    nextAnswer({ kind: "own", yes, reason });

  it("turns an own criterion between yes and no", () => {
    expect([own(true), own(false)]).toEqual([false, true]);
  });

  it("turns one without data from blank to no, to yes, and back", () => {
    expect([
      own(null, "chart"),
      own(false, "chart"),
      own(true, "chart"),
    ]).toEqual([false, true, null]);
  });
});
