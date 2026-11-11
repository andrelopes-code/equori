import { screen, within } from "@testing-library/react";
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
    const petr = instrumentFixtures.find((i) => i.code === "PETR4");
    const fetch = api({
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
    await renderApp("/instruments/PETR4", { fetch });
    const table = await screen.findByRole("table", {
      name: catalogEn["instrument.sources.caption"],
    });

    expect(rows(table)).toEqual([
      "B3, daily quotes|ActiveOfficial|09/24/2026|10/16/2026",
      `${catalogEn["instruments.source.yahoo_chart"]}|Disabled|—|—`,
    ]);
  });
});
