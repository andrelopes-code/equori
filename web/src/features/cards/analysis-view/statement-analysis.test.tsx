import { screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { catalogEn } from "@/i18n/catalog.en";
import {
  accountRoutes,
  cardID,
  cardRoutes,
  closedStatementID,
  foodID,
  money,
  statementFixtures,
} from "@/testing/account-api";
import { fakeApi, json } from "@/testing/fake-api";
import { renderApp } from "@/testing/render-app";

const parts = (
  purchases: number,
  installments: number,
  charges: number,
  credits: number,
) => ({
  purchases: money(purchases),
  installments: money(installments),
  charges: money(charges),
  credits: money(credits),
  total: money(purchases + installments + charges + credits),
});

// A region other than BR and a base currency other than BRL.
function api() {
  return fakeApi(
    accountRoutes({
      ...cardRoutes(),
      "GET /api/v1/me": () =>
        json(200, {
          id: 1,
          email: "a@b.c",
          role: "admin",
          language: "en",
          region: "DE",
        }),
      "GET /api/v1/settings": () => json(200, { base_currency: "EUR" }),
      [`GET /api/v1/statements/${closedStatementID}`]: () =>
        json(200, { ...statementFixtures[0], postings: [] }),
      [`GET /api/v1/statements/${closedStatementID}/analytics`]: () =>
        json(200, {
          statement_id: closedStatementID,
          reference: "2026-10",
          ...parts(15000, 33333, 4000, -2000),
          categories: [
            { category_id: foodID, ...parts(15000, 33333, 0, -2000) },
          ],
        }),
      [`GET /api/v1/accounts/${cardID}/statement-analytics`]: () =>
        json(200, {
          items: [
            {
              statement_id: closedStatementID,
              reference: "2026-10",
              ...parts(15000, 33333, 4000, -2000),
            },
          ],
        }),
    }),
  );
}

const rowTexts = (table: HTMLElement) =>
  within(table)
    .getAllByRole("row")
    .map((row) =>
      [...row.querySelectorAll("th, td")].map((c) => c.textContent).join("|"),
    );

describe("statement analysis", () => {
  it("splits a closed statement per category in a chart and a table", async () => {
    await renderApp(`/cards/${cardID}/statements/${closedStatementID}`, {
      fetch: api(),
    });
    const table = await screen.findByRole("table", {
      name: catalogEn["analysis.statement"],
    });
    expect(rowTexts(table)).toEqual([
      "Category|Purchases|Earlier installments|Charges|Credits|Total",
      "Mercado|R$150.00|R$333.33|R$0.00|−R$20.00|R$463.33",
    ]);
  });

  it("splits the card's closed statements on the card page", async () => {
    await renderApp(`/cards/${cardID}`, { fetch: api() });
    const table = await screen.findByRole("table", {
      name: catalogEn["analysis.card"],
    });
    expect(rowTexts(table)).toEqual([
      "Statement|Purchases|Earlier installments|Charges|Credits|Total",
      "Oct 2026|R$150.00|R$333.33|R$40.00|−R$20.00|R$503.33",
    ]);
  });
});
