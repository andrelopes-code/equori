import { describe, expect, it } from "vitest";

import {
  changeNote,
  multipleNote,
  multipleValue,
} from "@/features/instruments/company-report/multiple-text";
import { catalogPtBR } from "@/i18n/catalog.pt-BR";
import type { TFunction } from "@/i18n/i18n-provider";

const t = ((key, vars) =>
  catalogPtBR[key].replace(/\{(\w+)\}/g, (_, name: string) =>
    String(vars?.[name]),
  )) satisfies TFunction;

describe("multipleValue", () => {
  it.each([
    [{ value: "33.405712" }, "33,4"],
    [{ value: "0.438574" }, "0,44"],
    [{ value: "1" }, "1,0"],
    [{ reason: "loss" }, "sem dado"],
  ])("writes %j", (figure, text) => {
    expect(multipleValue(t, "pt-BR", figure)).toBe(text);
  });
});

describe("multipleNote", () => {
  const range = { least: "27.015878", greatest: "38.590772", years: 5 };

  it("states the range of a multiple", () => {
    expect(multipleNote(t, "pt-BR", { value: "33.4" }, range)).toBe(
      "faixa de 5 exercícios: 27,0 a 38,6",
    );
  });

  it("states that a multiple has no range", () => {
    expect(multipleNote(t, "pt-BR", { value: "33.4" }, undefined)).toBe(
      "sem faixa: menos de 3 exercícios com preço oficial",
    );
  });

  it("states the reason before the range", () => {
    expect(multipleNote(t, "pt-BR", { reason: "shares" }, range)).toBe(
      "número de ações não conferido",
    );
  });
});

describe("changeNote", () => {
  it.each([
    [
      { state: "rate", rate: "0.2", date: "2026-09-30", months: 9 },
      "9 meses até 30/09/2026",
    ],
    [
      { state: "loss", date: "2025-12-31", months: 12 },
      "exercício até 31/12/2025",
    ],
    [{ reason: "short_history" }, "histórico curto"],
  ])("writes %j", (change, text) => {
    expect(changeNote(t, "pt-BR", change)).toBe(text);
  });
});
