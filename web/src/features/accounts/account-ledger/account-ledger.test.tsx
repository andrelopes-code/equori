import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { catalogEn } from "@/i18n/catalog.en";
import {
  accountFixtures,
  accountRoutes,
  cashID,
  checkingID,
  foodID,
  money,
  parentID,
  reserveID,
} from "@/testing/account-api";
import { fakeApi, json } from "@/testing/fake-api";
import { renderApp } from "@/testing/render-app";

function tx(id: string, date: string, postings: [string, number, string?][]) {
  return {
    id,
    date,
    description: `Entry ${id}`,
    balancing_currency: "BRL",
    origin: "manual",
    version: 1,
    tags: [],
    links: [],
    postings: postings.map(([account_id, amount, status], i) => ({
      id: `${id}-${String(i)}`,
      account_id,
      amount: money(amount),
      weight: money(amount),
      status: status ?? "cleared",
    })),
  };
}

const items = [
  tx("t3", "2026-10-15", [
    [checkingID, -12000],
    [foodID, 12000],
  ]),
  tx("t2", "2026-10-15", [
    [checkingID, -3000, "reconciled"],
    [foodID, 3000],
  ]),
  tx("t1", "2026-10-02", [
    [checkingID, 200000],
    [foodID, -200000],
  ]),
];

function api(queries: URLSearchParams[] = [], rows: unknown[] = items) {
  return fakeApi(
    accountRoutes({
      "GET /api/v1/transactions": (req) => {
        queries.push(new URL(req.url).searchParams);
        return json(200, { items: rows });
      },
      [`GET /api/v1/accounts/${checkingID}/balance`]: () =>
        json(200, {
          account_id: checkingID,
          date: "2026-10-17",
          basis: "booked",
          balance: money(524055),
        }),
      [`GET /api/v1/accounts/${parentID}/balance`]: () =>
        json(200, {
          account_id: parentID,
          date: "2026-10-17",
          basis: "booked",
          balance: money(15000),
        }),
    }),
  );
}

async function ledger() {
  return screen.findByRole("table", { name: catalogEn["ledger.caption"] });
}

describe("Account movements", () => {
  it("reads the account's transactions of the last 90 days", async () => {
    const queries: URLSearchParams[] = [];
    await renderApp(`/accounts/${checkingID}`, { fetch: api(queries) });
    await ledger();
    const query = queries.find((q) => q.get("account_id") === checkingID);
    expect(query?.get("from")).toBe("2026-07-20");
    expect(query?.get("to")).toBe("2026-10-17");
  });

  it("draws the balance after each movement, walked back from today's balance", async () => {
    await renderApp(`/accounts/${checkingID}`, { fetch: api() });
    const table = await ledger();
    const newest = await within(table).findByRole("row", { name: /Entry t3/ });
    expect(within(newest).getByText("R$5,240.55")).toBeInTheDocument();
    const middle = within(table).getByRole("row", { name: /Entry t2/ });
    expect(within(middle).getByText("R$5,360.55")).toBeInTheDocument();
    const oldest = within(table).getByRole("row", { name: /Entry t1/ });
    expect(within(oldest).getByText("R$5,390.55")).toBeInTheDocument();
  });

  it("marks a reconciled movement with its state in words", async () => {
    await renderApp(`/accounts/${checkingID}`, { fetch: api() });
    const table = await ledger();
    const row = await within(table).findByRole("row", { name: /Entry t2/ });
    expect(
      within(row).getByLabelText(catalogEn["posting.status.reconciled"]),
    ).toBeInTheDocument();
  });

  it("states each day's net change on its band", async () => {
    await renderApp(`/accounts/${checkingID}`, { fetch: api() });
    const table = await ledger();
    expect(await within(table).findByText("−R$150.00")).toBeInTheDocument();
  });

  it("draws no balance for a parent account", async () => {
    await renderApp(`/accounts/${parentID}`, { fetch: api() });
    const table = await ledger();
    expect(
      within(table).queryByRole("columnheader", {
        name: catalogEn["ledger.balanceAfter"],
      }),
    ).not.toBeInTheDocument();
    expect(cashID).toBeDefined();
  });

  it("titles a transfer with an empty description from its two accounts", async () => {
    const transfer = {
      ...tx("t4", "2026-10-16", [
        [checkingID, -5000],
        [reserveID, 5000],
      ]),
      description: "",
    };
    await renderApp(`/accounts/${checkingID}`, {
      fetch: api([], [transfer]),
    });
    const table = await ledger();

    expect(
      await within(table).findByRole("link", {
        name: "Transfer from Nubank to Reserva de emergência",
      }),
    ).toBeInTheDocument();
  });

  it("opens the transaction of a row", async () => {
    const { router } = await renderApp(`/accounts/${checkingID}`, {
      fetch: api(),
    });
    const table = await ledger();
    await userEvent.click(
      await within(table).findByRole("link", { name: /Entry t1/ }),
    );
    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/transactions/t1");
    });
  });
});

