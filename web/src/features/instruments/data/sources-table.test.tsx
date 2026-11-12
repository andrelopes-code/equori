import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { catalogEn } from "@/i18n/catalog.en";
import { json } from "@/testing/fake-api";
import {
  instrumentFixtures,
  instrumentsApi as api,
} from "@/testing/instruments-api";
import { renderApp } from "@/testing/render-app";

const rows = (table: HTMLElement) =>
  within(table)
    .getAllByRole("row")
    .slice(1)
    .map((row) =>
      [...row.querySelectorAll("th, td, [role=gridcell]")]
        .map((cell) => cell.textContent)
        .join("|"),
    );

describe("Sources of an instrument", () => {
  // IP11
  it("lists every source that quotes it, enabled or not, with its dates", async () => {
    await renderApp("/instruments/PETR4", { fetch: twoSources() });
    await userEvent.setup().click(
      await screen.findByRole("button", {
        name: catalogEn["instrument.data.open"],
      }),
    );
    const table = await screen.findByRole("table", {
      name: catalogEn["instrument.sources.caption"],
    });

    expect(rows(table)).toEqual([
      "B3, daily quotes|ActiveOfficial|09/24/2026|10/16/2026",
      `${catalogEn["instruments.source.yahoo_chart"]}|Disabled|—|—`,
    ]);
  });

  it("L2: the page holds the summary line and no sources table until the button is pressed", async () => {
    await renderApp("/instruments/PETR4", { fetch: twoSources() });

    expect(
      await screen.findByText(
        "Quotes: 2, from 09/24/2026 to 10/16/2026. Sources: B3, daily quotes.",
      ),
    ).toBeVisible();
    expect(
      screen.queryByRole("table", {
        name: catalogEn["instrument.sources.caption"],
      }),
    ).toBeNull();

    await userEvent
      .setup()
      .click(
        screen.getByRole("button", { name: catalogEn["instrument.data.open"] }),
      );

    expect(
      await screen.findByRole("table", {
        name: catalogEn["instrument.sources.caption"],
      }),
    ).toBeInTheDocument();
  });

  it("L2: writes the count with the grouping of the locale and no sources clause when none is enabled", async () => {
    const petr = instrumentFixtures.find((i) => i.code === "PETR4");
    const fetch = api({
      "GET /api/v1/instruments/PETR4": () =>
        json(200, {
          ...petr,
          coverage: {
            first: "2026-09-24",
            last: "2026-10-16",
            count: 4965,
            stale: false,
            sources: [],
          },
        }),
    });
    await renderApp("/instruments/PETR4", { fetch });

    expect(
      await screen.findByText("Quotes: 4,965, from 09/24/2026 to 10/16/2026."),
    ).toBeVisible();
  });
});

function twoSources() {
  const petr = instrumentFixtures.find((i) => i.code === "PETR4");

  return api({
    "GET /api/v1/instruments/PETR4": () =>
      json(200, {
        ...petr,
        coverage: {
          first: "2026-09-24",
          last: "2026-10-16",
          count: 2,
          stale: false,
          sources: [
            {
              id: "b3_cotahist",
              enabled: true,
              official: true,
              first: "2026-09-24",
              last: "2026-10-16",
              history: null,
            },
            {
              id: "yahoo_chart",
              enabled: false,
              official: false,
              first: null,
              last: null,
              history: null,
            },
          ],
        },
      }),
  });
}
