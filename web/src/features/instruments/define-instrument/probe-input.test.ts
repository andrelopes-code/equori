import { describe, expect, it } from "vitest";

import { probeInput } from "@/features/instruments/define-instrument/probe-input";

describe("probeInput", () => {
  it.each([
    [
      { code: " petr4 ", type: "stock", exchange: "BVMF", quote: "BRL" },
      { code: "PETR4", type: "stock", exchange: "BVMF", quote_currency: "BRL" },
    ],
    [
      { code: "PETR4", type: "stock", exchange: "", quote: "BRL" },
      { code: "PETR4", type: "stock", quote_currency: "BRL" },
    ],
    [{ code: "P", type: "stock", exchange: "BVMF", quote: "BRL" }, null],
    [{ code: "PETR4", type: null, exchange: "BVMF", quote: "BRL" }, null],
    [{ code: "PETR4", type: "stock", exchange: "BVM", quote: "BRL" }, null],
    [{ code: "PETR4", type: "stock", exchange: "BVMF", quote: null }, null],
  ] as const)("reads %j as %j", (form, input) => {
    expect(probeInput(form)).toEqual(input);
  });
});
