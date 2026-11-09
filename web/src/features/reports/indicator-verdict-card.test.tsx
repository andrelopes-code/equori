import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { IndicatorMonth } from "@/features/overview";
import { IndicatorVerdictCard } from "@/features/reports/indicator-verdict-card";
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
      want: "In October, the savings rate was 8.00%, 4.00 pp below the 12-month mean (12.00%).",
    },
    {
      name: "above the mean",
      last: { savings_rate: { bp: 1500 } },
      incomplete: false,
      want: "In October, the savings rate was 15.00%, 3.00 pp above the 12-month mean (12.00%).",
    },
    {
      name: "in line with the mean",
      last: { savings_rate: { bp: 1200 } },
      incomplete: false,
      want: "In October, the savings rate was 12.00%, in line with the 12-month mean (12.00%).",
    },
    {
      name: "without a mean",
      last: { trailing_savings_rate: { reason: "insufficient_history" } },
      incomplete: false,
      want: "In October, the savings rate was 8.00%. The 12-month mean needs 3 complete months of records.",
    },
    {
      name: "without income",
      last: { savings_rate: { reason: "no_income" } },
      incomplete: false,
      want: "In October, no income was recorded, so there is no savings rate.",
    },
    {
      name: "incomplete",
      last: { income: brl(167990), expense: brl(457628) },
      incomplete: true,
      want: "So far in October, R$1,679.90 came in and R$4,576.28 went out. The savings rate only compares with a closed month.",
    },
  ] satisfies {
    name: string;
    last: Partial<IndicatorMonth>;
    incomplete: boolean;
    want: string;
  }[])("writes the sentence $name", async ({ last, incomplete, want }) => {
    renderCard(last, incomplete);

    expect(await screen.findByText(want)).toBeInTheDocument();
  });

  it("writes the month ledger", async () => {
    renderCard({ income: brl(100000), expense: brl(130000) }, false);

    expect(await screen.findByText("Income")).toBeInTheDocument();
    expect(screen.getByText("R$1,000.00")).toBeInTheDocument();
    expect(screen.getByText("R$1,300.00")).toBeInTheDocument();
    expect(screen.getByText("−R$300.00")).toBeInTheDocument();
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
