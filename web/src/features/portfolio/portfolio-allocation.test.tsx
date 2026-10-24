import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";

import { catalogEn } from "@/i18n/catalog.en";
import { json, problem } from "@/testing/fake-api";
import { portfolioApi } from "@/testing/portfolio-api";
import { hideAmounts } from "@/testing/privacy";
import { renderApp } from "@/testing/render-app";

const rowTexts = (table: HTMLElement) =>
  within(table)
    .getAllByRole("row")
    .map((row) =>
      [...row.querySelectorAll("th, td")].map((c) => c.textContent).join("|"),
    );

const allocationTable = (by: "type" | "currency" | "institution") =>
  screen.findByRole("table", {
    name: catalogEn[`portfolio.allocation.title.${by}`],
  });

describe("Portfolio allocation", () => {
  afterEach(() => {
    localStorage.removeItem("equori.privacy");
  });

  it("shows the groups by type with value and share (S128)", async () => {
    await renderApp("/portfolio", { fetch: portfolioApi() });
    const table = await allocationTable("type");
    await within(table).findByText("Currencies");
    expect(rowTexts(table)).toEqual([
      "Group|Value|Share",
      "Currencies|R$900.00|89.55%",
      "REITs|R$105.00|10.45%",
      "Total|R$1,005.00|100.00%",
    ]);
  });

  it("falls back to the raw key of a type without a catalog entry", async () => {
    const fetch = portfolioApi({
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
    await renderApp("/portfolio", { fetch });
    const table = await allocationTable("type");
    expect(
      await within(table).findByText("tokenized_land"),
    ).toBeInTheDocument();
  });

  it("groups by institution and names the account without one", async () => {
    await renderApp("/portfolio?by=institution", { fetch: portfolioApi() });
    const table = await allocationTable("institution");
    await within(table).findByText("XP");
    expect(rowTexts(table)).toEqual([
      "Group|Value|Share",
      "XP|R$505.00|50.24%",
      `${catalogEn["portfolio.allocation.noInstitution"]}|R$500.00|49.76%`,
      "Total|R$1,005.00|100.00%",
    ]);
  });

  it("groups by currency by the ISO code", async () => {
    await renderApp("/portfolio?by=currency", { fetch: portfolioApi() });
    const table = await allocationTable("currency");
    await within(table).findByText("BRL");
    expect(rowTexts(table)[1]).toBe("BRL|R$1,005.00|100.00%");
  });

  it("changes the grouping from the selector", async () => {
    await renderApp("/portfolio", { fetch: portfolioApi() });
    const user = userEvent.setup();
    await allocationTable("type");
    await user.click(
      screen.getByRole("radio", {
        name: catalogEn["portfolio.by.institution"],
      }),
    );
    await allocationTable("institution");
  });

  it("sends the date, the grouping and the valuation currency, and not on the positions", async () => {
    const allocation: URLSearchParams[] = [];
    const positions: URLSearchParams[] = [];
    const fetch = portfolioApi({
      "GET /api/v1/reports/allocation": (req) => {
        allocation.push(new URL(req.url).searchParams);
        return json(200, { total: { amount: 0, currency: "USD" }, groups: [] });
      },
      "GET /api/v1/positions": (req) => {
        positions.push(new URL(req.url).searchParams);
        return json(200, { items: [] });
      },
    });
    await renderApp("/portfolio?date=2026-09-30&value_in=USD", { fetch });
    await waitFor(() => {
      expect(
        allocation.map((q) => [q.get("date"), q.get("by"), q.get("value_in")]),
      ).toEqual([["2026-09-30", "type", "USD"]]);
    });
    expect(positions.map((q) => q.get("value_in"))).toEqual([null]);
  });

  it("values in the base currency when none is chosen", async () => {
    const asked: (string | null)[] = [];
    const fetch = portfolioApi({
      "GET /api/v1/reports/allocation": (req) => {
        asked.push(new URL(req.url).searchParams.get("value_in"));
        return json(200, { total: { amount: 0, currency: "BRL" }, groups: [] });
      },
    });
    await renderApp("/portfolio", { fetch });
    await waitFor(() => {
      expect(asked).toEqual(["BRL"]);
    });
  });

  it("offers the currencies of the catalog as the valuation currency", async () => {
    await renderApp("/portfolio", { fetch: portfolioApi() });
    const user = userEvent.setup();
    await user.click(
      await screen.findByRole("combobox", {
        name: catalogEn["portfolio.valueIn"],
      }),
    );
    expect(
      (await screen.findAllByRole("option")).map((o) => o.textContent),
    ).toEqual(["BRL", "USD"]);
  });

  it("states a missing price in the valuation currency", async () => {
    const fetch = portfolioApi({
      "GET /api/v1/reports/allocation": () => problem(422, "price_missing"),
    });
    await renderApp("/portfolio?value_in=USD", { fetch });
    expect(
      await screen.findByText(
        catalogEn["portfolio.priceMissing"].replace("{currency}", "USD"),
      ),
    ).toBeInTheDocument();
  });

  it("shows the empty state of a date before any posting", async () => {
    const fetch = portfolioApi({
      "GET /api/v1/reports/allocation": () =>
        json(200, { total: { amount: 0, currency: "BRL" }, groups: [] }),
    });
    await renderApp("/portfolio", { fetch });
    expect(
      await screen.findByText(catalogEn["portfolio.allocation.empty"]),
    ).toBeInTheDocument();
  });

  it("fails on its own while the positions still load", async () => {
    const fetch = portfolioApi({
      "GET /api/v1/reports/allocation": () => problem(500, "internal_error"),
    });
    await renderApp("/portfolio", { fetch });
    expect(
      await screen.findByText(catalogEn["common.error.title"]),
    ).toBeInTheDocument();
    expect(
      await screen.findByRole("table", {
        name: catalogEn["portfolio.positions.title"],
      }),
    ).toBeInTheDocument();
  });

  it("masks the values and keeps the shares in privacy mode", async () => {
    hideAmounts();
    await renderApp("/portfolio", { fetch: portfolioApi() });
    const table = await allocationTable("type");
    await within(table).findByText("Currencies");
    const text = rowTexts(table).join("\n");
    expect(text).toContain("89.55%");
    expect(text).not.toContain("900.00");
    expect(text).not.toContain("1,005.00");
  });
});
