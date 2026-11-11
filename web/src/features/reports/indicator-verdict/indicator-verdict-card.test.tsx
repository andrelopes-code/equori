import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { IndicatorMonth } from "@/features/overview";
import { IndicatorVerdictCard } from "@/features/reports/indicator-verdict/indicator-verdict-card";
import { fakeApi } from "@/testing/fake-api";
import { brl, indicatorReport } from "@/testing/indicator-report";
import { renderWithProviders } from "@/testing/render-app";
import { reportApiRoutes } from "@/testing/report-api";

describe("IndicatorVerdictCard", () => {
  it.each([
    {
      name: "below the mean",
      last: {},
      incomplete: false,
      figure: "8.00%",
      line: "4.00 pp below the 12-month mean (12.00%)",
    },
    {
      name: "above the mean",
      last: { savings_rate: { bp: 1500 } },
      incomplete: false,
      figure: "15.00%",
      line: "3.00 pp above the 12-month mean (12.00%)",
    },
    {
      name: "in line with the mean",
      last: { savings_rate: { bp: 1200 } },
      incomplete: false,
      figure: "12.00%",
      line: "In line with the 12-month mean (12.00%)",
    },
    {
      name: "without a mean",
      last: { trailing_savings_rate: { reason: "insufficient_history" } },
      incomplete: false,
      figure: "8.00%",
      line: "The 12-month mean needs 3 complete months of records.",
    },
    {
      name: "without income",
      last: { savings_rate: { reason: "no_income" } },
      incomplete: false,
      figure: "—",
      line: "No income was recorded in October.",
    },
    {
      name: "incomplete",
      last: { savings_rate: { bp: -17241 } },
      incomplete: true,
      figure: "−172.41%",
      line: "In progress: it only compares with a closed month.",
    },
  ] satisfies {
    name: string;
    last: Partial<IndicatorMonth>;
    incomplete: boolean;
    figure: string;
    line: string;
  }[])("fills the figure and the line $name", async (c) => {
    renderCard(c.last, c.incomplete);

    expect(await screen.findByText(c.figure)).toBeInTheDocument();
    expect(screen.getByText(c.line)).toBeInTheDocument();
    expect(screen.getByText("Savings rate in October")).toBeInTheDocument();
  });

  it("writes the month ledger", async () => {
    renderCard({ income: brl(100000), expense: brl(130000) }, false);

    expect(await screen.findByText("Income")).toBeInTheDocument();
    expect(screen.getByText("R$1,000.00")).toBeInTheDocument();
    expect(screen.getByText("R$1,300.00")).toBeInTheDocument();
    expect(screen.getByText("−R$300.00")).toBeInTheDocument();
  });

  it("writes no amount in the line of an incomplete month", async () => {
    renderCard({ income: brl(167990), expense: brl(457628) }, true);

    await screen.findByText("Income");

    expect(screen.getAllByText(/R\$1,679\.90/)).toHaveLength(1);
  });

  it("tags an incomplete month with the day it runs to", async () => {
    renderCard({}, true);

    expect(
      await screen.findByText("In progress until October 17"),
    ).toBeInTheDocument();
  });

  it("tags nothing for a complete month", async () => {
    renderCard({}, false);

    await screen.findByText("Income");

    expect(screen.queryByText(/In progress until/)).not.toBeInTheDocument();
  });
});

function renderCard(last: Partial<IndicatorMonth>, incomplete: boolean) {
  const report = indicatorReport({ last });

  return renderWithProviders(
    <IndicatorVerdictCard
      report={report}
      incomplete={incomplete}
      today="2026-10-17"
    />,
    { fetch: fakeApi({ ...reportApiRoutes() }) },
  );
}
