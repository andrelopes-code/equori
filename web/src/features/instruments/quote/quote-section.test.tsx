import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";

import { catalogEn } from "@/i18n/catalog.en";
import { json, problem } from "@/testing/fake-api";
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

  it("sums the range in three figures", async () => {
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
    expect(figures.querySelectorAll("[data-ui='stat-card']")).toHaveLength(3);
  });

  // A266 SA6: 5:1 between the two sessions. The change is the one of the holder, and the table of
  // prices keeps the traded close.
  it("measures a range that holds a split by the adjusted prices", async () => {
    const fetch = api({
      "GET /api/v1/prices": () =>
        json(200, {
          items: [
            { ...petr("2026-10-14", "170"), adjusted: "34" },
            petr("2026-10-16", "35.70"),
          ],
        }),
    });
    await renderApp("/instruments/PETR4", { fetch });
    const hero = await screen.findByRole("group", {
      name: "Quote of 10/16/2026 · B3, daily quotes",
    });

    expect(hero).toHaveTextContent("+5.00%");
    const figures = screen.getByRole("region", {
      name: catalogEn["instrument.figures.label"],
    });
    expect(await within(figures).findByText("R$34.00")).toBeInTheDocument();
    expect(within(figures).queryByText("R$170.00")).toBeNull();
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

  describe("month by month", () => {
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
              petr("2026-10-16", "9.00"),
            ],
          }),
      });
    const block = () =>
      screen.findByRole("region", {
        name: catalogEn["instrument.months.title"],
      });
    const monthTable = (quote = "BRL") =>
      screen.findByRole("table", {
        name: `Change of the price in each month, in %. Year-end price in ${quote}.`,
      });
    const rowsOf = (table: HTMLElement) =>
      within(table)
        .getAllByRole("row")
        .map((row) =>
          [...row.querySelectorAll("th, td")]
            .map((cell) => cell.textContent)
            .join("|"),
        );

    // IM2, IM3: 12/10, 18/12 and 9/18, each month over the last price before it.
    it("draws the change of each month, the year and its last price", async () => {
      await renderApp("/instruments/PETR4", { fetch: years() });

      expect(rowsOf(await monthTable())).toEqual([
        "Year|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec|Year|Last price",
        "2026|–|–|–|–|–|–|–|–|–|−50.00|–|–|−50.00|9.00",
        "2025|–|–|–|–|–|–|–|–|–|–|–|50.00|50.00|18.00",
        "2024|–|–|–|–|–|–|–|–|–|–|–|20.00|20.00|12.00",
      ]);
    });

    // IM6: 1.5%, 4%, -8% and 12%, each over the month before it.
    it("shades a month by the steps of a price", async () => {
      const fetch = api({
        "GET /api/v1/prices": () =>
          json(200, {
            items: [
              petr("2026-01-30", "100"),
              petr("2026-02-27", "101.50"),
              petr("2026-03-31", "105.56"),
              petr("2026-04-30", "97.1152"),
              petr("2026-05-29", "108.769"),
            ],
          }),
      });
      await renderApp("/instruments/PETR4", { fetch });
      const cells = (await monthTable()).querySelectorAll("tbody td");

      expect(cells[1]).toHaveClass(/gain1/);
      expect(cells[2]).toHaveClass(/gain2/);
      expect(cells[3]).toHaveClass(/loss3/);
      expect(cells[4]).toHaveClass(/gain4/);
    });

    // IM5
    it("names the best and the worst month and counts the signs", async () => {
      await renderApp("/instruments/PETR4", { fetch: years() });
      await monthTable();
      const facts = [...(await block()).querySelectorAll("dl > div")].map(
        (fact) => fact.textContent,
      );

      expect(facts).toEqual([
        "Best month+50.00% · Dec/2025",
        "Worst month−50.00% · Oct/2026",
        "Months up2 of 3",
        "Months down1 of 3",
      ]);
    });

    it("states that splits are adjusted and income is not included", async () => {
      await renderApp("/instruments/PETR4", { fetch: years() });

      expect(
        within(await block()).getByText(
          catalogEn["instrument.months.description"],
        ),
      ).toBeInTheDocument();
    });

    // IM3: 5:1 between the two months.
    it("reads the adjusted prices", async () => {
      const fetch = api({
        "GET /api/v1/prices": () =>
          json(200, {
            items: [
              { ...petr("2026-09-30", "170"), adjusted: "34" },
              petr("2026-10-16", "35.70"),
            ],
          }),
      });
      await renderApp("/instruments/PETR4", { fetch });

      expect(rowsOf(await monthTable())[1]).toBe(
        "2026|–|–|–|–|–|–|–|–|–|5.00|–|–|5.00|35.70",
      );
    });

    // IM4: both prices of the fixture lie in October 2026.
    it("draws nothing for a series inside one month", async () => {
      await renderApp("/instruments/PETR4", { fetch: api() });
      await screen.findByRole("region", {
        name: catalogEn["instrument.figures.label"],
      });
      await screen.findByText("R$38.10");

      expect(
        screen.queryByRole("region", {
          name: catalogEn["instrument.months.title"],
        }),
      ).toBeNull();
    });

    // IM8
    it("draws twelve years and every year on request", async () => {
      const fetch = api({
        "GET /api/v1/prices": () =>
          json(200, {
            items: Array.from({ length: 14 }, (_, i) =>
              petr(`${String(2013 + i)}-06-03`, String(10 + i)),
            ),
          }),
      });
      await renderApp("/instruments/PETR4", { fetch });
      const user = userEvent.setup();
      const table = await monthTable();
      expect(rowsOf(table)).toHaveLength(13);

      const more = screen.getByRole("button", { name: "Show all 14 years" });
      expect(more).toHaveAttribute("aria-expanded", "false");
      await user.click(more);
      expect(rowsOf(table)).toHaveLength(15);

      await user.click(screen.getByRole("button", { name: "Show 12 years" }));
      expect(rowsOf(table)).toHaveLength(13);
    });

    it("offers no button for twelve years", async () => {
      await renderApp("/instruments/PETR4", { fetch: years() });
      await monthTable();

      expect(
        within(await block()).queryByRole("button"),
      ).not.toBeInTheDocument();
    });

    // IM9: the series of the range max starts on the first quote; the others answer.
    it("states a failed read and offers the retry", async () => {
      const fetch = api({
        "GET /api/v1/instruments/PETR4": () =>
          json(200, {
            code: "PETR4",
            type: "stock",
            scale: 0,
            name: "Petrobras PN",
            quote_currency: "BRL",
            coverage: {
              first: "2010-01-04",
              last: "2026-10-16",
              count: 2,
              stale: false,
              missing: 0,
              sources: [],
            },
          }),
        "GET /api/v1/prices": (req) =>
          new URL(req.url).searchParams.get("from") === "2010-01-04"
            ? problem(500, "internal")
            : json(200, { items: [petr("2026-10-16", "38.45")] }),
      });
      await renderApp("/instruments/PETR4", { fetch });

      const retry = await screen.findByRole("button", {
        name: catalogEn["common.retry"],
      });

      expect(await block()).toContainElement(retry);
    });

    // IM10
    it("masks the prices and the changes in privacy mode", async () => {
      hideAmounts();
      await renderApp("/instruments/PETR4", { fetch: years() });
      await monthTable();
      const region = await block();

      expect(region).not.toHaveTextContent("50.00");
      expect(region).not.toHaveTextContent("18.00");
      expect(region).not.toHaveTextContent("9.00");
    });

    // C3
    it("names the quote currency of the record", async () => {
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

      expect(rowsOf(await monthTable("USD"))[1]).toContain("50.00|27.00");
    });

    // IM7: the newest price has two decimals.
    it("writes the column of prices with the decimals of the newest", async () => {
      const fetch = api({
        "GET /api/v1/prices": () =>
          json(200, {
            items: [
              { ...petr("2025-12-31", "55.39"), adjusted: "27.695" },
              petr("2026-10-16", "14.18"),
            ],
          }),
      });
      await renderApp("/instruments/PETR4", { fetch });
      const rows = rowsOf(await monthTable());

      expect(rows[1]?.split("|").at(-1)).toBe("14.18");
      expect(rows[2]?.split("|").at(-1)).toBe("27.70");
    });
  });
});
