import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";

import { catalogEn } from "@/i18n/catalog.en";
import { fakeApi, json } from "@/testing/fake-api";
import { renderApp } from "@/testing/render-app";
import { transactionFixture } from "@/testing/transaction-api";

// A region other than BR and a base currency other than BRL.
const checkingID = "11111111-1111-4111-8111-111111111111";
const groceriesID = "22222222-2222-4222-8222-222222222222";
const transportID = "77777777-7777-4777-8777-777777777777";
const uncategorizedID = "99999999-9999-4999-8999-999999999999";
const bakeryID = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const taxiID = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
const cinemaID = "ffffffff-ffff-4fff-8fff-ffffffffffff";

const money = (amount: number) => ({ amount, currency: "EUR" });

function uncategorized(id: string, description: string, version: number) {
  return transactionFixture({
    id,
    description,
    payee_id: undefined,
    balancing_currency: "EUR",
    tags: [],
    version,
    postings: [
      {
        id: `${id}-a`,
        account_id: checkingID,
        amount: money(-1250),
        weight: money(-1250),
        status: "cleared",
      },
      {
        id: `${id}-b`,
        account_id: uncategorizedID,
        amount: money(1250),
        weight: money(1250),
        status: "cleared",
      },
    ],
  });
}

const bakery = uncategorized(bakeryID, "PASTELARIA BELEM", 2);
const taxi = uncategorized(taxiID, "BOLT RIDE", 4);
const cinema = uncategorized(cinemaID, "CINEMA NOS", 1);

interface Sent {
  path: string;
  body: unknown;
}

function api(sent: Sent[], available = true) {
  return fakeApi({
    "GET /api/v1/me": () =>
      json(200, {
        id: 1,
        email: "a@b.c",
        role: "admin",
        language: "en",
        region: "PT",
      }),
    "GET /api/v1/settings": () => json(200, { base_currency: "EUR" }),
    "GET /api/v1/instruments": () =>
      json(200, {
        items: [{ code: "EUR", type: "currency", scale: 2, name: "Euro" }],
      }),
    "GET /api/v1/accounts": () =>
      json(200, {
        items: [
          {
            id: checkingID,
            name: "Millennium",
            class: "asset",
            kind: "checking",
            currency: "EUR",
          },
          {
            id: groceriesID,
            name: "Groceries",
            class: "expense",
            currency: "EUR",
          },
          {
            id: transportID,
            name: "Transport",
            class: "expense",
            currency: "EUR",
          },
          {
            id: uncategorizedID,
            name: "Uncategorized expense",
            class: "expense",
            currency: "EUR",
            system_role: "uncategorized_expense",
          },
        ],
      }),
    "GET /api/v1/payees": () => json(200, { items: [] }),
    "GET /api/v1/tags": () => json(200, { items: [] }),
    "GET /api/v1/transactions": () =>
      json(200, { items: [bakery, taxi, cinema] }),
    "POST /api/v1/transactions/category-suggestions": async (req) => {
      const body = (await req.json()) as { transaction_ids: string[] };
      sent.push({ path: "suggest", body });
      if (!available)
        return json(200, {
          available: false,
          items: body.transaction_ids.map((id) => ({ transaction_id: id })),
        });
      return json(200, {
        available: true,
        items: [
          {
            transaction_id: bakeryID,
            category_id: groceriesID,
            source: "model",
          },
          { transaction_id: taxiID, category_id: transportID, source: "kept" },
          { transaction_id: cinemaID },
        ],
      });
    },
    "POST /api/v1/transactions/categorize": async (req) => {
      const body = (await req.json()) as { items: { id: string }[] };
      sent.push({ path: "categorize", body });
      return json(200, {
        results: body.items.map((item) => ({
          id: item.id,
          status: "categorized",
          version: 9,
        })),
      });
    },
  });
}

async function suggestForAll(sent: Sent[], available = true) {
  await renderApp("/transactions?uncategorized=true", {
    fetch: api(sent, available),
  });
  for (const name of ["PASTELARIA BELEM", "BOLT RIDE", "CINEMA NOS"])
    await userEvent.click(
      await screen.findByRole("checkbox", { name: `Select ${name}` }),
    );
  await userEvent.click(
    screen.getByRole("button", { name: catalogEn["selection.suggest"] }),
  );
  return screen.findByRole("dialog", {
    name: catalogEn["suggest.title"],
  });
}

beforeEach(() => {
  localStorage.clear();
});

describe("suggesting categories for a selection", () => {
  it("records only the accepted suggestions, each under its category", async () => {
    const sent: Sent[] = [];
    const dialog = await suggestForAll(sent);
    await waitFor(() => {
      expect(sent[0]).toEqual({
        path: "suggest",
        body: { transaction_ids: [bakeryID, taxiID, cinemaID] },
      });
    });
    const bakeryBox = await within(dialog).findByRole("checkbox", {
      name: "PASTELARIA BELEM: Groceries",
    });
    const taxiBox = within(dialog).getByRole("checkbox", {
      name: "BOLT RIDE: Transport",
    });
    expect(bakeryBox).toBeChecked();
    expect(taxiBox).toBeChecked();
    expect(
      within(dialog).getByText("Without a suggestion: 1"),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByText(catalogEn["suggest.sends"]),
    ).toBeInTheDocument();

    await userEvent.click(taxiBox);
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Record 1 accepted" }),
    );
    await waitFor(() => {
      expect(sent[1]).toEqual({
        path: "categorize",
        body: {
          category_id: groceriesID,
          items: [{ id: bakeryID, expected_version: 2 }],
        },
      });
    });
    expect(sent).toHaveLength(2);
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull();
    });
  });

  it("says when no model can answer and records nothing", async () => {
    const sent: Sent[] = [];
    const dialog = await suggestForAll(sent, false);
    expect(
      await within(dialog).findByText(catalogEn["suggest.unavailable"]),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByRole("button", { name: "Record 0 accepted" }),
    ).toBeDisabled();
  });

  it("offers the action only in the uncategorized queue", async () => {
    await renderApp("/transactions", { fetch: api([]) });
    await userEvent.click(
      await screen.findByRole("checkbox", { name: "Select BOLT RIDE" }),
    );
    expect(
      screen.queryByRole("button", { name: catalogEn["selection.suggest"] }),
    ).toBeNull();
  });
});
