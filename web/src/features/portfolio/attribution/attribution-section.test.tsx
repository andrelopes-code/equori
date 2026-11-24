import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { catalogEn } from "@/i18n/catalog.en";
import { json } from "@/testing/fake-api";
import { portfolioApi } from "@/testing/portfolio-api";
import { renderApp } from "@/testing/render-app";

const brl = (amount: number) => ({ amount, currency: "BRL" });
const yearsChart = catalogEn["portfolio.attribution.years"];

// S656 and S658 as the API returns them; 2026 also holds the comparisons of S670.
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
        {
          instrument: "PETR4",
          result: brl(-20000),
          weight_bp: 1956,
          contribution_bp: -200,
          stale_since: "2025-06-30",
        },
      ],
    },
    {
      year: 2026,
      from: "2026-01-01",
      to: "2026-11-01",
      since: "2026-01-01",
      result: brl(44700),
      capital: brl(995000),
      return_bp: 449,
      other: {
        result: brl(200),
        weight_bp: 7966,
        contribution_bp: 2,
        return_bp: 3,
      },
      items: [
        {
          instrument: "PETR4",
          result: brl(34500),
          weight_bp: 929,
          contribution_bp: 347,
          return_bp: 3734,
        },
        {
          instrument: "MXRF11",
          result: brl(10000),
          weight_bp: 1105,
          contribution_bp: 100,
          return_bp: 909,
        },
      ],
      rate: {
        index: "cdi",
        until: "2026-10-30",
        return_bp: 440,
        result: brl(44000),
        index_bp: 1050,
        index_result: brl(105000),
      },
      inflation: {
        index: "ipca",
        until: "2026-11-01",
        return_bp: 449,
        result: brl(44700),
        index_bp: 400,
        index_result: brl(40000),
        real_bp: 47,
      },
    },
  ],
};

const section = () =>
  screen.findByRole("region", {
    name: catalogEn["portfolio.attribution.title"],
  });

async function renderReport(body: unknown) {
  await renderApp("/portfolio/results", {
    fetch: portfolioApi({
      "GET /api/v1/reports/attribution": () => json(200, body),
    }),
  });

  return section();
}

describe("Attribution section", () => {
  it("AT8 to AT12: opens on the current year with its summary, its rows and the portfolio", async () => {
    const region = await renderReport(report);

    expect(
      await within(region).findByText("How 2026 to 11/01 went"),
    ).toBeInTheDocument();
    // One line each on one axis: name, rate and money.
    for (const text of [
      "Same money at the CDI to 10/30",
      "Inflation (IPCA)",
      "10.50%",
      "+R$1,050.00",
      "+R$400.00",
    ])
      expect(within(region).getByText(text)).toBeInTheDocument();
    // 440.00 against 1,050.00 at the CDI until 10/30: 610.00 below.
    expect(
      within(region).getByText("Difference from the CDI to 10/30").nextSibling
        ?.textContent,
    ).toBe("−R$610.00");
    expect(
      within(region).getByText("Real return").nextSibling?.textContent,
    ).toBe("0.47%");
    // PETR4 and MXRF11: 345.00 + 100.00.
    expect(
      within(region).getByText("2 holdings gained").nextSibling?.textContent,
    ).toBe("+R$445.00");
    expect(
      within(region).queryByText(/holdings? lost/),
    ).not.toBeInTheDocument();

    const rows = within(region).getAllByRole("listitem");
    expect(rows.map((r) => r.textContent)).toEqual([
      "PETR49.29%37.34%+3.47 pp+R$345.00",
      "MXRF1111.05%9.09%+1.00 pp+R$100.00",
      `${catalogEn["portfolio.attribution.other"]}79.66%0.03%+0.02 pp+R$2.00`,
      `${catalogEn["portfolio.attribution.total"]}100.00%4.49%+4.49 pp+R$447.00`,
    ]);
  });

  it("AT5, AT13: a past year names its first day, tallies its holdings and writes a stale quote in place of the bar and the rate", async () => {
    const region = await renderReport(report);

    await chooseYear(region, "{ArrowLeft}");

    expect(
      within(region).getByText("How 2025, since 01/02 went"),
    ).toBeInTheDocument();
    expect(
      within(region).getByText("1 holding lost").nextSibling?.textContent,
    ).toBe("−R$200.00");
    expect(
      within(region).getByText("No quote since 06/30/2025"),
    ).toBeInTheDocument();
    expect(within(region).queryByRole("combobox")).not.toBeInTheDocument();
  });

  it("lists every measured year, not only the last six", async () => {
    const years = [2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023].map((y) => ({
      ...report.years[0],
      year: y,
      from: `${String(y)}-01-01`,
      to: `${String(y)}-12-31`,
      since: `${String(y)}-01-01`,
    }));
    const region = await renderReport({ years });

    await chooseYear(region, "{Home}");

    expect(within(region).getByText("How 2016 went")).toBeInTheDocument();
  });

  it("chooses a year without minimizing, and minimizes from the header", async () => {
    const region = await renderReport(report);
    const user = userEvent.setup();
    const title = catalogEn["portfolio.attribution.title"];

    await chooseYear(region, "{ArrowLeft}");
    await user.click(
      within(region).getByRole("button", { name: `About “${title}”` }),
    );

    expect(
      within(region).getByRole("button", { name: `Minimize ${title}` }),
    ).toHaveAttribute("aria-expanded", "true");

    await user.click(within(region).getByText(title));

    expect(
      within(region).getByRole("button", { name: `Expand ${title}` }),
    ).toHaveAttribute("aria-expanded", "false");
  });

  it("AT6: a year without a quote names the holdings", async () => {
    const region = await renderReport({
      years: [
        {
          year: 2025,
          from: "2025-01-01",
          to: "2025-12-31",
          missing: ["PETR4"],
        },
      ],
    });

    expect(
      await within(region).findByText(
        "No quote of PETR4 at the year end: the year cannot be measured.",
      ),
    ).toBeInTheDocument();
  });

  it("draws nothing for a book with no measured year", async () => {
    await renderApp("/portfolio/results", { fetch: portfolioApi() });

    await screen.findByRole("tab", {
      name: catalogEn["portfolio.tabs.results"],
    });

    await waitFor(() => {
      expect(
        screen.queryByRole("region", {
          name: catalogEn["portfolio.attribution.title"],
        }),
      ).not.toBeInTheDocument();
    });
  });
});

// keys moves along the bars from the chosen year, the last one, and Enter chooses the bar reached.
async function chooseYear(region: HTMLElement, keys: string) {
  const user = userEvent.setup();

  (await within(region).findByRole("group", { name: yearsChart })).focus();
  await user.keyboard(`${keys}{Enter}`);
}
