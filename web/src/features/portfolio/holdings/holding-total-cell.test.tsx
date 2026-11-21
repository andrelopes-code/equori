import { screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import { HoldingTotalCell } from "@/features/portfolio/holdings/holding-total-cell";
import type { Holding } from "@/features/portfolio/model/portfolio-holdings";
import { catalogEn } from "@/i18n/catalog.en";
import { fakeApi, json } from "@/testing/fake-api";
import { renderWithProviders } from "@/testing/render-app";

const instruments = fakeApi({
  "GET /api/v1/instruments": () =>
    json(200, {
      items: [{ code: "BRL", type: "currency", scale: 2, name: "Real" }],
    }),
});

function holding(total: number | undefined, totalOutside = false): Holding {
  return { total, totalOutside } as Holding;
}

describe("HoldingTotalCell", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it.each([
    ["a gain", 500, "+R$5.00", "success"],
    ["a loss", -2850, "−R$28.50", "danger"],
  ] as const)(
    "reads %s in the tone of its sign (TR3)",
    async (_name, total, text, tone) => {
      renderWithProviders(
        <HoldingTotalCell holding={holding(total)} valueIn="BRL" />,
        { fetch: instruments },
      );

      expect((await screen.findByText(text)).getAttribute("data-tone")).toBe(
        tone,
      );
    },
  );

  it("names why a part in another currency leaves no total", () => {
    renderWithProviders(
      <HoldingTotalCell holding={holding(undefined, true)} valueIn="BRL" />,
      { fetch: fakeApi({}) },
    );

    expect(
      screen.getByRole("img", { name: catalogEn["portfolio.totalOutside"] }),
    ).toBeInTheDocument();
  });

  it("draws nothing without a total", () => {
    const { container } = renderWithProviders(
      <HoldingTotalCell holding={holding(undefined)} valueIn="BRL" />,
      { fetch: fakeApi({}) },
    );

    expect(container.textContent).toBe("");
  });
});
