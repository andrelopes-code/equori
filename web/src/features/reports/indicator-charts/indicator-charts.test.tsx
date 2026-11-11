import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { FlowsChart } from "@/features/reports/indicator-charts/flows-chart";
import { RateChart } from "@/features/reports/indicator-charts/rate-chart";
import { ReserveChart } from "@/features/reports/indicator-charts/reserve-chart";
import { fakeApi } from "@/testing/fake-api";
import { indicatorReport } from "@/testing/indicator-report";
import { renderWithProviders } from "@/testing/render-app";
import { reportApiRoutes } from "@/testing/report-api";

describe("indicator charts", () => {
  it("names the reserve chart and what it compares", async () => {
    renderChart(<ReserveChart report={indicatorReport()} incomplete={false} />);

    expect(await screen.findByText("Reserve and debts")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Balance at the end of each month. Liquid accounts against what is owed.",
      ),
    ).toBeInTheDocument();
  });

  it("names the flows chart", async () => {
    renderChart(<FlowsChart report={indicatorReport()} incomplete={false} />);

    expect(
      await screen.findByText("Income and expense by month"),
    ).toBeInTheDocument();
  });

  it("names the savings rate chart", async () => {
    renderChart(<RateChart report={indicatorReport()} incomplete={false} />);

    expect(
      await screen.findByText("Savings rate by month"),
    ).toBeInTheDocument();
  });
});

function renderChart(chart: React.ReactNode) {
  return renderWithProviders(chart, {
    fetch: fakeApi({ ...reportApiRoutes() }),
  });
}
