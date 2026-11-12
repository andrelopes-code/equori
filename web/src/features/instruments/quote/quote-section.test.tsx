import { screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { catalogEn } from "@/i18n/catalog.en";
import { json } from "@/testing/fake-api";
import { instrumentsApi as api, price } from "@/testing/instruments-api";
import { hideAmounts } from "@/testing/privacy";
import { renderApp } from "@/testing/render-app";

const petr = (date: string, value: string, source = "b3_cotahist") =>
  price("PETR4", date, value, source);

describe("Quote section", () => {
  it("reads the latest price against the quote before it", async () => {
    await renderApp("/instruments/PETR4", { fetch: api() });
    const hero = await screen.findByRole("group", {
      name: "Quote of 10/16/2026 · B3, daily quotes",
    });

    expect(hero).toHaveTextContent("R$38.45");
    expect(hero).toHaveTextContent("+0.92%");
    expect(hero).toHaveTextContent("against the quote of 10/14/2026");
    expect(within(hero).getAllByText(/38\.45/)).toHaveLength(1);
  });

  it("keeps the comparison line when there is nothing to compare", async () => {
    const fetch = api({
      "GET /api/v1/prices": () =>
        json(200, { items: [petr("2026-10-16", "38.45")] }),
    });
    await renderApp("/instruments/PETR4", { fetch });

    expect(
      await screen.findByText(catalogEn["instrument.quote.firstQuote"]),
    ).toBeInTheDocument();
  });

  it("sums the range in four figures", async () => {
    await renderApp("/instruments/PETR4", { fetch: api() });
    const figures = await screen.findByRole("region", {
      name: catalogEn["instrument.figures.label"],
    });
    const card = async (label: string) =>
      (await within(figures).findByText(label)).closest(
        "[data-ui='stat-card']",
      );

    await within(figures).findByText("R$38.10");

    // Fixture: 38.10 on 2026-10-14 and 38.45 on 2026-10-16, so the change is +0.92%.
    const change = await card(catalogEn["instrument.figures.change"]);
    expect(change).toHaveTextContent("+0.92%from 10/14/2026 to 10/16/2026");
    expect(change).not.toHaveTextContent("R$38.45");
    expect(change).toHaveAttribute("data-size", "sm");
    expect(change).not.toHaveClass(/change/);
    expect(figures.querySelector("[data-ui='stat-card']")).toBe(change);
    expect(await card(catalogEn["instrument.figures.high"])).toHaveTextContent(
      "R$38.4510/16/2026",
    );
    expect(await card(catalogEn["instrument.figures.low"])).toHaveTextContent(
      "R$38.1010/14/2026",
    );
    expect(
      await card(catalogEn["instrument.figures.points"]),
    ).toHaveTextContent(`2${catalogEn["instrument.figures.pointsNote"]}`);
  });

  it("writes a dash as the change of a range of one quote", async () => {
    const fetch = api({
      "GET /api/v1/prices": () =>
        json(200, { items: [petr("2026-10-16", "38.45")] }),
    });
    await renderApp("/instruments/PETR4", { fetch });
    const figures = await screen.findByRole("region", {
      name: catalogEn["instrument.figures.label"],
    });
    const change = (
      await within(figures).findByText(catalogEn["instrument.figures.change"])
    ).closest("[data-ui='stat-card']");

    await within(figures).findAllByText("R$38.45");

    expect(change).toHaveTextContent("—");
    expect(change).not.toHaveTextContent("%");
    expect(change).not.toHaveTextContent("R$38.45");
  });

  it("states that an instrument with no quote has none", async () => {
    const fetch = api({
      "GET /api/v1/prices": () => json(200, { items: [] }),
    });
    await renderApp("/instruments/PETR4", { fetch });

    expect(
      await screen.findByText(catalogEn["instrument.quote.none"]),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("region", {
        name: catalogEn["instrument.figures.label"],
      }),
    ).toBeNull();
  });

  describe("price change by year", () => {
    // hideAmounts writes localStorage, which outlives the test.
    afterEach(() => {
      localStorage.clear();
    });

    const years = () =>
      api({
        "GET /api/v1/prices": () =>
          json(200, {
            items: [
              petr("2024-03-14", "10.00"),
              petr("2024-12-31", "12.00"),
              petr("2025-12-31", "18.00"),
              petr("2026-10-16", "27.00"),
            ],
          }),
      });
    const yearTable = () =>
      screen.findByRole("table", {
        name: catalogEn["instrument.yearly.title"],
      });

    it("draws the price change of each calendar year", async () => {
      await renderApp("/instruments/PETR4", { fetch: years() });
      const rows = within(await yearTable())
        .getAllByRole("row")
        .slice(1);

      expect(rows).toHaveLength(3);
      expect(rows[0]).toHaveTextContent("2026");
      expect(rows[0]).toHaveTextContent("10/16/2026");
      expect(rows[0]).toHaveTextContent("R$18.00");
      expect(rows[0]).toHaveTextContent("R$27.00");
      expect(rows[0]).toHaveTextContent("+50.00%");
      expect(rows[1]).toHaveTextContent("2025");
      expect(rows[1]).toHaveTextContent("+50.00%");
      expect(rows[2]).toHaveTextContent("2024");
      expect(rows[2]).toHaveTextContent("03/14/2024");
      expect(rows[2]).toHaveTextContent("+20.00%");
    });

    it("states that income is not included", async () => {
      await renderApp("/instruments/PETR4", { fetch: years() });
      await yearTable();

      expect(
        screen.getByText(catalogEn["instrument.yearly.note"]),
      ).toBeInTheDocument();
    });

    it("draws nothing for a series inside one year", async () => {
      await renderApp("/instruments/PETR4", { fetch: api() });
      await screen.findByRole("region", {
        name: catalogEn["instrument.figures.label"],
      });

      expect(
        screen.queryByRole("table", {
          name: catalogEn["instrument.yearly.title"],
        }),
      ).toBeNull();
    });

    it("masks the prices and the change in privacy mode", async () => {
      hideAmounts();
      await renderApp("/instruments/PETR4", { fetch: years() });
      const table = await yearTable();

      expect(table).not.toHaveTextContent("+50.00%");
      expect(table).not.toHaveTextContent("27.00");
    });

    it("writes the prices of a USD quote in USD", async () => {
      const fetch = api({
        "GET /api/v1/instruments/PETR4": () =>
          json(200, {
            code: "PETR4",
            type: "stock",
            scale: 0,
            name: "Petrobras PN",
            quote_currency: "USD",
          }),
        "GET /api/v1/prices": () =>
          json(200, {
            items: [
              price("PETR4", "2025-12-31", "18.00", "manual", "USD"),
              price("PETR4", "2026-10-16", "27.00", "manual", "USD"),
            ],
          }),
      });
      await renderApp("/instruments/PETR4", { fetch });
      const row = within(await yearTable())
        .getAllByRole("row")
        .at(1);

      expect(row).toHaveTextContent("$18.00$27.00");
      expect(row).not.toHaveTextContent("R$");
    });
  });
});
