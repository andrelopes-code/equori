import { screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { HoldingTrendCell } from "@/features/portfolio/holdings/holding-trend-cell";
import type { Holding } from "@/features/portfolio/model/portfolio-holdings";
import { fakeApi, json } from "@/testing/fake-api";
import { renderWithProviders } from "@/testing/render-app";

function holding(kind: Holding["kind"], quote = "BRL"): Holding {
  return {
    kind,
    code: "BOVA11",
    name: "BOVA11",
    position:
      kind === "position"
        ? {
            prices: [
              {
                instrument: "BOVA11",
                quote_instrument: quote,
                date: "2026-11-12",
                value: "120",
                source: "manual",
              },
            ],
          }
        : undefined,
  } as Holding;
}

// `hits` counts the requests of the series: the fake records only the routes it does not know.
function prices(values: string[]) {
  const hits: string[] = [];
  const fetch = fakeApi({
    "GET /api/v1/prices": () => {
      hits.push("prices");

      return json(200, {
        items: values.map((value, i) => ({
          instrument: "BOVA11",
          quote_instrument: "BRL",
          date: `2026-10-0${String(i + 1)}`,
          value,
          source: "manual",
        })),
      });
    },
  });

  return Object.assign(fetch, { hits });
}

function trend() {
  return screen.findByRole("img", { name: /^BOVA11/ });
}

describe("HoldingTrendCell", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it.each([
    ["rising", ["100", "110", "120"], "success"],
    ["falling", ["120", "110", "100"], "danger"],
  ] as const)("draws a %s series in its tone", async (_name, values, tone) => {
    renderWithProviders(
      <HoldingTrendCell holding={holding("position")} date="2026-11-12" />,
      { fetch: prices([...values]) },
    );

    expect((await trend()).getAttribute("data-tone")).toBe(tone);
  });

  it("draws no line below three points", async () => {
    const fetch = prices(["100", "110"]);
    renderWithProviders(
      <HoldingTrendCell holding={holding("position")} date="2026-11-12" />,
      { fetch },
    );

    await vi.waitFor(() => {
      expect(fetch.hits).toHaveLength(1);
    });
    expect(screen.queryByRole("img")).toBeNull();
  });

  it("asks nothing for the cash of a brokerage", () => {
    const fetch = prices(["100", "110", "120"]);
    renderWithProviders(
      <HoldingTrendCell holding={holding("cash")} date="2026-11-12" />,
      { fetch },
    );

    expect(fetch.hits).toHaveLength(0);
    expect(screen.queryByRole("img")).toBeNull();
  });
});
