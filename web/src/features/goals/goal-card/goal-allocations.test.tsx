import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { catalogEn } from "@/i18n/catalog.en";
import { accountRoutes, money, reserveID } from "@/testing/account-api";
import { fakeApi, json } from "@/testing/fake-api";
import { renderApp } from "@/testing/render-app";

const carID = "d1000000-0000-4000-8000-000000000001";
const tripID = "d1000000-0000-4000-8000-000000000002";

function goal(id: string, name: string, allocated: number, other: string) {
  return {
    id,
    name,
    target: money(3000000),
    due_on: "2027-06-30",
    account_ids: [],
    counts_as_savings: false,
    current: money(allocated),
    remaining: money(3000000 - allocated),
    progress_bp: 0,
    spent: money(0),
    allocated_accounts: [
      {
        account_id: reserveID,
        allocated: money(allocated),
        available: money(-50000),
      },
    ],
    over_allocated: money(50000),
    shared_with: [other],
  };
}

const car = goal(carID, "Car", 2000000, tripID);
const trip = goal(tripID, "Trip", 500000, carID);

function words(key: keyof typeof catalogEn, values: Record<string, string>) {
  return Object.entries(values).reduce<string>(
    (text, [k, v]) => text.replace(`{${k}}`, v),
    catalogEn[key],
  );
}

// Planning coherence A255: a goal over a shared account states what it holds there, what
// stands above the balance and which goal shares the account, and releases an amount.
describe("goal allocations", () => {
  it("states the allocation, the excess and the sharing goal, and releases", async () => {
    const sent: unknown[] = [];
    await renderApp("/goals", {
      fetch: fakeApi(
        accountRoutes({
          "GET /api/v1/goals": () => json(200, { items: [car, trip] }),
          [`POST /api/v1/goals/${carID}/allocations`]: async (req) => {
            sent.push(await req.json());
            return json(200, car);
          },
        }),
      ),
    });

    const card = await screen.findByRole("article", { name: "Car" });
    const account = "Reserva de emergência";

    expect(
      within(card).getByText(
        words("goals.allocated", { allocated: "R$20,000.00", account }),
      ),
    ).toBeVisible();
    expect(
      within(card).getByText(
        words("goals.overAllocated", { amount: "R$500.00", account }),
      ),
    ).toBeVisible();
    expect(
      within(card).getByText(
        words("goals.sharedWith", { account, goal: "Trip" }),
      ),
    ).toBeVisible();

    await userEvent.click(
      within(card).getByRole("button", { name: catalogEn["goals.release"] }),
    );
    const dialog = await screen.findByRole("dialog", {
      name: words("goals.release.title", { name: "Car" }),
    });
    await userEvent.type(
      within(dialog).getByRole("textbox", {
        name: catalogEn["goals.allocate.amount"],
      }),
      "100000",
    );
    await userEvent.click(
      within(dialog).getByRole("button", { name: catalogEn["goals.release"] }),
    );

    await waitFor(() => {
      expect(sent).toEqual([{ account_id: reserveID, amount: money(-100000) }]);
    });
  });
});
