import { screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { NetWorthForecastTooltip } from "@/features/reports/net-worth-forecast-tooltip";
import type { NetWorthForecastTooltipProps } from "@/features/reports/net-worth-forecast-tooltip";
import { fakeApi } from "@/testing/fake-api";
import { hideAmounts } from "@/testing/privacy";
import { renderWithRouter } from "@/testing/render-app";
import { sharedRoutes } from "@/testing/transaction-api";

const row = (label: string) =>
  screen.getByText(label).closest("[data-ui='inline']");

describe("net worth forecast tooltip", () => {
  afterEach(() => {
    localStorage.removeItem("equori.privacy");
  });

  it("S288: states the forecast, its likely range and each amount that moves the day", async () => {
    renderTooltip(day());

    expect(await screen.findByText("Oct 25")).toBeVisible();
    expect(row("Forecast")).toHaveTextContent("ForecastR$500.00");
    expect(row("Likely range")).toHaveTextContent("Likely rangeR$400 to R$525");
    expect(screen.getByText("On this day")).toBeVisible();
    expect(row("Rent")).toHaveTextContent("Rent−R$2,000.00");
    expect(row("Family (estimated)")).toHaveTextContent(
      "Family (estimated)−R$400.00",
    );
    expect(row("Estimated day-to-day")).toHaveTextContent(
      "Estimated day-to-day−R$10.00",
    );
  });

  it("leaves out a range it does not state and a day nothing moves", async () => {
    renderTooltip({
      ...day(),
      point: {
        date: "2026-10-26",
        value: 50000,
        scheduled: 0,
        recurring: 0,
        variable: 0,
      },
      moves: [],
    });

    expect(await screen.findByText("Forecast")).toBeVisible();
    expect(screen.queryByText("Likely range")).not.toBeInTheDocument();
    expect(screen.queryByText("On this day")).not.toBeInTheDocument();
  });

  it("names today's value the net worth and states no range on it", async () => {
    renderTooltip({
      point: {
        date: "2026-10-17",
        value: 50000,
        low: 50000,
        high: 50000,
        scheduled: 0,
        recurring: 0,
        variable: 0,
      },
      moves: [],
    });

    expect(await screen.findByText("Net")).toBeVisible();
    expect(row("Net")).toHaveTextContent("NetR$500.00");
    expect(screen.queryByText("Forecast")).not.toBeInTheDocument();
    expect(screen.queryByText("Likely range")).not.toBeInTheDocument();
  });

  it("masks every amount in privacy mode", async () => {
    hideAmounts();
    renderTooltip(day());

    expect(await screen.findByText("Rent")).toBeVisible();
    expect(row("Rent")).not.toHaveTextContent("2,000");
    expect(row("Forecast")).not.toHaveTextContent("500");
    expect(row("Likely range")).not.toHaveTextContent("400");
  });
});

function day(): Omit<NetWorthForecastTooltipProps, "currency" | "digits"> {
  return {
    point: {
      date: "2026-10-25",
      value: 50000,
      low: 40000,
      high: 52500,
      scheduled: -200000,
      recurring: -40000,
      variable: -1000,
    },
    moves: [
      { description: "Rent", amount: -200000 },
      { description: "Family (estimated)", amount: -40000 },
    ],
  };
}

function renderTooltip(
  props: Omit<NetWorthForecastTooltipProps, "currency" | "digits">,
) {
  return renderWithRouter(
    <NetWorthForecastTooltip {...props} currency="BRL" digits={2} />,
    { path: "/", fetch: fakeApi(sharedRoutes) },
  );
}
