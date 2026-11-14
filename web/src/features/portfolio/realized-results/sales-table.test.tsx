import { screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import type { components } from "@/api/schema.gen";
import { catalogEn } from "@/i18n/catalog.en";
import { SalesTable } from "@/features/portfolio/realized-results/sales-table";
import { fakeApi } from "@/testing/fake-api";
import { hideAmounts } from "@/testing/privacy";
import { renderWithRouter } from "@/testing/render-app";

type Result = components["schemas"]["RealizedResult"];

function money(amount: number) {
  return { amount, currency: "BRL" };
}

function sale(result: number, kind: Result["kind"] = "swing"): Result {
  return {
    transaction_id: "t",
    account_id: "a",
    instrument: "PETR4",
    date: "2026-03-01",
    kind,
    month: "2026-03",
    quantity: { amount: 1, currency: "PETR4" },
    cost: money(100),
    proceeds: money(100 + result),
    result: money(result),
    tax_class: null,
  };
}

function resultTone(): string {
  const cells = within(
    screen.getAllByRole("row").slice(1)[0] ?? document.body,
  ).getAllByRole("cell");

  return cells[6]?.firstElementChild?.getAttribute("data-tone") ?? "inherit";
}

describe("SalesTable", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it.each([
    ["a gain", 500, "success"],
    ["a loss", -500, "danger"],
  ] as const)("reads %s", async (_name, result, tone) => {
    renderWithRouter(<SalesTable items={[sale(result)]} pending={false} />, {
      path: "/",
      fetch: fakeApi({}),
    });

    await waitFor(() => {
      expect(screen.getAllByRole("row")).toHaveLength(2);
    });
    expect(resultTone()).toBe(tone);
  });

  it.each([
    ["day_trade", 1],
    ["swing", 0],
  ] as const)("marks a %s sale with the day trade tag", async (kind, tags) => {
    renderWithRouter(<SalesTable items={[sale(500, kind)]} pending={false} />, {
      path: "/",
      fetch: fakeApi({}),
    });

    await waitFor(() => {
      expect(screen.getAllByRole("row")).toHaveLength(2);
    });
    expect(screen.queryAllByText(catalogEn["taxYear.dayTrade"])).toHaveLength(
      tags,
    );
  });

  it("keeps the text's own tone when the amounts are hidden", async () => {
    hideAmounts();
    renderWithRouter(<SalesTable items={[sale(500)]} pending={false} />, {
      path: "/",
      fetch: fakeApi({}),
    });

    await waitFor(() => {
      expect(screen.getAllByRole("row")).toHaveLength(2);
    });
    expect(resultTone()).toBe("inherit");
  });
});
