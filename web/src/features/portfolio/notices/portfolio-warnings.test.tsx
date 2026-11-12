import { screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { catalogEn } from "@/i18n/catalog.en";
import { json, problem } from "@/testing/fake-api";
import { portfolioApi, positions } from "@/testing/portfolio-api";
import { renderApp } from "@/testing/render-app";

const alerts = (container: HTMLElement) => [
  ...container.querySelectorAll<HTMLElement>("[data-ui='alert']"),
];

describe("Portfolio warnings", () => {
  it("CA3: keeps one alert when a quote is late and a price is missing", async () => {
    const { container } = await renderApp("/portfolio", {
      fetch: portfolioApi({
        "GET /api/v1/positions": () =>
          json(200, {
            items: positions,
            quote_warnings: [{ instrument: "PETR4", last: "2026-10-20" }],
          }),
        "GET /api/v1/reports/return": () => problem(422, "price_missing"),
      }),
    });

    const message = await screen.findByText(catalogEn["holdings.missing.own"]);
    const [alert = container] = alerts(container);

    expect(alerts(container)).toHaveLength(1);
    expect(
      within(alert).getByRole("link", { name: "Open PETR4" }),
    ).toBeVisible();
    expect(message).toBeVisible();
    expect(alert).not.toContainElement(message);
    expect(
      within(
        message.closest<HTMLElement>("[data-ui='section']") ?? container,
      ).queryByRole("link", { name: catalogEn["holdings.prices"] }),
    ).not.toBeInTheDocument();
  });

  it("CA3: keeps the alert with its action when only the return reports a missing price", async () => {
    const { container } = await renderApp("/portfolio", {
      fetch: portfolioApi({
        "GET /api/v1/reports/return": () => problem(422, "price_missing"),
      }),
    });

    await screen.findByText(catalogEn["holdings.missing.own"]);
    const [alert = container] = alerts(container);

    expect(alerts(container)).toHaveLength(1);
    expect(
      within(alert).getByText(catalogEn["holdings.missing.own"]),
    ).toBeVisible();
    expect(
      within(alert).getByRole("link", { name: catalogEn["holdings.prices"] }),
    ).toHaveAttribute("href", "/instruments");
  });
});
