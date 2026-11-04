import { DashboardGrid } from "@slotted/react/dashboard-grid";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";

import { indicatorFigures } from "@/features/overview/indicator-figures";
import { catalogEn } from "@/i18n/catalog.en";
import { fakeApi, json } from "@/testing/fake-api";
import { expectNoAmounts, hideAmounts } from "@/testing/privacy";
import { renderWithRouter } from "@/testing/render-app";
import { indicatorsFixture, reportApiRoutes } from "@/testing/report-api";

type Fixture = ReturnType<typeof indicatorsFixture>;

function Indicators() {
  return (
    <DashboardGrid aria-label="Overview blocks">
      {indicatorFigures("2026-10", (key) => catalogEn[key])}
    </DashboardGrid>
  );
}

function renderBlock(fixture: Fixture = indicatorsFixture()) {
  return renderWithRouter(<Indicators />, {
    path: "/",
    fetch: fakeApi({
      ...reportApiRoutes(),
      "GET /api/v1/reports/indicators": () => json(200, fixture),
    }),
  });
}

describe("indicator figures", () => {
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

  it("names each indicator widget by the ratio it shows", async () => {
    renderBlock();

    await screen.findByText("43.00%");

    for (const name of [
      "Savings rate",
      "Liquidity",
      "Committed income",
      "Debt to income",
    ]) {
      expect(screen.getByRole("article", { name })).toBeInTheDocument();
    }
  });

  it("explains each indicator behind an About control and keeps the note to its inputs", async () => {
    const user = userEvent.setup();
    renderBlock();

    await screen.findByText("43.00%");

    for (const [name, help] of [
      ["Savings rate", catalogEn["overview.indicators.savingsHelp"]],
      ["Liquidity", catalogEn["overview.indicators.reserveHelp"]],
      ["Committed income", catalogEn["overview.indicators.committedHelp"]],
      ["Debt to income", catalogEn["overview.indicators.debtHelp"]],
    ] as const) {
      const widget = screen.getByRole("article", { name });

      expect(widget).not.toHaveTextContent(help);

      await user.click(
        within(widget).getByRole("button", { name: `About ${name}` }),
      );

      expect(await screen.findByText(help)).toBeVisible();

      await user.keyboard("{Escape}");
    }
  });

  it("draws the 12 months of an indicator that holds two values or more", async () => {
    renderBlock();

    await screen.findByText("43.00%");

    expect(
      screen.getByRole("img", {
        name: /^Savings rate by month: 43\.00%/,
      }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("img", { name: /^Liquidity/ })).toBeNull();
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

  it("reads no debt payments without liabilities", async () => {
    const zero = { amount: 0, currency: "BRL" };
    renderBlock(indicatorsFixture({ liabilities: zero, debt_service: zero }));
    await screen.findByText("43.00%");
    const debt = screen.getByRole("article", {
      name: catalogEn["overview.indicators.debt"],
    });
    expect(debt).toHaveTextContent(catalogEn["overview.indicators.noDebt"]);
    expect(debt).not.toHaveTextContent("%");
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
