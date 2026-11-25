import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";

import { catalogEn } from "@/i18n/catalog.en";
import { json, problem } from "@/testing/fake-api";
import { cashID } from "@/testing/investment-api";
import {
  historySeries,
  portfolioApi,
  positions,
} from "@/testing/portfolio-api";
import { renderApp } from "@/testing/render-app";

const brl = (amount: number) => ({ amount, currency: "BRL" });

// A column of the list can share the label of a figure, so the figure is the match inside a card.
const figure = async (label: string) =>
  (await screen.findAllByText(label))
    .map((e) => e.closest<HTMLElement>("[data-ui='stat-card']"))
    .find((card) => card !== null) ?? document.body;

const pageHeader = () =>
  document.querySelector<HTMLElement>("[data-ui='page-header']") ??
  document.body;

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
    await renderApp("/portfolio", { fetch });

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
    await renderApp("/portfolio", { fetch: portfolioApi() });
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
    const { router } = await renderApp("/portfolio", {
      fetch,
      today: "2025-12-31",
    });

    const section = await loadedSection(catalogEn["portfolio.results.return"]);
    expect(await within(section).findByText("+3.02%")).toBeInTheDocument();
    const above = within(section).getByText("2.02 pp above");
    expect(above).toHaveClass(/gain/);
    expect(above.parentElement).toHaveTextContent(
      "2.02 pp above CDI over the same days.",
    );

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
    await renderApp("/portfolio", { fetch, today: "2025-12-31" });

    const section = await loadedSection(catalogEn["portfolio.results.return"]);
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
    await renderApp("/portfolio", { fetch, today: "2026-11-24" });

    const section = await loadedSection(catalogEn["portfolio.results.windows"]);
    const today = await within(section).findByText("Today");
    expect(tileOf(today)).toHaveTextContent(
      /\+12\.68%12 months to 11\/24\/2026/,
    );
    expect(tileOf(within(section).getByText("Best window"))).toHaveTextContent(
      /\+12\.68%to Nov\/2026/,
    );
    expect(tileOf(within(section).getByText("Worst window"))).toHaveTextContent(
      /\+12\.68%to Oct\/2026/,
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
    await renderApp("/portfolio", { fetch, today: "2026-11-24" });

    const section = await loadedSection(catalogEn["portfolio.results.windows"]);
    const above = await within(section).findByText("Above CDI");

    expect(tileOf(above)).toHaveTextContent("100.0%2 of 2");
  });

  // PR7: under 12 months the block states the date its first window closes.
  it("states when the first window closes with a history of 5 months", async () => {
    const fetch = portfolioApi({
      "GET /api/v1/reports/return/series": () =>
        json(200, monthlyHistory(5, "2026-07-06", "2026-11-24")),
    });
    await renderApp("/portfolio", { fetch, today: "2026-11-24" });

    const section = await loadedSection(catalogEn["portfolio.results.windows"]);

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
    await renderApp("/portfolio", { fetch, today: "2025-12-31" });

    const section = await loadedSection(catalogEn["portfolio.results.months"]);
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
    ).toHaveTextContent("+2.00% · Dec/2025");
    expect(
      within(section).getByText("Months above zero").nextElementSibling,
    ).toHaveTextContent("2 of 2");
    expect(
      within(section).getByText("Months above zero").nextElementSibling
        ?.firstElementChild,
    ).toHaveClass(/gain/);

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
    await renderApp("/portfolio", { fetch, today: "2025-12-31" });

    const section = await loadedSection(
      catalogEn["portfolio.results.evolution"],
    );

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

describe("Portfolio results tab: pending, empty and failed", () => {
  // PR11: while the history is pending, the four sections draw their labels and no figure.
  it("draws the headings of the four sections and no figure while the series is pending", async () => {
    const fetch = portfolioApi({
      "GET /api/v1/reports/return/series": () =>
        new Promise<Response>(() => undefined),
    });
    await renderApp("/portfolio", { fetch, today: "2025-12-31" });

    const names = [
      "portfolio.results.return",
      "portfolio.results.windows",
      "portfolio.results.months",
      "portfolio.results.evolution",
    ] as const;
    for (const name of names) {
      const section = await screen.findByRole("region", {
        name: catalogEn[name],
      });
      expect(section).toHaveAttribute("aria-busy", "true");
      expect(
        within(section).getByRole("heading", { name: catalogEn[name] }),
      ).toBeInTheDocument();
      expect(within(section).queryByText(/\d%/)).not.toBeInTheDocument();
    }

    const list = screen.getByRole("list", {
      name: catalogEn["portfolio.results.series"],
    });
    expect(within(list).getByText("Portfolio")).toBeInTheDocument();
  });

  // PR11: a portfolio with no point in its history draws the empty state and no section.
  it("draws the empty state in place of the sections with an empty portfolio", async () => {
    const fetch = portfolioApi({
      "GET /api/v1/reports/return/series": () =>
        json(200, { ...historySeries, points: [], indexes: [] }),
    });
    await renderApp("/portfolio", { fetch, today: "2025-12-31" });

    expect(
      await screen.findByText(catalogEn["portfolio.empty"]),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("region", {
        name: catalogEn["portfolio.results.return"],
      }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("radio", { name: "12 months" }),
    ).not.toBeInTheDocument();
  });

  // PR11: a failed series draws the failure in the first section and asks again on retry.
  it("draws the failure and asks the series again on retry", async () => {
    let asked = 0;
    const fetch = portfolioApi({
      "GET /api/v1/reports/return/series": () => {
        asked += 1;

        return json(500, { title: "Server error", status: 500 });
      },
    });
    await renderApp("/portfolio", { fetch, today: "2025-12-31" });

    expect(
      await screen.findByText(catalogEn["portfolio.results.failed"]),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("region", {
        name: catalogEn["portfolio.results.windows"],
      }),
    ).not.toBeInTheDocument();

    const before = asked;
    await userEvent.click(
      screen.getByRole("button", { name: catalogEn["common.retry"] }),
    );

    await waitFor(() => {
      expect(asked).toBeGreaterThan(before);
    });
  });
});

// The region of a block once its read has answered: a pending block is busy.
async function loadedSection(name: string) {
  return waitFor(() => {
    const section = screen.getByRole("region", { name });
    expect(section).not.toHaveAttribute("aria-busy");

    return section;
  });
}

describe("Portfolio results page: the figures", () => {
  afterEach(() => {
    localStorage.removeItem("equori.locale");
    localStorage.removeItem("equori.privacy");
  });

  it("PT1: lists four tabs, none of them the summary", async () => {
    await renderApp("/portfolio", { fetch: portfolioApi() });
    const list = await screen.findByRole("tablist", {
      name: catalogEn["portfolio.tabs.label"],
    });

    expect(
      within(list)
        .getAllByRole("tab")
        .map((e) => e.textContent),
    ).toEqual([
      catalogEn["portfolio.tabs.results"],
      catalogEn["portfolio.tabs.positions"],
      catalogEn["portfolio.tabs.year"],
      catalogEn["portfolio.tabs.contributions"],
    ]);
    expect(
      within(list).getByRole("tab", {
        name: catalogEn["portfolio.tabs.results"],
      }),
    ).toHaveAttribute("aria-selected", "true");
  });

  it("PT1: sends the former results address to /portfolio with its search", async () => {
    const { router } = await renderApp("/portfolio/results?period=12m", {
      fetch: portfolioApi(),
    });

    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/portfolio");
    });
    expect(router.state.location.search).toMatchObject({ period: "12m" });
  });

  it("PT2: draws the figures above the period bar", async () => {
    await renderApp("/portfolio", { fetch: portfolioApi() });
    const card = await figure(catalogEn["holdings.value"]);
    const bar = await screen.findByRole("radio", { name: "12 months" });

    expect(
      card.compareDocumentPosition(bar) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("PC2: states one value, its parts and the unpriced rows", async () => {
    await renderApp("/portfolio", { fetch: portfolioApi() });
    const card = await figure(catalogEn["holdings.value"]);

    await within(card).findByText("R$541.00");
    expect(card.textContent).toContain(
      catalogEn["holdings.value.note"]
        .replace("{positions}", "R$141.00")
        .replace("{cash}", "R$400.00"),
    );
    expect(card.textContent).toContain(
      catalogEn["holdings.value.unpriced"].replace("{count}", "1"),
    );
  });

  it("PC2: measures the gain on the positions with one currency and says what it leaves out", async () => {
    await renderApp("/portfolio", { fetch: portfolioApi() });
    const card = await figure(catalogEn["holdings.gain"]);

    await within(card).findByText("+R$10.00");
    expect(card.textContent).toContain(
      catalogEn["holdings.gain.note"].replace("{cost}", "R$115.00"),
    );
    expect(card.textContent).toContain(
      catalogEn["holdings.gain.mixed"].replace("{count}", "1"),
    );
  });

  it("PC2: states the net income of the year up to the valuation date, with a door", async () => {
    const asked: (string | null)[] = [];
    const fetch = portfolioApi({
      "GET /api/v1/income-events": (req) => {
        asked.push(new URL(req.url).searchParams.get("year"));
        return json(200, {
          from: "2025-01-01",
          to: "2025-12-31",
          items: [
            { date: "2025-02-01", gross: brl(1000), withheld: brl(150) },
            { date: "2025-11-01", gross: brl(9000), withheld: brl(0) },
          ],
        });
      },
    });
    await renderApp("/portfolio", { fetch, today: "2025-06-30" });
    const card = await figure(
      catalogEn["holdings.income"].replace("{year}", "2025"),
    );

    await within(card).findByText("R$8.50");
    expect(card.textContent).toContain(
      catalogEn["holdings.income.note"].replace("{withheld}", "R$1.50"),
    );
    expect(asked).toEqual(["2025"]);
    expect(
      within(card).getByRole("link", {
        name: catalogEn["holdings.income.open"],
      }),
    ).toHaveAttribute("href", "/portfolio/year?year=2025&tab=income");
  });

  it("PP3: the page header holds the trade as its one solid action", async () => {
    await renderApp("/portfolio", { fetch: portfolioApi() });
    await figure(catalogEn["holdings.value"]);
    const header = pageHeader();

    const trade = await within(header).findByRole("link", {
      name: catalogEn["holdings.trade"],
    });
    expect(trade).toHaveAttribute("href", "/transactions/new?kind=trade");
    expect(trade).toHaveAttribute("data-variant", "solid");
    expect(header.querySelectorAll('[data-variant="solid"]')).toHaveLength(1);
  });

  it("PC8: shows the empty state with the first action", async () => {
    const fetch = portfolioApi({
      "GET /api/v1/positions": () => json(200, { items: [] }),
      [`GET /api/v1/accounts/${cashID}/balance`]: () =>
        json(200, { balance: brl(0), value: brl(0) }),
    });
    await renderApp("/portfolio", { fetch });

    expect(
      await screen.findByText(catalogEn["portfolio.empty"]),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: catalogEn["holdings.trade"] }),
    ).toBeInTheDocument();
  });

  it("BC9: offers to create a brokerage when the book has none", async () => {
    const fetch = portfolioApi({
      "GET /api/v1/positions": () => json(200, { items: [] }),
      "GET /api/v1/accounts": () => json(200, { items: [] }),
    });
    await renderApp("/portfolio", { fetch });

    expect(
      await screen.findByRole("link", { name: catalogEn["brokerage.create"] }),
    ).toHaveAttribute("href", "/accounts/new?kind=brokerage");
    expect(
      screen.queryByRole("link", { name: catalogEn["holdings.trade"] }),
    ).not.toBeInTheDocument();
  });

  it("PC4: counts brokerage cash it cannot value as unpriced and keeps the rest", async () => {
    const fetch = portfolioApi({
      [`GET /api/v1/accounts/${cashID}/balance`]: () =>
        problem(422, "price_missing"),
    });
    await renderApp("/portfolio", { fetch });
    const card = await figure(catalogEn["holdings.value"]);

    await within(card).findByText("R$141.00");
    expect(card.textContent).toContain(
      catalogEn["holdings.value.unpriced"].replace("{count}", "2"),
    );
  });

  it("PC4: reads the cash in the valuation currency, not in the account's", async () => {
    const usd = (amount: number) => ({ amount, currency: "USD" });
    const fetch = portfolioApi({
      "GET /api/v1/positions": () =>
        json(200, {
          items: [
            {
              account_id: cashID,
              instrument: "PETR4",
              quantity: { amount: 5, currency: "PETR4" },
              cost_basis: brl(1500),
              market_value: usd(300),
            },
          ],
        }),
      [`GET /api/v1/accounts/${cashID}/balance`]: () =>
        json(200, { balance: brl(40000), value: usd(7000) }),
    });
    await renderApp("/portfolio?value_in=USD", { fetch });
    const card = await figure(catalogEn["holdings.value"]);

    await within(card).findByText("$73.00");
    expect(card.textContent).toContain(
      catalogEn["holdings.value.note"]
        .replace("{positions}", "$3.00")
        .replace("{cash}", "$70.00"),
    );
  });

  it("PC23: says the gain reads in the currency of the cost, with a way there", async () => {
    const fetch = portfolioApi({
      "GET /api/v1/positions": () =>
        json(200, {
          items: [
            {
              account_id: cashID,
              instrument: "PETR4",
              quantity: { amount: 5, currency: "PETR4" },
              cost_basis: brl(1500),
              market_value: { amount: 300, currency: "USD" },
            },
          ],
        }),
    });
    await renderApp("/portfolio?value_in=USD", { fetch });
    const card = await figure(catalogEn["holdings.gain"]);

    expect(
      await within(card).findByText(
        catalogEn["holdings.gain.elsewhere"].replace("{currency}", "BRL"),
      ),
    ).toBeInTheDocument();
    expect(card.textContent).not.toContain("$0.00");
    expect(
      within(card).getByRole("link", {
        name: catalogEn["holdings.missing.inBase"].replace("{base}", "BRL"),
      }),
    ).toHaveAttribute("href", "/portfolio/positions");
  });

  it("TR4: adds every sale and income to the gain, naming what it leaves out", async () => {
    const fetch = portfolioApi({
      "GET /api/v1/positions": () =>
        json(200, {
          items: positions,
          quote_warnings: [],
          realized: [brl(300), { amount: 200, currency: "USD" }],
          income: [brl(150)],
        }),
    });
    await renderApp("/portfolio", { fetch });
    const card = await figure(catalogEn["holdings.total"]);

    await within(card).findByText("+R$14.50");
    expect(card.textContent).toContain(
      catalogEn["holdings.total.note"]
        .replace("{realized}", "+R$3.00")
        .replace("{income}", "+R$1.50"),
    );
    expect(card.textContent).toContain(
      catalogEn["holdings.total.outside"].replace("{amounts}", "$2.00"),
    );
  });

  it("TR4: holds no number when the gain reads in the currency of the cost", async () => {
    const fetch = portfolioApi({
      "GET /api/v1/positions": () =>
        json(200, {
          items: [
            {
              account_id: cashID,
              instrument: "PETR4",
              quantity: { amount: 5, currency: "PETR4" },
              cost_basis: brl(1500),
              market_value: { amount: 300, currency: "USD" },
              income: brl(100),
            },
          ],
          quote_warnings: [],
          realized: [],
          income: [brl(100)],
        }),
    });
    await renderApp("/portfolio?value_in=USD", { fetch });
    const card = await figure(catalogEn["holdings.total"]);

    expect(
      await within(card).findByText(
        catalogEn["holdings.gain.elsewhere"].replace("{currency}", "BRL"),
      ),
    ).toBeInTheDocument();
    expect(card.textContent).not.toContain("$0.00");
    expect(
      within(card).getByRole("link", {
        name: catalogEn["holdings.missing.inBase"].replace("{base}", "BRL"),
      }),
    ).toHaveAttribute("href", "/portfolio/positions");
  });

  it("PC24: reads the income of the tax year that holds the valuation date", async () => {
    const asked: (string | null)[] = [];
    const fetch = portfolioApi({
      "GET /api/v1/income-events": (req) => {
        const year = new URL(req.url).searchParams.get("year");
        asked.push(year);
        return json(200, {
          from: `${year ?? ""}-04-06`,
          to: `${String(Number(year) + 1)}-04-05`,
          items:
            year === "2025"
              ? [{ date: "2025-12-01", gross: brl(1000), withheld: brl(0) }]
              : [],
        });
      },
    });
    await renderApp("/portfolio", { fetch, today: "2026-02-10" });
    const card = await figure(
      catalogEn["holdings.income"].replace("{year}", "2025"),
    );

    await within(card).findByText("R$10.00");
    expect(asked).toEqual(["2026", "2025"]);
  });

  it("PC22: offers the way out when the positions cannot be valued at the date", async () => {
    const fetch = portfolioApi({
      "GET /api/v1/positions": () => problem(422, "price_missing"),
    });
    const { router } = await renderApp("/portfolio?value_in=USD", {
      fetch,
      today: "2025-11-07",
    });

    await userEvent.setup().click(
      await screen.findByRole("button", {
        name: catalogEn["holdings.missing.inBase"].replace("{base}", "BRL"),
      }),
    );

    await waitFor(() => {
      expect(router.state.location.search).not.toHaveProperty("value_in");
    });
    expect(
      screen.queryByRole("radio", { name: "12 months" }),
    ).not.toBeInTheDocument();
  });

  it("asks at today's date and in the chosen currency", async () => {
    const positions: URLSearchParams[] = [];
    const balances: URLSearchParams[] = [];
    const fetch = portfolioApi({
      "GET /api/v1/positions": (req) => {
        positions.push(new URL(req.url).searchParams);
        return json(200, { items: [] });
      },
      [`GET /api/v1/accounts/${cashID}/balance`]: (req) => {
        balances.push(new URL(req.url).searchParams);
        return json(200, {
          balance: brl(0),
          value: { amount: 0, currency: "USD" },
        });
      },
    });
    await renderApp("/portfolio?value_in=USD", { fetch, today: "2026-09-30" });

    await waitFor(() => {
      expect(positions.map((q) => [q.get("date"), q.get("value_in")])).toEqual([
        ["2026-09-30", "USD"],
      ]);
      expect(balances.map((q) => [q.get("date"), q.get("value_in")])).toEqual([
        ["2026-09-30", "USD"],
      ]);
    });
  });

  it("PC9: links the year with a short word", async () => {
    await renderApp("/portfolio", { fetch: portfolioApi() });

    expect(
      await screen.findByRole("tab", {
        name: catalogEn["portfolio.tabs.year"],
      }),
    ).toHaveAttribute("href", "/portfolio/year");
  });

  it("names the holdings with a late or missing quote", async () => {
    const warned = (
      quoteWarnings: { instrument: string; last: string | null }[],
    ) =>
      portfolioApi({
        "GET /api/v1/positions": () =>
          json(200, { items: positions, quote_warnings: quoteWarnings }),
      });

    const { unmount } = await renderApp("/portfolio", {
      fetch: warned([
        { instrument: "PETR4", last: "2026-10-20" },
        { instrument: "MXRF11", last: null },
      ]),
    });

    expect(
      await screen.findByText("2 holdings have a late or missing quote."),
    ).toBeVisible();
    expect(screen.getByRole("link", { name: "Open PETR4" })).toHaveAttribute(
      "href",
      expect.stringMatching(/\/instruments\/PETR4$/),
    );
    unmount();

    await renderApp("/portfolio", {
      fetch: warned([{ instrument: "PETR4", last: "2026-10-20" }]),
    });

    expect(
      await screen.findByText("1 holding has a late or missing quote."),
    ).toBeVisible();
  });

  it("draws no notice when no holding has a late or missing quote", async () => {
    await renderApp("/portfolio", { fetch: portfolioApi() });
    await figure(catalogEn["holdings.value"]);

    expect(
      screen.queryByText(
        /have a late or missing quote|has a late or missing quote/,
      ),
    ).toBeNull();
  });
});
