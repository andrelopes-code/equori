import { screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { PortfolioAreaHeader } from "@/features/portfolio/area-header/portfolio-area-header";
import { catalogEn } from "@/i18n/catalog.en";
import { portfolioApi } from "@/testing/portfolio-api";
import { renderWithRouter } from "@/testing/render-app";

const tabNames = [
  catalogEn["portfolio.tabs.results"],
  catalogEn["portfolio.tabs.positions"],
  catalogEn["portfolio.tabs.year"],
  catalogEn["portfolio.tabs.contributions"],
  catalogEn["portfolio.tabs.projection"],
];

describe("PortfolioAreaHeader", () => {
  it("draws the heading and the five tabs with the chosen one selected", async () => {
    renderWithRouter(
      <PortfolioAreaHeader tab="results" subheading="Sub" help="portfolio" />,
      { path: "/portfolio", fetch: portfolioApi() },
    );

    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: catalogEn["nav.portfolio"],
      }),
    ).toBeInTheDocument();

    const list = screen.getByRole("tablist", {
      name: catalogEn["portfolio.tabs.label"],
    });

    expect(
      within(list)
        .getAllByRole("tab")
        .map((e) => e.textContent),
    ).toEqual(tabNames);
    expect(
      within(list).getByRole("tab", {
        name: catalogEn["portfolio.tabs.results"],
      }),
    ).toHaveAttribute("aria-selected", "true");
  });

  it.each([
    { name: "with", valueIn: "USD", href: "/portfolio/positions?value_in=USD" },
    { name: "without", valueIn: undefined, href: "/portfolio/positions" },
  ])(
    "links the tab $name the valuation currency",
    async ({ valueIn, href }) => {
      renderWithRouter(
        <PortfolioAreaHeader
          tab="results"
          subheading="Sub"
          help="portfolio"
          valueIn={valueIn}
        />,
        { path: "/portfolio", fetch: portfolioApi() },
      );

      expect(
        await screen.findByRole("tab", {
          name: catalogEn["portfolio.tabs.positions"],
        }),
      ).toHaveAttribute("href", href);
    },
  );

  // Owner review of 2026-11-25: the rule beside a ghost button reads off-centre, so the header
  // separates its controls from its actions by the gap alone.
  it("draws no separator between the controls and the actions", async () => {
    renderWithRouter(
      <PortfolioAreaHeader
        tab="results"
        subheading="Sub"
        help="portfolio"
        controls={<span>control</span>}
      />,
      { path: "/portfolio", fetch: portfolioApi() },
    );
    await screen.findByText("control");

    expect(screen.queryByRole("separator")).not.toBeInTheDocument();
  });
});
