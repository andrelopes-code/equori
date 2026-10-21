import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";

import { catalogEn } from "@/i18n/catalog.en";
import { fakeApi, json, problem } from "@/testing/fake-api";
import { renderApp } from "@/testing/render-app";
import {
  accounts,
  checkingID,
  foodID,
  payeeID,
  sharedRoutes,
  transactionFixture,
} from "@/testing/transaction-api";

const uncategorizedID = "99999999-9999-4999-8999-999999999999";
const secondID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const thirdID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

const allAccounts = [
  ...accounts,
  {
    id: uncategorizedID,
    name: "Uncategorized expense",
    class: "expense",
    currency: "BRL",
    system_role: "uncategorized_expense",
  },
];

const money = (amount: number) => ({ amount, currency: "BRL" });

function posting(id: string, account: string, amount: number) {
  return {
    id,
    account_id: account,
    amount: money(amount),
    weight: money(amount),
    status: "cleared",
  };
}

const groceries = transactionFixture();
const uncategorized = transactionFixture({
  id: secondID,
  description: "PIX RECEBIDO",
  payee_id: undefined,
  tags: [],
  postings: [
    posting("p3", checkingID, 50000),
    posting("p4", uncategorizedID, -50000),
  ],
});
const older = transactionFixture({
  id: thirdID,
  date: "2025-12-30",
  description: "Year end",
  payee_id: undefined,
  tags: [],
});

interface Seen {
  queries: URLSearchParams[];
}

function api(
  seen: Seen,
  answer: (query: URLSearchParams) => Response = (query) =>
    query.get("cursor") === "page-2"
      ? json(200, { items: [older] })
      : json(200, { items: [groceries, uncategorized], next_cursor: "page-2" }),
) {
  return fakeApi({
    ...sharedRoutes,
    "GET /api/v1/accounts": () => json(200, { items: allAccounts }),
    "GET /api/v1/payees": () =>
      json(200, { items: [{ id: payeeID, name: "Padaria" }] }),
    "GET /api/v1/tags": () => json(200, { items: ["food"] }),
    "GET /api/v1/transactions": (req) => {
      const query = new URL(req.url).searchParams;
      // The shell's badge asks for one page of 200 uncategorized transactions.
      if (query.get("limit") === "200") {
        return json(200, { items: [uncategorized] });
      }
      seen.queries.push(query);
      return answer(query);
    },
  });
}

function rowOf(text: string): HTMLElement {
  const row = screen.getByText(text).closest('[role="row"]');
  if (!(row instanceof HTMLElement)) throw new Error(`no row for ${text}`);
  return row;
}

beforeEach(() => {
  localStorage.clear();
});

describe("TransactionsPage", () => {
  it("lists every cursor page with payee, category, account and amount", async () => {
    const seen: Seen = { queries: [] };
    await renderApp("/transactions", { fetch: api(seen), today: "2026-10-17" });
    await screen.findByText("Year end");
    const first = rowOf("Padaria");
    expect(within(first).getByText("Weekly shop")).toBeInTheDocument();
    expect(within(first).getByText("Mercado")).toBeInTheDocument();
    expect(within(first).getByText("Itau")).toBeInTheDocument();
    expect(within(first).getByText("−R$120.00")).toBeInTheDocument();
    expect(within(first).getByText("Oct 10")).toBeInTheDocument();
    expect(
      within(first).getByRole("checkbox", { name: "Select Padaria" }),
    ).toBeInTheDocument();
    const second = rowOf("PIX RECEBIDO");
    expect(
      within(second).getByRole("button", {
        name: catalogEn["transactions.categorize"],
      }),
    ).toBeInTheDocument();
    expect(within(second).getByText("R$500.00")).toBeInTheDocument();
    // A date of another year carries its year.
    expect(within(rowOf("Year end")).queryByText("Dec 30")).toBeNull();
    expect(seen.queries.map((q) => q.get("cursor"))).toEqual([null, "page-2"]);
  });

  it("names the uncategorized tab with its count and opens the queue", async () => {
    const seen: Seen = { queries: [] };
    const { router } = await renderApp("/transactions", { fetch: api(seen) });
    const tab = await screen.findByRole("tab", { name: "Uncategorized (1)" });
    await userEvent.click(tab);
    await waitFor(() => {
      expect(router.state.location.search).toEqual({ uncategorized: true });
    });
    await waitFor(() => {
      expect(seen.queries.at(-1)?.get("uncategorized")).toBe("true");
    });
  });

  it("writes the search to the URL and the request", async () => {
    const seen: Seen = { queries: [] };
    const { router } = await renderApp("/transactions", { fetch: api(seen) });
    await screen.findByText("Weekly shop");
    await userEvent.type(
      screen.getByRole("searchbox", {
        name: catalogEn["transactions.search"],
      }),
      "pão",
    );
    await waitFor(() => {
      expect(router.state.location.search).toEqual({ q: "pão" });
    });
    await waitFor(() => {
      expect(seen.queries.at(-1)?.get("q")).toBe("pão");
    });
  });

  it("shows a category from the URL under the category field", async () => {
    const seen: Seen = { queries: [] };
    await renderApp(`/transactions?account_id=${foodID}`, {
      fetch: api(seen),
    });
    await screen.findByText("Weekly shop");
    expect(
      screen.getByRole("group", { name: /^Category: / }),
    ).toBeInTheDocument();
    expect(seen.queries[0]?.get("account_id")).toBe(foodID);
  });

  it("states an empty ledger, and a filtered empty list with a way back", async () => {
    const empty = () => json(200, { items: [] });
    await renderApp("/transactions", {
      fetch: api({ queries: [] }, empty),
    });
    expect(
      await screen.findByText(catalogEn["transactions.empty"]),
    ).toBeInTheDocument();

    const seen: Seen = { queries: [] };
    const { router } = await renderApp("/transactions?q=nada", {
      fetch: api(seen, empty),
    });
    await userEvent.click(
      await screen.findByRole("button", {
        name: catalogEn["transactions.clearFilters"],
      }),
    );
    await waitFor(() => {
      expect(router.state.location.search).toEqual({});
    });
  });

  it("reports a failed load with a way to try again", async () => {
    let fail = true;
    await renderApp("/transactions", {
      fetch: api({ queries: [] }, () => {
        if (fail) return problem(500, "internal_error");
        return json(200, { items: [groceries] });
      }),
    });
    await screen.findByText(catalogEn["transactions.loadFailed"]);
    fail = false;
    await userEvent.click(
      screen.getByRole("button", { name: catalogEn["transactions.tryAgain"] }),
    );
    expect(await screen.findByText("Weekly shop")).toBeInTheDocument();
  });
});

describe("TransactionsPage queue", () => {
  it("keeps the queue out of the filter bar's pills", async () => {
    await renderApp("/transactions?uncategorized=true", {
      fetch: api({ queries: [] }),
    });
    await screen.findByText("Weekly shop");
    expect(screen.queryByRole("group", { name: /uncategorized/i })).toBeNull();
    expect(
      screen.getByRole("tab", { name: "Uncategorized (1)", selected: true }),
    ).toBeInTheDocument();
  });
});
