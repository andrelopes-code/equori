import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { IndicatorMonth } from "@/features/overview";
import { IndicatorBoard } from "@/features/reports/indicator-board";
import { fakeApi } from "@/testing/fake-api";
import { indicatorReport } from "@/testing/indicator-report";
import { renderWithProviders } from "@/testing/render-app";
import { reportApiRoutes } from "@/testing/report-api";

describe("IndicatorBoard", () => {
  it("writes each ratio with its unit and value", async () => {
    renderBoard();

    expect(
      await screen.findByText("Where the month stands in the last 12 months"),
    ).toBeInTheDocument();
    expect(screen.getByText("Savings rate")).toBeInTheDocument();
    expect(screen.getByText("of the month's income")).toBeInTheDocument();
    expect(screen.getByText("8.00%")).toBeInTheDocument();
    expect(screen.getByText("Liquidity")).toBeInTheDocument();
    // The month is the largest of the twelve: its value and the end of its strip.
    expect(screen.getAllByText("3.1 months")).toHaveLength(2);
    expect(screen.getByText("Committed income")).toBeInTheDocument();
    expect(screen.getByText("17.44%")).toBeInTheDocument();
    expect(screen.getByText("Debt to income")).toBeInTheDocument();
  });

  it("draws a strip for each ratio that has a range", async () => {
    renderBoard();

    await screen.findByText("Savings rate");

    expect(screen.getAllByRole("img")).toHaveLength(3);
  });

  it("says there is no loan instead of drawing a strip", async () => {
    renderBoard();

    expect(
      await screen.findByText("No loan or financing in your records"),
    ).toBeInTheDocument();
  });

  it("writes the reason of a ratio the month cannot give", async () => {
    renderBoard({ liquidity: { reason: "insufficient_history" } });

    expect(
      await screen.findByText("Needs at least 3 complete months of records."),
    ).toBeInTheDocument();
    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("says the history is short for every ratio of a new book", async () => {
    renderBoard({}, { active: 10 });

    expect(
      await screen.findAllByText("Not enough history for the 12-month range."),
    ).toHaveLength(4);
  });

  it("marks the savings rate of an incomplete month as partial", async () => {
    renderBoard({}, { incomplete: true });

    expect(await screen.findByText("8.00%")).toBeInTheDocument();
    expect(screen.getByText("partial, no comparison")).toBeInTheDocument();
  });
});

function renderBoard(
  last: Partial<IndicatorMonth> = {},
  options: { active?: number; incomplete?: boolean } = {},
) {
  const report = indicatorReport({ last, active: options.active });

  return renderWithProviders(
    <IndicatorBoard report={report} incomplete={options.incomplete ?? false} />,
    { fetch: fakeApi({ ...reportApiRoutes() }) },
  );
}
