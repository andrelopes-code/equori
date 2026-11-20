import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { catalogEn } from "@/i18n/catalog.en";
import { json } from "@/testing/fake-api";
import { portfolioApi } from "@/testing/portfolio-api";
import { renderApp } from "@/testing/render-app";

const brl = (amount: number) => ({ amount, currency: "BRL" });

// S656 to S658 as the API returns them, with one year of a stale holding.
const report = {
  years: [
    {
      year: 2025,
      from: "2025-01-01",
      to: "2025-12-31",
      result: brl(-5000),
      period_bp: -50,
      other: brl(0),
      items: [
        { instrument: "MXRF11", result: brl(15000), return_bp: 1542 },
        { instrument: "PETR4", result: brl(-20000), stale_since: "2025-06-30" },
      ],
    },
    {
      year: 2026,
      from: "2026-01-01",
      to: "2026-11-01",
      result: brl(44700),
      period_bp: 445,
      other: brl(200),
      items: [
        { instrument: "PETR4", result: brl(34500), return_bp: 3734 },
        { instrument: "MXRF11", result: brl(10000), return_bp: 909 },
      ],
    },
  ],
};

const section = () =>
  screen.findByRole("region", {
    name: catalogEn["portfolio.attribution.title"],
  });

describe("Attribution section", () => {
  it("AT1, AT3: opens on the current year with its sentence, its rows and the portfolio", async () => {
    await renderApp("/portfolio", {
      fetch: portfolioApi({
        "GET /api/v1/reports/attribution": () => json(200, report),
      }),
    });
    const region = await section();

    expect(
      await within(region).findByText(
        "In 2026 to 11/01, the portfolio gained R$447.00.",
      ),
    ).toBeInTheDocument();
    expect(
      within(region).getByText("2 holdings added R$445.00."),
    ).toBeInTheDocument();

    const rows = within(region).getAllByRole("listitem");
    expect(rows.map((r) => r.textContent)).toEqual([
      "PETR4+R$345.0037.34%",
      "MXRF11+R$100.009.09%",
      `${catalogEn["portfolio.attribution.other"]}+R$2.00`,
      `${catalogEn["portfolio.attribution.total"]}+R$447.004.45%`,
    ]);
  });

  it("AT5: a past year writes the date of a stale quote in place of the bar and the rate", async () => {
    await renderApp("/portfolio", {
      fetch: portfolioApi({
        "GET /api/v1/reports/attribution": () => json(200, report),
      }),
    });
    const region = await section();

    await userEvent
      .setup()
      .click(await within(region).findByRole("radio", { name: "2025" }));

    expect(
      within(region).getByText("In 2025, the portfolio lost R$50.00."),
    ).toBeInTheDocument();
    expect(
      within(region).getByText(
        "1 holding added R$150.00; 1 took away R$200.00.",
      ),
    ).toBeInTheDocument();
    expect(
      within(region).getByText("No quote since 06/30/2025"),
    ).toBeInTheDocument();
    expect(
      within(region).queryByText(catalogEn["portfolio.attribution.other"]),
    ).not.toBeInTheDocument();
  });

  it("AT6: a year without a quote names the holdings", async () => {
    await renderApp("/portfolio", {
      fetch: portfolioApi({
        "GET /api/v1/reports/attribution": () =>
          json(200, {
            years: [
              {
                year: 2025,
                from: "2025-01-01",
                to: "2025-12-31",
                missing: ["PETR4"],
              },
            ],
          }),
      }),
    });
    const region = await section();

    expect(
      await within(region).findByText(
        "No quote of PETR4 at the year end: the year cannot be measured.",
      ),
    ).toBeInTheDocument();
  });

  it("draws nothing for a book with no measured year", async () => {
    await renderApp("/portfolio", { fetch: portfolioApi() });

    await screen.findByRole("region", { name: catalogEn["holdings.return"] });

    expect(
      screen.queryByRole("region", {
        name: catalogEn["portfolio.attribution.title"],
      }),
    ).not.toBeInTheDocument();
  });
});
