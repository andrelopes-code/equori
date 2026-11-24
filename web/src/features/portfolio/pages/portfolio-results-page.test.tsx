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

describe("Portfolio results tab: the rolling windows block", () => {
  // PR7: the windows read the history, with no index the block draws four tiles.
  it("draws the tiles of the windows of a history of 13 months", async () => {
    const fetch = portfolioApi({
      "GET /api/v1/reports/return/series": () =>
        json(200, monthlyHistory(13, "2025-11-01", "2026-11-24")),
    });
    await renderApp("/portfolio/results", { fetch, today: "2026-11-24" });

    const section = await screen.findByRole("region", {
      name: catalogEn["portfolio.results.windows"],
    });
    const today = await within(section).findByText("Today");
    expect(tileOf(today)).toHaveTextContent(
      /\+12\.68%12 months to 11\/24\/2026/,
    );
    expect(tileOf(within(section).getByText("Best window"))).toHaveTextContent(
      /\+12\.68%to Nov 2026/,
    );
    expect(tileOf(within(section).getByText("Worst window"))).toHaveTextContent(
      /\+12\.68%to Oct 2026/,
    );
    expect(
      tileOf(within(section).getByText("Windows below zero")),
    ).toHaveTextContent("0.0%0 of 2");
    expect(within(section).getAllByText(/ of 2$/)).toHaveLength(1);
    expect(within(section).queryByText(/^Above /)).not.toBeInTheDocument();
  });

  // PR7: with an index the block adds the tile of the windows above it.
  it("draws the share of the windows above the first index", async () => {
    const history = monthlyHistory(13, "2025-11-01", "2026-11-24");
    const fetch = portfolioApi({
      "GET /api/v1/reports/return/series": () =>
        json(200, {
          ...history,
          indexes: [
            {
              index: "cdi",
              period: "day",
              points: history.points.map((p, k) => ({
                date: p.date,
                return_bp: Math.round((1.005 ** (k + 1) - 1) * 10000),
              })),
            },
          ],
        }),
    });
    await renderApp("/portfolio/results", { fetch, today: "2026-11-24" });

    const section = await screen.findByRole("region", {
      name: catalogEn["portfolio.results.windows"],
    });
    const above = await within(section).findByText("Above CDI");

    expect(tileOf(above)).toHaveTextContent("100.0%2 of 2");
  });

  // PR7: under 12 months the block states the date its first window closes.
  it("states when the first window closes with a history of 5 months", async () => {
    const fetch = portfolioApi({
      "GET /api/v1/reports/return/series": () =>
        json(200, monthlyHistory(5, "2026-07-06", "2026-11-24")),
    });
    await renderApp("/portfolio/results", { fetch, today: "2026-11-24" });

    const section = await screen.findByRole("region", {
      name: catalogEn["portfolio.results.windows"],
    });

    expect(
      await within(section).findByText(
        "The first window closes on 07/06/2027: the portfolio has 5 months of history and a window takes 12.",
      ),
    ).toBeInTheDocument();
    expect(within(section).queryByText("Today")).not.toBeInTheDocument();
  });
});

describe("Portfolio results tab: the month by month block", () => {
  // PR8: the table reads the history, heat classes by size, the comparison subtracts the index.
  it("draws the table of the months, the facts and the comparison with an index", async () => {
    const fetch = portfolioApi({
      "GET /api/v1/reports/return/series": () => json(200, historySeries),
    });
    await renderApp("/portfolio/results", { fetch, today: "2025-12-31" });

    const section = await screen.findByRole("region", {
      name: catalogEn["portfolio.results.months"],
    });
    const table = await within(section).findByRole("table", {
      name: catalogEn["portfolio.results.months.caption"],
    });
    const row = within(table)
      .getByRole("rowheader", { name: "2025" })
      .closest("tr");
    const cells = within(row ?? table).getAllByRole("cell");

    expect(cells.map((c) => c.textContent)).toEqual([
      ...Array<string>(10).fill("–"),
      "1.00",
      "2.00",
      "3.02",
      "3.02",
    ]);
    expect(cells[10]).toHaveClass(/gain2/);
    expect(cells[11]).toHaveClass(/gain2/);
    expect(within(table).getAllByRole("columnheader")[1]).toHaveTextContent(
      "Jan",
    );
    expect(
      within(section).getByText("Best month").nextElementSibling,
    ).toHaveTextContent("+2.00% · Dec-2025");
    expect(
      within(section).getByText("Months above zero").nextElementSibling,
    ).toHaveTextContent("2 of 2");

    await userEvent.click(
      within(section).getByRole("combobox", {
        name: catalogEn["portfolio.results.months.compare"],
      }),
    );
    await userEvent.click(await screen.findByRole("option", { name: "CDI" }));

    await waitFor(() => {
      expect(within(row ?? table).getAllByRole("cell")[10]).toHaveTextContent(
        "0.50",
      );
    });
  });
});

// A history of `count` months of +1% each, the last point on `to`, with no index.
function monthlyHistory(count: number, from: string, to: string) {
  const end = new Date(`${to}T00:00:00Z`);
  const points = Array.from({ length: count }, (_, k) => {
    const last = k === count - 1;
    const day = new Date(
      Date.UTC(
        end.getUTCFullYear(),
        end.getUTCMonth() - (count - 1 - k) + 1,
        0,
      ),
    );

    return {
      date: last ? to : day.toISOString().slice(0, 10),
      value: 100000,
      flows: 0,
      return_bp: Math.round((1.01 ** (k + 1) - 1) * 10000),
    };
  });

  return { from, to, currency: "BRL", opening: 100000, points, indexes: [] };
}

function tileOf(label: HTMLElement): HTMLElement {
  return label.parentElement ?? label;
}

describe("Portfolio results tab: the evolution block", () => {
  // PR9: the bridge from the opening value to the closing value, in minor units of the series.
  it("lists the opening value, the net contributions, the return and the closing value", async () => {
    const history = {
      from: "2025-10-01",
      to: "2025-12-31",
      currency: "BRL",
      opening: 0,
      points: [
        { date: "2025-10-31", value: 100000, flows: 100000 },
        { date: "2025-11-30", value: 101000, flows: 0 },
        { date: "2025-12-31", value: 203020, flows: 100000 },
      ],
      indexes: [],
    };
    const fetch = portfolioApi({
      "GET /api/v1/reports/return/series": () => json(200, history),
    });
    await renderApp("/portfolio/results", { fetch, today: "2025-12-31" });

    const section = await screen.findByRole("region", {
      name: catalogEn["portfolio.results.evolution"],
    });

    const rows: [string, RegExp][] = [
      ["Opening value", /^R\$\s*0\.00$/],
      ["Net contributions", /^\+R\$\s*2,000\.00$/],
      ["Return", /^\+R\$\s*30\.20$/],
      ["Closing value", /^R\$\s*2,030\.20$/],
      ["Annual rate (IRR)", /^under 12 months$/],
    ];
    for (const [label, value] of rows) {
      const term = await within(section).findByText(label);
      expect(term.nextElementSibling).toHaveTextContent(value);
    }
  });
});
