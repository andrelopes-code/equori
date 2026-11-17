import { screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import { HoldingValueCell } from "@/features/portfolio/holdings/holding-value-cell";
import type { Holding } from "@/features/portfolio/model/portfolio-holdings";
import { fakeApi } from "@/testing/fake-api";
import { renderWithProviders } from "@/testing/render-app";

const at = "2026-11-03T14:58:00Z";

function holding(prices: object[]): Holding {
  return { value: 1000, position: { prices } } as unknown as Holding;
}

function renderCell(prices: object[]) {
  renderWithProviders(
    <HoldingValueCell
      holding={holding(prices)}
      valueIn="BRL"
      date="2026-11-03"
    />,
    { fetch: fakeApi({}) },
  );
}

describe("HoldingValueCell", () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem(
      "equori.locale",
      JSON.stringify({ language: "pt", region: "BR" }),
    );
  });

  it("marks a partial current quote with its hour", async () => {
    renderCell([{ date: "2026-11-03", at, open: true }]);

    expect(await screen.findByText(/^\d{2}:\d{2} · parcial$/)).toBeTruthy();
    expect(screen.queryByText(/Preço de/)).toBeNull();
  });

  it("states the hour of a closed-session quote", async () => {
    renderCell([{ date: "2026-11-03", at, open: false }]);

    expect(await screen.findByText(/^Cotação de \d{2}:\d{2}$/)).toBeTruthy();
  });

  it("states no quote for a close", async () => {
    renderCell([{ date: "2026-11-03" }]);

    await screen.findByText(/1\.000/);
    expect(screen.queryByText(/parcial|Cotação de/)).toBeNull();
  });

  it("keeps the label of a late price over a current quote", async () => {
    renderCell([
      { date: "2026-10-01" },
      { date: "2026-11-03", at, open: true },
    ]);

    expect(await screen.findByText(/^Preço de /)).toBeTruthy();
    expect(screen.queryByText(/parcial/)).toBeNull();
  });
});
