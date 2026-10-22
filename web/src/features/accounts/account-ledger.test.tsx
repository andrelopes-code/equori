import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { catalogEn } from "@/i18n/catalog.en";
import {
  accountRoutes,
  cashID,
  checkingID,
  foodID,
  money,
  parentID,
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

function api(queries: URLSearchParams[] = []) {
  return fakeApi(
    accountRoutes({
      "GET /api/v1/transactions": (req) => {
        queries.push(new URL(req.url).searchParams);
        return json(200, { items });
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
