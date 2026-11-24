import { screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { catalogEn } from "@/i18n/catalog.en";
import { json } from "@/testing/fake-api";
import { portfolioApi } from "@/testing/portfolio-api";
import { renderApp } from "@/testing/render-app";

const brl = (amount: number) => ({ amount, currency: "BRL" });

const report = {
  years: [
    {
      year: 2025,
      from: "2025-01-01",
      to: "2025-12-31",
      since: "2025-01-02",
      result: brl(-5000),
      capital: brl(997253),
      return_bp: -50,
      other: { result: brl(0), weight_bp: 7066, contribution_bp: 0 },
      items: [
        {
          instrument: "MXRF11",
          result: brl(15000),
          weight_bp: 978,
          contribution_bp: 150,
          return_bp: 1504,
        },
      ],
    },
  ],
};

describe("Portfolio results page", () => {
  // PT1, PT2: the route holds "Rendimento por ativo" under the area header.
  it("PT1: opens the results route with the heading, the selected tab and the attribution", async () => {
    const fetch = portfolioApi({
      "GET /api/v1/reports/attribution": () => json(200, report),
    });
    await renderApp("/portfolio/results", { fetch });

    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: catalogEn["nav.portfolio"],
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("tab", { name: catalogEn["portfolio.tabs.results"] }),
    ).toHaveAttribute("aria-selected", "true");
    expect(
      await screen.findByRole("region", {
        name: catalogEn["portfolio.attribution.title"],
      }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("grid", { name: catalogEn["holdings.list"] }),
    ).not.toBeInTheDocument();
  });

  it("PT3: draws the trade action in the header with the currency control", async () => {
    await renderApp("/portfolio/results", { fetch: portfolioApi() });
    const currency = await screen.findByRole("combobox", {
      name: catalogEn["portfolio.valueIn"],
    });
    const header =
      currency.closest<HTMLElement>('[data-ui="page-header"]') ?? document.body;

    expect(
      within(header).getByRole("link", {
        name: catalogEn["holdings.trade"],
      }),
    ).toHaveAttribute("href", "/transactions/new?kind=trade");
  });
});
