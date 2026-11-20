import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { catalogEn } from "@/i18n/catalog.en";
import { json, problem } from "@/testing/fake-api";
import { portfolioApi } from "@/testing/portfolio-api";
import { renderApp } from "@/testing/render-app";

// The figures of S649 with one stale month and an accrual share (RK3, RK11).
const report = {
  value_in: "BRL",
  from: "2026-01-31",
  to: "2026-03-31",
  window_months: 36,
  portfolio: {
    key: "",
    volatility_bp: 2403,
    volatility_months: 13,
    max_drawdown_bp: -645,
    months: [
      { month: "2026-01-31", state: "known", drawdown_bp: 0 },
      { month: "2026-02-28", state: "stale" },
      {
        month: "2026-03-31",
        state: "known",
        drawdown_bp: -645,
        volatility_bp: 2403,
      },
    ],
  },
  classes: [
    {
      key: "stock",
      volatility_bp: 3893,
      volatility_months: 13,
      max_drawdown_bp: -1062,
      weight_bp: 5364,
      risk_share_bp: 8284,
      months: [
        { month: "2026-01-31", state: "known" },
        { month: "2026-02-28", state: "stale" },
        { month: "2026-03-31", state: "known", volatility_bp: 3893 },
      ],
    },
    {
      key: "reit",
      volatility_bp: 853,
      volatility_months: 13,
      max_drawdown_bp: -196,
      weight_bp: 4636,
      risk_share_bp: 1716,
      accrual_bp: 10000,
      months: [
        { month: "2026-01-31", state: "known" },
        { month: "2026-02-28", state: "known" },
        { month: "2026-03-31", state: "known", volatility_bp: 853 },
      ],
    },
  ],
  correlations: [{ a: "stock", b: "reit", correlation_bp: 9819, months: 13 }],
  left_out: [
    { instrument: "B5P211", months: 45, from: "2022-04-30", to: "2025-12-31" },
    { instrument: "PETR4", months: 1, from: "2026-02-28", to: "2026-02-28" },
  ],
};

// The charts are not the subject here (their figures have tests of their own), and the first
// chart of a run takes over 15 s to mount in jsdom.
vi.mock("@slotted/react/chart", () => ({
  Chart: ({ title }: { title: string }) => <figure aria-label={title} />,
}));

const collapsedKey = "equori.portfolio.risk.collapsed";

// The section by its title: a role query over a page of tables and charts computes every
// accessible name of the page on each try, which took over 20 s.
const section = async () => {
  const title = await screen.findByText(catalogEn["portfolio.risk.title"]);
  const region = title.closest("section");
  if (region === null) throw new Error("the risk title is outside a section");

  return region;
};

// The body and summary rows of a table, one string of cells each.
const rows = (table: HTMLElement) =>
  [...table.querySelectorAll("tbody tr, tfoot tr")].map((row) =>
    [...row.querySelectorAll("th, td")]
      .map((cell) => cell.textContent)
      .join("|"),
  );

