import { screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import { EntryTotals } from "@/features/reports/entry-totals";
import type { EntryRow } from "@/features/reports/net-worth-days";
import { fakeApi } from "@/testing/fake-api";
import { hideAmounts } from "@/testing/privacy";
import { renderWithProviders } from "@/testing/render-app";

function entry(kind: EntryRow["kind"], amount: number): EntryRow {
  return {
    key: kind,
    date: "2026-10-05",
    description: "d",
    category: "c",
    kind,
    amount,
  };
}

// Income 1000, expense 400 and result -200 need an income of 200 beside the expense of 400.
const rows = [entry("income", 1000), entry("expense", -400)];
const lossRows = [entry("income", 200), entry("expense", -400)];

function tones(): string[] {
  return ["Income", "Expenses", "Result"].map(
    (label) =>
      screen.getByText(label).nextElementSibling?.getAttribute("data-tone") ??
      "inherit",
  );
}

describe("EntryTotals", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("reads income in success and expenses in the text's own tone", () => {
    renderWithProviders(<EntryTotals rows={rows} currency="BRL" digits={2} />, {
      fetch: fakeApi({}),
    });

    expect(tones()).toEqual(["success", "inherit", "success"]);
  });

  it("reads a negative result in the danger tone", () => {
    renderWithProviders(
      <EntryTotals rows={lossRows} currency="BRL" digits={2} />,
      { fetch: fakeApi({}) },
    );

    expect(tones()).toEqual(["success", "inherit", "danger"]);
  });

  it("keeps the text's own tone when the amounts are hidden", () => {
    hideAmounts();
    renderWithProviders(
      <EntryTotals rows={lossRows} currency="BRL" digits={2} />,
      { fetch: fakeApi({}) },
    );

    expect(tones()).toEqual(["inherit", "inherit", "inherit"]);
  });
});