// Spec 2026-11-21-mobile-statement: below 600 px the movements read as the statement of
// /transactions, with the balance each one left under its amount.
describe("Account movements on a phone", () => {
  // The placeholder list carries the same name while the first page loads; a day's heading
  // appears only in the statement.
  async function statement() {
    await screen.findAllByRole("heading", { level: 3 });
    return screen.getByRole("list", { name: catalogEn["ledger.caption"] });
  }

  it("reads the movements as a statement of days", async () => {
    await renderApp(`/accounts/${checkingID}`, { fetch: api(), width: 390 });
    const list = await statement();

    expect(
      within(list).getByRole("heading", { name: "Thu, Oct 15−R$150.00" }),
    ).toBeInTheDocument();
    const row = await within(list).findByRole("button", { name: /Entry t3/ });
    expect(within(row).getByText("Mercado")).toBeInTheDocument();
    expect(within(row).getByText("−R$120.00")).toBeInTheDocument();
    expect(within(row).getByText("R$5,240.55")).toBeInTheDocument();
    expect(
      within(list).queryByText(catalogEn["posting.status.cleared"]),
    ).toBeNull();
  });

  it("names a pending movement's state before its accounts", async () => {
    const pending = tx("t5", "2026-10-16", [
      [checkingID, -4000, "pending"],
      [foodID, 4000],
    ]);
    await renderApp(`/accounts/${checkingID}`, {
      fetch: api([], [pending]),
      width: 390,
    });
    const list = await statement();

    const row = await within(list).findByRole("button", { name: /Entry t5/ });
    expect(
      within(row).getByText(catalogEn["posting.status.pending"]),
    ).toBeInTheDocument();
  });

  // The uncategorized system account reads as "?", as on /transactions.
  it("marks a movement to the uncategorized account with a question mark", async () => {
    const uncategorizedID = "a1000000-0000-4000-8000-0000000000ff";
    const loose = tx("t6", "2026-10-16", [
      [checkingID, -4000],
      [uncategorizedID, 4000],
    ]);
    const fetch = fakeApi(
      accountRoutes({
        "GET /api/v1/accounts": () =>
          json(200, {
            items: [
              ...accountFixtures,
              {
                id: uncategorizedID,
                name: "Uncategorized expense",
                class: "expense",
                currency: "BRL",
                system_role: "uncategorized_expense",
              },
            ],
          }),
        "GET /api/v1/transactions": () => json(200, { items: [loose] }),
        [`GET /api/v1/accounts/${checkingID}/balance`]: () =>
          json(200, {
            account_id: checkingID,
            date: "2026-10-17",
            basis: "booked",
            balance: money(524055),
          }),
      }),
    );
    await renderApp(`/accounts/${checkingID}`, { fetch, width: 390 });
    const list = await statement();

    const row = await within(list).findByRole("button", { name: /Entry t6/ });
    expect(within(row).getByText("?")).toBeInTheDocument();
  });

  it("opens the transaction of a row", async () => {
    const { router } = await renderApp(`/accounts/${checkingID}`, {
      fetch: api(),
      width: 390,
    });
    const list = await statement();

    await userEvent.click(
      await within(list).findByRole("button", { name: /Entry t1/ }),
    );

    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/transactions/t1");
    });
  });
});
