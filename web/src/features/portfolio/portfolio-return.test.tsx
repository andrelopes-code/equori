import { screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { catalogEn } from "@/i18n/catalog.en";
import { json, problem } from "@/testing/fake-api";
import { brokerID } from "@/testing/investment-api";
import { contributionReturn, portfolioApi } from "@/testing/portfolio-api";
import { renderApp } from "@/testing/render-app";

const flows = () =>
  screen.findByRole("table", { name: catalogEn["portfolio.return.flows"] });

describe("Portfolio return", () => {
  it("shows the annual return, the opening and the closing (S126)", async () => {
    await renderApp("/portfolio", { fetch: portfolioApi() });
    const figures = await screen.findByRole("group", {
      name: catalogEn["portfolio.return.title"],
    });
    await within(figures).findByText("5.00%");
    expect(within(figures).getByText(/R\$1,000\.00/)).toBeInTheDocument();
    expect(within(figures).getByText(/R\$1,050\.00/)).toBeInTheDocument();
    expect(
      screen.getByText(catalogEn["portfolio.return.noFlows"]),
    ).toBeInTheDocument();
  });

  it("lists the external flows of a contribution (S126)", async () => {
    const fetch = portfolioApi({
      "GET /api/v1/reports/return": () => json(200, contributionReturn),
    });
    await renderApp("/portfolio", { fetch });
    const figures = await screen.findByRole("group", {
      name: catalogEn["portfolio.return.title"],
    });
    await within(figures).findByText("3.33%");
    expect(within(figures).getByText(/R\$2,050\.00/)).toBeInTheDocument();
    const table = await flows();
    expect(
      within(table)
        .getAllByRole("row")
        .map((row) =>
          [...row.querySelectorAll("th, td")]
            .map((c) => c.textContent)
            .join("|"),
        ),
    ).toEqual(["Date|Amount", "04/30/2026|R$1,000.00"]);
  });

  it("asks for the first parent account over the 12 months ending at the valuation date", async () => {
    const asked: URLSearchParams[] = [];
    const fetch = portfolioApi({
      "GET /api/v1/reports/return": (req) => {
        asked.push(new URL(req.url).searchParams);
        return json(200, contributionReturn);
      },
    });
    await renderApp("/portfolio?date=2026-10-31&value_in=USD", { fetch });
    await waitFor(() => {
      expect(
        asked.map((q) => [
          q.get("account_id"),
          q.get("from"),
          q.get("to"),
          q.get("value_in"),
        ]),
      ).toEqual([[brokerID, "2025-11-01", "2026-10-31", "USD"]]);
    });
  });

  it("offers the investment accounts and the parents of one", async () => {
    await renderApp("/portfolio", { fetch: portfolioApi() });
    const user = (await import("@testing-library/user-event")).default.setup();
    await user.click(
      await screen.findByRole("combobox", {
        name: catalogEn["portfolio.return.account"],
      }),
    );
    expect(
      (await screen.findAllByRole("option")).map((o) => o.textContent),
    ).toEqual(["XP", "XP / XP MXRF11", "XP / XP PETR4"]);
  });

  it("states that the return is undefined, with the reason (S127)", async () => {
    const fetch = portfolioApi({
      "GET /api/v1/reports/return": () => problem(422, "return_undefined"),
    });
    await renderApp("/portfolio", { fetch });
    expect(
      await screen.findByText(catalogEn["portfolio.return.undefined"]),
    ).toBeInTheDocument();
    expect(
      screen.getByText(catalogEn["portfolio.return.undefinedWhy"]),
    ).toBeInTheDocument();
  });

  it("states a missing price in the valuation currency", async () => {
    const fetch = portfolioApi({
      "GET /api/v1/reports/return": () => problem(422, "price_missing"),
      "GET /api/v1/reports/allocation": () => problem(422, "price_missing"),
    });
    await renderApp("/portfolio?value_in=USD", { fetch });
    const message = catalogEn["portfolio.priceMissing"].replace(
      "{currency}",
      "USD",
    );
    expect(await screen.findAllByText(message)).toHaveLength(2);
  });

  it("blocks a period above 366 days without asking for it", async () => {
    const asked: string[] = [];
    const fetch = portfolioApi({
      "GET /api/v1/reports/return": (req) => {
        asked.push(req.url);
        return json(200, contributionReturn);
      },
    });
    await renderApp("/portfolio?from=2025-10-01&to=2026-10-17", { fetch });
    expect(
      await screen.findByText(catalogEn["portfolio.return.periodTooLong"]),
    ).toBeInTheDocument();
    expect(asked).toEqual([]);
  });

  it("blocks a start after the end", async () => {
    await renderApp("/portfolio?from=2026-10-17&to=2026-10-01", {
      fetch: portfolioApi(),
    });
    expect(
      await screen.findByText(catalogEn["portfolio.return.periodReversed"]),
    ).toBeInTheDocument();
  });

  it("masks the amounts and keeps the rate in privacy mode", async () => {
    localStorage.setItem("equori.privacy", "hidden");
    const fetch = portfolioApi({
      "GET /api/v1/reports/return": () => json(200, contributionReturn),
    });
    try {
      const { container } = await renderApp("/portfolio", { fetch });
      await screen.findByText("3.33%");
      expect(container.textContent).not.toContain("2,050.00");
      expect(container.textContent).not.toContain("1,000.00");
    } finally {
      localStorage.removeItem("equori.privacy");
    }
  });
});
