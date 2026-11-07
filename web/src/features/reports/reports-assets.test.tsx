import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";

import { catalogEn } from "@/i18n/catalog.en";
import { fakeApi, json, problem } from "@/testing/fake-api";
import { allocations, xpInstitutionID } from "@/testing/portfolio-api";
import { hideAmounts } from "@/testing/privacy";
import { renderApp } from "@/testing/render-app";
import { reportApiRoutes } from "@/testing/report-api";

const rowTexts = (table: HTMLElement) =>
  within(table)
    .getAllByRole("row")
    .map((row) =>
      [...row.querySelectorAll("th, td")].map((c) => c.textContent).join("|"),
    );

const assetsTable = () =>
  screen.findByRole("table", { name: catalogEn["report.assets.title"] });

type Route = (req: Request) => Response;

function api(overrides: Record<string, Route> = {}) {
  return fakeApi({
    ...reportApiRoutes(),
    "GET /api/v1/institutions": () =>
      json(200, { items: [{ id: xpInstitutionID, name: "XP" }] }),
    "GET /api/v1/reports/allocation": (req) =>
      json(
        200,
        allocations[
          new URL(req.url).searchParams.get("by") as keyof typeof allocations
        ],
      ),
    ...overrides,
  });
}

describe("Reports assets allocation", () => {
  afterEach(() => {
    localStorage.removeItem("equori.privacy");
  });

  it("PC21: lists every asset account by type with its value and share (S128)", async () => {
    await renderApp("/reports", { fetch: api() });
    const table = await assetsTable();
    await within(table).findByText("Currencies");
    expect(rowTexts(table)).toEqual([
      `Group||Value|${catalogEn["report.assets.share"]}`,
      "Currencies||R$900.00|89.55%",
      "REITs||R$105.00|10.45%",
      "Total|R$1,005.00|100.00%",
    ]);
    expect(
      within(table)
        .getByText("Currencies")
        .closest("tr")
        ?.querySelector("[style]"),
    ).toHaveStyle({ inlineSize: "89.55%" });
  });

  it("falls back to the raw key of a type without a catalog entry", async () => {
    const fetch = api({
      "GET /api/v1/reports/allocation": () =>
        json(200, {
          total: { amount: 500, currency: "BRL" },
          groups: [
            {
              key: "tokenized_land",
              value: { amount: 500, currency: "BRL" },
              share_bp: 10000,
            },
          ],
        }),
    });
    await renderApp("/reports", { fetch });
    const table = await assetsTable();
    expect(
      await within(table).findByText("tokenized_land"),
    ).toBeInTheDocument();
  });

  it("groups by institution from the address and names the account without one", async () => {
    await renderApp("/reports?assets_by=institution", { fetch: api() });
    const table = await assetsTable();
    await within(table).findByText("XP");
    expect(rowTexts(table).slice(1, 3)).toEqual([
      "XP||R$505.00|50.24%",
      `${catalogEn["portfolio.allocation.noInstitution"]}||R$500.00|49.76%`,
    ]);
    expect(document.body.textContent).not.toContain(xpInstitutionID);
  });

  it("changes the grouping from the selector", async () => {
    await renderApp("/reports", { fetch: api() });
    const user = userEvent.setup();
    const table = await assetsTable();
    await within(table).findByText("Currencies");
    await user.click(
      screen.getByRole("radio", { name: catalogEn["portfolio.by.currency"] }),
    );
    await within(await assetsTable()).findByText("BRL");
  });

  it("reads the last day of the period in the valuation currency", async () => {
    const asked: URLSearchParams[] = [];
    const fetch = api({
      "GET /api/v1/reports/allocation": (req) => {
        asked.push(new URL(req.url).searchParams);
        return json(200, { total: { amount: 0, currency: "USD" }, groups: [] });
      },
    });
    await renderApp("/reports?value_in=USD&from=2026-01-01&to=2026-03-31", {
      fetch,
    });
    await waitFor(() => {
      expect(
        asked.map((q) => [q.get("date"), q.get("by"), q.get("value_in")]),
      ).toEqual([["2026-03-31", "type", "USD"]]);
    });
  });

  it("states a missing price in the valuation currency", async () => {
    const fetch = api({
      "GET /api/v1/reports/allocation": () => problem(422, "price_missing"),
    });
    await renderApp("/reports?value_in=USD", { fetch });
    expect(
      await screen.findByText(
        catalogEn["portfolio.priceMissing"].replace("{currency}", "USD"),
      ),
    ).toBeInTheDocument();
  });

  it("shows the empty state of a date before any posting", async () => {
    const fetch = api({
      "GET /api/v1/reports/allocation": () =>
        json(200, { total: { amount: 0, currency: "BRL" }, groups: [] }),
    });
    await renderApp("/reports", { fetch });
    expect(
      await screen.findByText(catalogEn["portfolio.allocation.empty"]),
    ).toBeInTheDocument();
  });

  it("masks the values and keeps the shares in privacy mode", async () => {
    hideAmounts();
    await renderApp("/reports", { fetch: api() });
    const table = await assetsTable();
    await within(table).findByText("89.55%");
    expect(table.textContent).not.toContain("R$900.00");
  });
});
