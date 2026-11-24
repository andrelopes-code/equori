import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { catalogEn } from "@/i18n/catalog.en";
import { json } from "@/testing/fake-api";
import { historySeries, portfolioApi } from "@/testing/portfolio-api";
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

describe("Portfolio results tab: the return block", () => {
  // PR1, PR3, PR4, PR5, PR6.
  it("draws the return against the index and asks the period at its step", async () => {
    const urls: string[] = [];
    const fetch = portfolioApi({
      "GET /api/v1/reports/return/series": (req) => {
        urls.push(req.url);
        return json(200, historySeries);
      },
    });
    const { router } = await renderApp("/portfolio/results", {
      fetch,
      today: "2025-12-31",
    });

    const section = await screen.findByRole("region", {
      name: catalogEn["portfolio.results.return"],
    });
    expect(await within(section).findByText("+3.02%")).toBeInTheDocument();
    expect(within(section).getByText(/2\.02 pp above CDI/)).toBeInTheDocument();

    const list = within(section).getByRole("list", {
      name: catalogEn["portfolio.results.series"],
    });
    expect(within(list).getAllByRole("listitem")[0]).toHaveTextContent(
      /Portfolio\s*3\.02%/,
    );
    const cdi = within(list).getByRole("switch", { name: /CDI/ });
    expect(cdi).toHaveAttribute("aria-checked", "true");
    expect(cdi).toHaveTextContent("1.00%");

    for (const label of ["Per year", "Volatility"]) {
      expect(
        within(section).getByText(label).nextElementSibling,
      ).toHaveTextContent("under 12 months");
    }
    expect(
      screen.getByRole("combobox", {
        name: catalogEn["portfolio.results.account"],
      }),
    ).toBeInTheDocument();
    expect(
      urls.some((u) => u.includes("step=month") && !u.includes("from=")),
    ).toBe(true);

    await userEvent.click(screen.getByRole("radio", { name: "12 months" }));

    await waitFor(() => {
      expect(router.state.location.search).toMatchObject({ period: "12m" });
    });
    await waitFor(() => {
      expect(
        urls.some(
          (u) => u.includes("from=2025-01-01") && u.includes("step=week"),
        ),
      ).toBe(true);
    });
  });

  // Edge case: a region without an index draws no switch and no comparison sentence.
  it("draws no switch and no comparison without an index", async () => {
    const fetch = portfolioApi({
      "GET /api/v1/reports/return/series": () =>
        json(200, { ...historySeries, indexes: [] }),
    });
    await renderApp("/portfolio/results", { fetch, today: "2025-12-31" });

    const section = await screen.findByRole("region", {
      name: catalogEn["portfolio.results.return"],
    });
    expect(await within(section).findByText("+3.02%")).toBeInTheDocument();
    expect(within(section).queryByRole("switch")).not.toBeInTheDocument();
    expect(within(section).queryByText(/pp above/)).not.toBeInTheDocument();
  });
});
