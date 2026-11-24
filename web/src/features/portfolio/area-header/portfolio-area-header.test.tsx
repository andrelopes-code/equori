import { screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { PortfolioAreaHeader } from "@/features/portfolio/area-header/portfolio-area-header";
import { catalogEn } from "@/i18n/catalog.en";
import { portfolioApi } from "@/testing/portfolio-api";
import { renderWithRouter } from "@/testing/render-app";

const tabNames = [
  catalogEn["portfolio.tabs.summary"],
  catalogEn["portfolio.tabs.results"],
  catalogEn["portfolio.tabs.positions"],
  catalogEn["portfolio.tabs.year"],
  catalogEn["portfolio.tabs.contributions"],
];

describe("PortfolioAreaHeader", () => {
  it("draws the heading and the five tabs with the chosen one selected", async () => {
    renderWithRouter(
      <PortfolioAreaHeader tab="results" subheading="Sub" help="portfolio" />,
      { path: "/portfolio/results", fetch: portfolioApi() },
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
          tab="summary"
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

  it("draws one separator only when the tab has controls", async () => {
    const view = renderWithRouter(
      <PortfolioAreaHeader
        tab="summary"
        subheading="Sub"
        help="portfolio"
        controls={<span>control</span>}
      />,
      { path: "/portfolio", fetch: portfolioApi() },
    );

    expect(await screen.findAllByRole("separator")).toHaveLength(1);

    view.unmount();
    renderWithRouter(
      <PortfolioAreaHeader tab="summary" subheading="Sub" help="portfolio" />,
      { path: "/portfolio", fetch: portfolioApi() },
    );
    await screen.findByRole("heading", { level: 1 });

    expect(screen.queryByRole("separator")).not.toBeInTheDocument();
  });
});
