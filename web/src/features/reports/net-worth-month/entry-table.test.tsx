import { screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import { EntryTable } from "@/features/reports/net-worth-month/entry-table";
import type { EntryRow } from "@/features/reports/net-worth-month/net-worth-days";
import { fakeApi } from "@/testing/fake-api";
import { hideAmounts } from "@/testing/privacy";
import { renderWithProviders } from "@/testing/render-app";

function entry(amount: number): EntryRow {
  return {
    key: "k",
    date: "2026-10-05",
    description: "Entry",
    category: "Cat",
    kind: amount > 0 ? "income" : "expense",
    amount,
  };
}

function amountTone(): string {
  const cells = within(
    screen.getAllByRole("row").slice(1)[0] ?? document.body,
  ).getAllByRole("cell");

  return (
    cells.at(-1)?.firstElementChild?.getAttribute("data-tone") ?? "inherit"
  );
}

describe("EntryTable", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it.each([
    ["money in", 1000, "success"],
    ["money out", -1000, "inherit"],
  ] as const)("reads %s", (_name, amount, tone) => {
    renderWithProviders(
      <EntryTable
        rows={[entry(amount)]}
        day={undefined}
        currency="BRL"
        digits={2}
      />,
      { fetch: fakeApi({}) },
    );

    expect(amountTone()).toBe(tone);
  });

  it("keeps the text's own tone when the amounts are hidden", () => {
    hideAmounts();
    renderWithProviders(
      <EntryTable
        rows={[entry(1000)]}
        day={undefined}
        currency="BRL"
        digits={2}
      />,
      { fetch: fakeApi({}) },
    );

    expect(amountTone()).toBe("inherit");
  });
});
