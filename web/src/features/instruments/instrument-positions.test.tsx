import { screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { catalogEn } from "@/i18n/catalog.en";
import { json } from "@/testing/fake-api";
import { money } from "@/testing/account-api";
import {
  instrumentsApi as api,
  positionFixtures,
} from "@/testing/instruments-api";
import { renderApp } from "@/testing/render-app";

const card = (figures: HTMLElement, label: string) =>
  within(figures).getByText(label).closest("[data-ui='stat-card']");

describe("Position of an instrument", () => {
  it("sums the position and reads its unrealized result", async () => {
    await renderApp("/instruments/PETR4", { fetch: api() });
    const figures = await screen.findByRole("region", {
      name: catalogEn["instrument.position.figures"],
    });

    await waitFor(() => {
      expect(
        card(figures, catalogEn["positions.marketValue"]),
      ).toHaveTextContent("R$3,845.00in 1 account");
    });
    expect(card(figures, catalogEn["positions.costBasis"])).toHaveTextContent(
      "R$3,500.00average cost R$35.00",
    );
    const result = card(figures, catalogEn["instrument.position.result"]);
    expect(result).toHaveTextContent("R$+345.00");
    expect(result).toHaveTextContent("+9.9%");
    expect(card(figures, catalogEn["positions.quantity"])).toHaveTextContent(
      "100in 1 account",
    );
  });

  it("writes the result of each account in its row", async () => {
    await renderApp("/instruments/PETR4", { fetch: api() });
    const table = await screen.findByRole("table", {
      name: catalogEn["instrument.positions.caption"],
    });

    expect(await within(table).findByText("+R$345.00 (+9.86%)")).toBeVisible();
  });

  // C3: the cost is in the cost currency, the value in the base currency.
  it("does not compute a result across two currencies", async () => {
    const [petr] = positionFixtures;
    const fetch = api({
      "GET /api/v1/positions": () =>
        json(200, {
          items: [{ ...petr, cost_basis: money(70000, "USD") }],
        }),
    });
    await renderApp("/instruments/PETR4", { fetch });
    const figures = await screen.findByRole("region", {
      name: catalogEn["instrument.position.figures"],
    });

    expect(
      await within(figures).findByText(
        "Cost in USD and value in BRL: the result is not computed.",
      ),
    ).toBeInTheDocument();
  });

  it("states a position with no quote", async () => {
    const [petr] = positionFixtures;
    const unpriced = { ...petr, market_value: undefined };
    const fetch = api({
      "GET /api/v1/positions": () => json(200, { items: [unpriced] }),
    });
    await renderApp("/instruments/PETR4", { fetch });
    const figures = await screen.findByRole("region", {
      name: catalogEn["instrument.position.figures"],
    });

    expect(
      (
        await within(figures).findAllByText(
          catalogEn["instrument.position.noPrice"],
        )
      ).length,
    ).toBeGreaterThan(0);
  });
});
