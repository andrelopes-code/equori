import { screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import { IndicatorsBlock } from "@/features/overview/indicators-block";
import { catalogEn } from "@/i18n/catalog.en";
import { fakeApi, json } from "@/testing/fake-api";
import { expectNoAmounts, hideAmounts } from "@/testing/privacy";
import { renderWithRouter } from "@/testing/render-app";
import { indicatorsFixture, reportApiRoutes } from "@/testing/report-api";

type Fixture = ReturnType<typeof indicatorsFixture>;

function renderBlock(fixture: Fixture = indicatorsFixture()) {
  return renderWithRouter(<IndicatorsBlock month="2026-10" />, {
    path: "/",
    fetch: fakeApi({
      ...reportApiRoutes(),
      "GET /api/v1/reports/indicators": () => json(200, fixture),
    }),
  });
}

describe("IndicatorsBlock", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("S154: shows the four indicators of the month", async () => {
    renderBlock();
    expect(await screen.findByText("43.00%")).toBeInTheDocument();
    expect(screen.getByText("6.7 months")).toBeInTheDocument();
    expect(screen.getByText("1.00%")).toBeInTheDocument();
    expect(screen.getByText("25.00%")).toBeInTheDocument();
    expect(
      screen.getAllByText(
        catalogEn["overview.indicators.savingsNote"].replace(
          "{mean}",
          "46.50%",
        ),
      ).length,
    ).toBeGreaterThan(0);
  });

  it("states why an indicator has no value", async () => {
    renderBlock(indicatorsFixture({ liquidity: { reason: "no_expense" } }));
    expect(
      (
        await screen.findAllByText(
          catalogEn["overview.indicators.reason.no_expense"],
        )
      ).length,
    ).toBeGreaterThan(0);
  });

  it("hides debt payments without liabilities", async () => {
    const zero = { amount: 0, currency: "BRL" };
    renderBlock(indicatorsFixture({ liabilities: zero, debt_service: zero }));
    await screen.findByText("43.00%");
    expect(
      screen.queryByText(catalogEn["overview.indicators.debt"]),
    ).toBeNull();
  });

  it("masks amounts and keeps ratios in privacy mode", async () => {
    hideAmounts();
    const { container } = renderBlock();
    await screen.findByText("43.00%");
    const amounts = document.createElement("div");
    amounts.innerHTML = container.innerHTML.replace(/[\d.,]+\s?%/g, "");
    expectNoAmounts(amounts, ["17,900.00", "2,675.00"]);
  });
});
