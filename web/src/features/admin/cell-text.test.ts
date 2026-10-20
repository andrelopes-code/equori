import { describe, expect, it } from "vitest";

import { cellText, fillPath, postingSums } from "@/features/admin/cell-text";

const names = new Map([["0b9a6c1e-2f43-4d1a-9a55-7c1f0e3d2b10", "Checking"]]);
const scaleOf = (code: string) => (code === "BRL" ? 2 : 0);

describe("cellText", () => {
  it.each([
    [{ amount: -1234, currency: "BRL" }, "-12.34 BRL"],
    [{ amount: 7, currency: "PETR4" }, "7 PETR4"],
    ["0b9a6c1e-2f43-4d1a-9a55-7c1f0e3d2b10", "Checking · 0b9a6c1e"],
    [
      "5d1f3a20-9c1b-4e7a-8f00-2a6b4c8d9e01",
      "5d1f3a20-9c1b-4e7a-8f00-2a6b4c8d9e01",
    ],
    ["2026-10-19", "2026-10-19"],
    [true, "true"],
    [undefined, ""],
    [null, ""],
    [["a", "b"], '["a","b"]'],
    [{ from: "2026-01-01" }, '{"from":"2026-01-01"}'],
  ])("renders %j as %s", (value, text) => {
    expect(cellText(value, { names, scaleOf })).toBe(text);
  });
});

describe("postingSums", () => {
  it("adds the weight in its currency and the amount otherwise", () => {
    expect(
      postingSums([
        {
          amount: { amount: -500, currency: "USD" },
          weight: { amount: -2600, currency: "BRL" },
        },
        { amount: { amount: 2600, currency: "BRL" } },
        { amount: { amount: 100, currency: "BRL" } },
        { amount: { amount: -100, currency: "BRL" } },
      ]),
    ).toEqual({ BRL: 0 });
  });

  it("keeps a currency that does not balance", () => {
    expect(
      postingSums([
        { amount: { amount: -1000, currency: "BRL" } },
        { amount: { amount: 999, currency: "BRL" } },
      ]),
    ).toEqual({ BRL: -1 });
  });
});

describe("fillPath", () => {
  it("replaces each parameter with its encoded value", () => {
    expect(
      fillPath("/connections/{id}/accounts/{external_account_id}", {
        id: "a b",
        external_account_id: "c",
      }),
    ).toBe("/connections/a%20b/accounts/c");
  });

  it("keeps a parameter without a value as written", () => {
    expect(fillPath("/accounts/{id}", {})).toBe("/accounts/{id}");
  });
});
