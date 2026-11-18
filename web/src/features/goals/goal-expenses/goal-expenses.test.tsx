import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { catalogEn } from "@/i18n/catalog.en";
import {
  accountRoutes,
  checkingID,
  foodID,
  money,
  reserveID,
} from "@/testing/account-api";
import { fakeApi, json } from "@/testing/fake-api";
import { renderApp } from "@/testing/render-app";

const goalID = "d1000000-0000-4000-8000-000000000001";
const flightID = "f2000000-0000-4000-8000-000000000001";
const hotelID = "f2000000-0000-4000-8000-000000000002";

const trip = {
  id: goalID,
  name: "Trip",
  target: money(3000000),
  due_on: "2027-06-30",
  account_ids: [reserveID],
  counts_as_savings: false,
  current: money(1000000),
  remaining: money(2000000),
  progress_bp: 3333,
  spent: money(300000),
  unexplained_withdrawal: { amount: money(200000), since: "2026-10-01" },
};

const flight = {
  transaction_id: flightID,
  date: "2026-10-06",
  description: "Flight",
  amount: money(300000),
  direct: false,
};

const hotel = {
  id: hotelID,
  date: "2026-10-08",
  description: "Hotel",
  balancing_currency: "BRL",
  links: [],
  postings: [
    { account_id: foodID, amount: money(200000), status: "posted" },
    { account_id: checkingID, amount: money(-200000), status: "posted" },
  ],
};

function words(key: keyof typeof catalogEn, values: Record<string, string>) {
  return Object.entries(values).reduce<string>(
    (text, [k, v]) => text.replace(`{${k}}`, v),
    catalogEn[key],
  );
}

function api(sent: string[]) {
  return fakeApi(
    accountRoutes({
      "GET /api/v1/goals": () => json(200, { items: [trip] }),
      [`GET /api/v1/goals/${goalID}/expenses`]: () =>
        json(200, { items: [flight] }),
      "GET /api/v1/transactions": () => json(200, { items: [hotel] }),
      [`PUT /api/v1/goals/${goalID}/expenses/${hotelID}`]: () => {
        sent.push(`PUT ${hotelID}`);
        return new Response(null, { status: 204 });
      },
      [`DELETE /api/v1/goals/${goalID}/expenses/${flightID}`]: () => {
        sent.push(`DELETE ${flightID}`);
        return new Response(null, { status: 204 });
      },
    }),
  );
}

// Planning coherence A256: the card states what the goal spent and the withdrawal still to be
// explained; the panel removes a paid expense.
describe("goal expenses", () => {
  it("states the spent amount and the withdrawal on the card", async () => {
    await renderApp("/goals", { fetch: api([]) });
    const card = await screen.findByRole("article", { name: "Trip" });

    expect(
      within(card).getByText(words("goals.spent", { amount: "R$3,000.00" })),
    ).toBeVisible();
    expect(
      within(card).getByText(
        words("goals.withdrawal", { amount: "R$2,000.00", date: "10/01/2026" }),
      ),
    ).toBeVisible();
  });

  it("lists the paid expenses and removes one", async () => {
    const sent: string[] = [];
    await renderApp("/goals", { fetch: api(sent) });
    const card = await screen.findByRole("article", { name: "Trip" });
    await userEvent.click(
      within(card).getByRole("button", {
        name: catalogEn["goals.expenses.see"],
      }),
    );

    const panel = await screen.findByRole("dialog", {
      name: words("goals.expenses.title", { name: "Trip" }),
    });
    await userEvent.click(
      await within(panel).findByRole("button", {
        name: words("goals.expenses.unlink", { name: "Flight" }),
      }),
    );

    await waitFor(() => {
      expect(sent).toEqual([`DELETE ${flightID}`]);
    });
  });

  it("links an expense recorded since the withdrawal", async () => {
    const sent: string[] = [];
    await renderApp("/goals", { fetch: api(sent) });
    const card = await screen.findByRole("article", { name: "Trip" });
    await userEvent.click(
      within(card).getByRole("button", {
        name: catalogEn["goals.withdrawal.choose"],
      }),
    );

    const panel = await screen.findByRole("dialog", {
      name: words("goals.expenses.title", { name: "Trip" }),
    });
    await userEvent.click(
      await within(panel).findByRole("button", {
        name: words("goals.expenses.linkOne", { name: "Hotel" }),
      }),
    );

    await waitFor(() => {
      expect(sent).toEqual([`PUT ${hotelID}`]);
    });
  });
});