describe("Risk section", () => {
  afterEach(() => {
    localStorage.removeItem(collapsedKey);
  });

  it("RK7, RK8, RK10: leads with three plain sentences, each with its figure", async () => {
    const fetch = portfolioApi({
      "GET /api/v1/reports/risk": () => json(200, report),
    });
    await renderApp("/portfolio", { fetch });
    const region = await section();

    expect(await within(region).findByText("±24.03%")).toBeInTheDocument();
    expect(
      within(region).getByText(
        /^is how much the portfolio usually varies in a year: about .+ up or down\.$/,
      ),
    ).toBeInTheDocument();
    expect(within(region).getByText("−6.45%")).toBeInTheDocument();
    expect(
      within(region).getByText(
        "was the deepest fall, from Jan 2026 to Mar 2026; the portfolio is not back at its peak yet.",
      ),
    ).toBeInTheDocument();
    const verdict = region.querySelector("dl");
    expect(verdict).not.toBeNull();
    expect(within(verdict ?? region).getByText("82.84%")).toBeInTheDocument();
    expect(
      within(region).getByText(
        "of the variation comes from Stocks, which is 53.64% of your money.",
      ),
    ).toBeInTheDocument();
  });

  it("RK10, RK11: sets each class's share of the money beside its share of the variation", async () => {
    const fetch = portfolioApi({
      "GET /api/v1/reports/risk": () => json(200, report),
    });
    await renderApp("/portfolio", { fetch });
    const region = await section();

    const classes = await within(region).findByRole("table", {
      name: catalogEn["portfolio.risk.classes"],
    });
    expect(rows(classes)).toEqual([
      "Stocks|53.64%|82.84%|",
      "REITs100.00% priced by its rate|46.36%|17.16%|",
    ]);
    expect(
      within(classes).getByRole("img", {
        name: "82.84% of the variation, 53.64% of the money",
      }),
    ).toBeInTheDocument();
  });

  it("RK7 to RK9: keeps the terms, the measures and the correlations in a closed block", async () => {
    const fetch = portfolioApi({
      "GET /api/v1/reports/risk": () => json(200, report),
    });
    await renderApp("/portfolio", { fetch });
    const region = await section();

    await userEvent.click(
      await within(region).findByText(catalogEn["portfolio.risk.details"]),
    );

    expect(
      within(region).getByText(
        catalogEn["portfolio.risk.term.volatility.meaning"],
      ),
    ).toBeInTheDocument();
    expect(
      rows(
        within(region).getByRole("table", {
          name: catalogEn["portfolio.risk.measures"],
        }),
      ),
    ).toEqual([
      "Stocks|38.93%|−10.62%",
      "REITs|8.53%|−1.96%",
      "Portfolio|24.03%|−6.45%",
    ]);
    expect(
      rows(
        within(region).getByRole("table", {
          name: catalogEn["portfolio.risk.correlations"],
        }),
      ),
    ).toEqual(["Stocks and REITs|Together|0.98|13"]);
  });

  it("RK3: names the missing quotes and fetches them from the first month of the report", async () => {
    const asked: string[] = [];
    const history = async (req: Request) => {
      asked.push(`${new URL(req.url).pathname} ${await req.text()}`);
      return new Response(null, {
        status: 202,
        headers: { "Content-Length": "0" },
      });
    };
    const fetch = portfolioApi({
      "GET /api/v1/reports/risk": () => json(200, report),
      "POST /api/v1/instruments/B5P211/history": history,
      "POST /api/v1/instruments/PETR4/history": history,
    });
    await renderApp("/portfolio", { fetch });
    const region = await section();

    expect(
      await within(region).findByText(
        "Quotes of B5P211 are missing from Apr 2022 to Dec 2025, and of other securities; those months are out of the figures.",
      ),
    ).toBeInTheDocument();

    await userEvent.click(
      within(region).getByRole("button", {
        name: catalogEn["portfolio.risk.coverage.action"],
      }),
    );

    expect(
      await within(region).findByText(
        catalogEn["portfolio.risk.coverage.fetching"],
      ),
    ).toBeInTheDocument();
    expect(asked).toEqual([
      '/api/v1/instruments/B5P211/history {"from":"2026-01-01"}',
      '/api/v1/instruments/PETR4/history {"from":"2026-01-01"}',
    ]);
  });

  it("holds its place with a placeholder while the report loads", async () => {
    const fetch = portfolioApi({
      "GET /api/v1/reports/risk": () => new Promise<Response>(() => undefined),
    });
    await renderApp("/portfolio", { fetch });

    const region = await section();

    expect(region.querySelector('[data-ui="skeleton"]')).not.toBeNull();
  });

  it("minimizes from a click on its header, and keeps the choice", async () => {
    const fetch = portfolioApi({
      "GET /api/v1/reports/risk": () => json(200, report),
    });
    const first = await renderApp("/portfolio", { fetch });
    const region = await section();

    await userEvent.click(
      within(region).getByText(catalogEn["portfolio.risk.title"]),
    );

    expect(region.querySelector("[data-peek]")).toHaveAttribute(
      "data-peek",
      "closed",
    );
    expect(localStorage.getItem(collapsedKey)).toBe("true");

    first.unmount();
    await renderApp("/portfolio", { fetch });
    const again = await section();

    expect(again.querySelector("[data-peek]")).toHaveAttribute(
      "data-peek",
      "closed",
    );

    await userEvent.click(
      within(again).getByLabelText(
        `Expand ${catalogEn["portfolio.risk.title"]}`,
      ),
    );

    expect(again.querySelector("[data-peek]")).toHaveAttribute(
      "data-peek",
      "open",
    );
    expect(localStorage.getItem(collapsedKey)).toBe("false");
  });

  it("states a failure of the report", async () => {
    await renderApp("/portfolio", {
      fetch: portfolioApi({
        "GET /api/v1/reports/risk": () => problem(500, "internal"),
      }),
    });

    expect(
      await within(await section()).findByText(
        catalogEn["portfolio.risk.error"],
      ),
    ).toBeInTheDocument();
  });

  it("draws nothing for a book without a month", async () => {
    let asked = false;
    await renderApp("/portfolio", {
      fetch: portfolioApi({
        "GET /api/v1/reports/risk": () => {
          asked = true;
          return json(200, { ...report, portfolio: { key: "", months: [] } });
        },
      }),
    });
    await screen.findByRole("region", { name: catalogEn["holdings.return"] });

    await waitFor(() => {
      expect(asked).toBe(true);
    });
    await waitFor(() => {
      expect(
        screen.queryByRole("region", {
          name: catalogEn["portfolio.risk.title"],
        }),
      ).toBeNull();
    });
  });
});
