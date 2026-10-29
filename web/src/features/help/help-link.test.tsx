import { screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import { catalogEn } from "@/i18n/catalog.en";
import { planningApi } from "@/testing/planning-api";
import { renderApp } from "@/testing/render-app";

beforeEach(() => {
  localStorage.clear();
});

describe("help link", () => {
  it("leads the budgets tab to the page of the month's plan", async () => {
    await renderApp("/planning?tab=budgets", { fetch: planningApi() });

    expect(
      await screen.findByRole("link", { name: catalogEn["help.screen"] }),
    ).toHaveAttribute("href", "/help/budget-plan");
  });

  it("draws nothing on a tab the page does not explain", async () => {
    await renderApp("/planning", { fetch: planningApi() });

    await screen.findByRole("heading", {
      level: 1,
      name: catalogEn["nav.planning"],
    });

    expect(
      screen.queryByRole("link", { name: catalogEn["help.screen"] }),
    ).not.toBeInTheDocument();
  });
});
