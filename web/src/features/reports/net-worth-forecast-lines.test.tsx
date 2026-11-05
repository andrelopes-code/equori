import { screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { NetWorthForecastLines } from "@/features/reports/net-worth-forecast-lines";
import { fakeApi } from "@/testing/fake-api";
import { hideAmounts } from "@/testing/privacy";
import { renderWithRouter } from "@/testing/render-app";
import { sharedRoutes } from "@/testing/transaction-api";

describe("net worth forecast lines", () => {
  afterEach(() => {
    localStorage.removeItem("equori.privacy");
  });

  it("S288: states what moves a forecast day", async () => {
    renderLines({
      date: "2026-10-25",
      value: 50000,
      scheduled: -200000,
      recurring: -40000,
      variable: -1000,
    });

    expect(await screen.findByText("Scheduled: −R$2,000.00")).toBeVisible();
    expect(screen.getByText("Estimated recurring: −R$400.00")).toBeVisible();
    expect(screen.getByText("Estimated day-to-day: −R$10.00")).toBeVisible();
  });

  it("leaves out an amount the day does not move", async () => {
    renderLines({
      date: "2026-10-26",
      value: 50000,
      scheduled: 0,
      recurring: 0,
      variable: 1500,
    });

    expect(
      await screen.findByText("Estimated day-to-day: +R$15.00"),
    ).toBeVisible();
    expect(screen.queryByText(/Scheduled/)).not.toBeInTheDocument();
    expect(screen.queryByText(/recurring/)).not.toBeInTheDocument();
  });

  it("masks every amount in privacy mode", async () => {
    hideAmounts();
    renderLines({
      date: "2026-10-25",
      value: 50000,
      scheduled: -200000,
      recurring: -40000,
      variable: -1000,
    });

    const line = await screen.findByText(/^Scheduled:/);
    expect(line).not.toHaveTextContent("2,000");
    expect(screen.getByText(/^Estimated recurring:/)).not.toHaveTextContent(
      "400",
    );
  });
});

function renderLines(
  point: Parameters<typeof NetWorthForecastLines>[0]["point"],
) {
  return renderWithRouter(
    <NetWorthForecastLines point={point} currency="BRL" digits={2} />,
    { path: "/", fetch: fakeApi(sharedRoutes) },
  );
}
