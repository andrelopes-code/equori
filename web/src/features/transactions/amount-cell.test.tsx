import { screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import { AmountCell } from "@/features/transactions/amount-cell";
import type { ListRow } from "@/features/transactions/use-transaction-list";
import { fakeApi } from "@/testing/fake-api";
import { hideAmounts } from "@/testing/privacy";
import { renderWithProviders } from "@/testing/render-app";

function row(amount: number, extra: Partial<ListRow> = {}): ListRow {
  return {
    money: { amount, currency: "BRL" },
    transfer: false,
    voided: false,
    ...extra,
  } as ListRow;
}

function toneOfText(text: string): string {
  return screen.getByText(text).getAttribute("data-tone") ?? "inherit";
}

describe("AmountCell", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it.each([
    ["money in", row(1000), "success"],
    ["money out", row(-1000), "inherit"],
    ["a transfer", row(1000, { transfer: true }), "inherit"],
    ["a voided transaction", row(1000, { voided: true }), "muted"],
  ] as const)("reads %s", (_name, input, tone) => {
    renderWithProviders(<AmountCell row={input} text="R$ 10,00" />, {
      fetch: fakeApi({}),
    });

    expect(toneOfText("R$ 10,00")).toBe(tone);
  });

  it("keeps the text's own tone when the amounts are hidden", () => {
    hideAmounts();
    renderWithProviders(<AmountCell row={row(1000)} text="••••" />, {
      fetch: fakeApi({}),
    });

    expect(toneOfText("••••")).toBe("inherit");
  });
});
