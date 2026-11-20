import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";

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
    { instrument: "B5P211", months: 45 },
    { instrument: "PETR4", months: 1 },
  ],
};

const collapsedKey = "equori.portfolio.risk.collapsed";

const section = () =>
  screen.findByRole("region", { name: catalogEn["portfolio.risk.title"] });

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

  it("RK10: states the weight, the share of risk, the volatility and the deepest fall of each class", async () => {
    const fetch = portfolioApi({
      "GET /api/v1/reports/risk": () => json(200, report),
    });
    await renderApp("/portfolio", { fetch });
    const region = await section();

    const classes = await within(region).findByRole("table", {
      name: catalogEn["portfolio.risk.classes"],
    });
    await waitFor(() => {
      expect(rows(classes)).toEqual([
        "Stocks|53.64%|82.84%|38.93%|−10.62%",
        "REITs|46.36%|17.16%|8.53%|−1.96%",
        "Portfolio|100.00%|100.00%|24.03%|−6.45%",
      ]);
    });

    expect(
      within(region).getByText(catalogEn["portfolio.risk.volatility"]),
    ).toBeInTheDocument();
    expect(
      within(region).getByText(catalogEn["portfolio.risk.drawdown"]),
    ).toBeInTheDocument();
    expect(
      within(region).getByText("Deepest fall: −6.45% in Mar 2026."),
    ).toBeInTheDocument();

    const pairs = within(region).getByRole("table", {
      name: catalogEn["portfolio.risk.correlations"],
    });
    expect(rows(pairs)).toEqual(["Stocks and REITs|0.98|13"]);
  });

  it("RK3, RK7, RK11: writes the months left out, the short sample and the accrual note", async () => {
    const fetch = portfolioApi({
      "GET /api/v1/reports/risk": () => json(200, report),
    });
    await renderApp("/portfolio", { fetch });
    const region = await section();
    await within(region).findByRole("table", {
      name: catalogEn["portfolio.risk.classes"],
    });

    expect(
      await within(region).findByText(
        "Months left out, with over 10% of the value without a fresh price: 1, in Stocks.",
      ),
    ).toBeInTheDocument();
    expect(
      within(region).getByText(
        "The latest volatility rests on 13 months; the standard is 36.",
      ),
    ).toBeInTheDocument();
    expect(
      within(region).getByText(
        "Months without a fresh price: B5P211 (45), PETR4 (1).",
      ),
    ).toBeInTheDocument();
    expect(
      within(region).getByText(
        "REITs: 100.00% of the value is priced by accrual, so its volatility stays near zero by method.",
      ),
    ).toBeInTheDocument();
  });

  it("minimizes from a click on its header, and keeps the choice", async () => {
    const fetch = portfolioApi({
      "GET /api/v1/reports/risk": () => json(200, report),
    });
    const first = await renderApp("/portfolio", { fetch });
    const region = await section();
    await within(region).findByRole("table", {
      name: catalogEn["portfolio.risk.classes"],
    });

    await userEvent.click(
      within(region).getByRole("heading", {
        name: catalogEn["portfolio.risk.title"],
      }),
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
      within(again).getByRole("button", {
        name: `Expand ${catalogEn["portfolio.risk.title"]}`,
      }),
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
