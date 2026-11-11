import { screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { catalogEn } from "@/i18n/catalog.en";
import { json } from "@/testing/fake-api";
import { instrumentsApi as api, price } from "@/testing/instruments-api";
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

    expect(
      await card(catalogEn["instrument.figures.change"]),
    ).toHaveTextContent("+0.92%from 10/14/2026 to 10/16/2026");
    expect(await card(catalogEn["instrument.figures.high"])).toHaveTextContent(
      "R$38.4510/16/2026",
    );
    expect(await card(catalogEn["instrument.figures.low"])).toHaveTextContent(
      "R$38.1010/14/2026",
    );
    expect(
      await card(catalogEn["instrument.figures.points"]),
    ).toHaveTextContent(`2${catalogEn["instrument.figures.pointsDay"]}`);
  });

  // MQ30
  it("says what one point of a weekly range stands for", async () => {
    const fetch = api({
      "GET /api/v1/prices": () =>
        json(200, {
          interval: "week",
          items: [petr("2026-10-09", "38.10"), petr("2026-10-16", "38.45")],
        }),
    });
    await renderApp("/instruments/PETR4", { fetch });

    expect(
      await screen.findByText(catalogEn["instrument.interval.week"]),
    ).toBeInTheDocument();
    expect(
      screen.getByText(catalogEn["instrument.figures.pointsWeek"]),
    ).toBeInTheDocument();
  });

  it("says nothing of an interval for daily points", async () => {
    await renderApp("/instruments/PETR4", { fetch: api() });
    await screen.findByRole("region", {
      name: catalogEn["instrument.figures.label"],
    });

    expect(
      screen.queryByText(catalogEn["instrument.interval.week"]),
    ).toBeNull();
  });

  it("states that an instrument with no quote has none", async () => {
    const fetch = api({
      "GET /api/v1/prices": () => json(200, { interval: "day", items: [] }),
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
});
