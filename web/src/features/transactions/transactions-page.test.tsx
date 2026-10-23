import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

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

// Records the rows whose title cell renders, so a test can tell one row's render from all.
const titles = vi.hoisted(() => ({ rendered: new Set<string>() }));
vi.mock("@/features/transactions/title-cell", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/features/transactions/title-cell")>();
  return {
    TitleCell: (props: Parameters<typeof actual.TitleCell>[0]) => {
      titles.rendered.add(props.row.title);
      return actual.TitleCell(props);
    },
  };
});

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
  answer: (query: URLSearchParams) => Response | Promise<Response> = (query) =>
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
  // Owner review 2026-10-21, item 8: rows are grouped by day; the description and the
  // accounts share the line under the payee.
  it("lists every cursor page with payee, category, account and amount", async () => {
    const seen: Seen = { queries: [] };
    await renderApp("/transactions", { fetch: api(seen), today: "2026-10-17" });
    await screen.findByText("Year end");
    const first = rowOf("Padaria");
    expect(within(first).getByText("Weekly shop · Itau")).toBeInTheDocument();
    expect(within(first).getByText("Mercado")).toBeInTheDocument();
    expect(within(first).getByText("−R$120.00")).toBeInTheDocument();
    expect(screen.getByText("Sat, Oct 10")).toBeInTheDocument();
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
    // A day of another year carries its year.
    expect(screen.queryByText(/Dec 30/)).toBeNull();
    expect(seen.queries.map((q) => q.get("cursor"))).toEqual([null, "page-2"]);
  });

  // Owner review 2026-10-22: selecting a row rendered every row again, which took seconds on a
  // phone holding a few hundred. A selection renders the row it changed and no other.
  it("renders only the selected row when the selection changes", async () => {
    await renderApp("/transactions", {
      fetch: api({ queries: [] }),
      today: "2026-10-17",
    });
    await screen.findByText("Year end");
    titles.rendered.clear();
    await userEvent.click(
      within(rowOf("Padaria")).getByRole("checkbox", {
        name: "Select Padaria",
      }),
    );
    expect([...titles.rendered]).toEqual(["Padaria"]);
  });

  // Owner request 2026-10-22: a splitter between the list and the pane sets how wide each is.
  it("resizes the list and the pane with the splitter beside them", async () => {
    await renderApp(`/transactions?selected=${String(groceries.id)}`, {
      width: 1280,
      fetch: api({ queries: [] }),
      today: "2026-10-17",
    });
    const bar = await screen.findByRole("separator", {
      name: catalogEn["transactions.paneResize"],
    });
    expect(bar).toHaveAttribute("aria-valuenow", "66");
    bar.focus();
    // jsdom lays nothing out; the bar measures its container, so the container is 1000 px wide.
    const measure = vi
      .spyOn(HTMLElement.prototype, "getBoundingClientRect")
      .mockReturnValue(new DOMRect(0, 0, 1000, 600));
    try {
      await userEvent.keyboard("{ArrowLeft}");
    } finally {
      measure.mockRestore();
    }
    expect(bar).toHaveAttribute("aria-valuenow", "64");
  });

  it("shows no splitter while no row is open", async () => {
    await renderApp("/transactions", {
      width: 1280,
      fetch: api({ queries: [] }),
      today: "2026-10-17",
    });
    await screen.findByText("Year end");
    expect(
      screen.queryByRole("separator", {
        name: catalogEn["transactions.paneResize"],
      }),
    ).toBeNull();
  });

  // A refresh reads the whole page again, so the header's bar waits on it, not the button.
  it("shows a refresh on its button and the page header's bar and keeps the rows", async () => {
    const seen: Seen = { queries: [] };
    let release: () => void = () => undefined;
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    await renderApp("/transactions", {
      fetch: api(seen, (query) => {
        const page =
          query.get("cursor") === "page-2"
            ? json(200, { items: [older] })
            : json(200, {
                items: [groceries, uncategorized],
                next_cursor: "page-2",
              });
        return seen.queries.length > 2 ? held.then(() => page) : page;
      }),
      today: "2026-10-17",
    });
    await screen.findByText("Year end");
    const refresh = screen.getByRole("button", {
      name: catalogEn["transactions.refresh"],
    });
    await userEvent.click(refresh);
    const header = document.querySelector('[data-ui="page-header"]');
    if (!(header instanceof HTMLElement)) throw new Error("no page header");
    // The button waits on the refresh (AF-03) and the header's bar shows it at once.
    expect(within(refresh).getByRole("progressbar")).toBeInTheDocument();
    expect(await within(header).findAllByRole("progressbar")).toHaveLength(2);
    expect(screen.getByText("Padaria")).toBeInTheDocument();
    release();
    await waitFor(
      () => {
        expect(within(header).queryByRole("progressbar")).toBeNull();
      },
      { timeout: 2000 },
    );
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
    await screen.findByText("Weekly shop · Itau");
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
    await screen.findByText("Weekly shop · Itau");
    expect(
      screen.getByRole("group", { name: /^Category: / }),
    ).toBeInTheDocument();
    expect(seen.queries[0]?.get("account_id")).toBe(foodID);
  });

  // AF-02: a list that answered with zero rows keeps its empty state while a refresh runs.
  it("keeps the empty state on screen during a refresh", async () => {
    const seen: Seen = { queries: [] };
    let release: () => void = () => undefined;
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    await renderApp("/transactions", {
      fetch: api(seen, () => {
        const page = json(200, { items: [] });
        return seen.queries.length > 1 ? held.then(() => page) : page;
      }),
    });
    await screen.findByText(catalogEn["transactions.empty"]);
    await userEvent.click(
      screen.getByRole("button", { name: catalogEn["transactions.refresh"] }),
    );
    const header = document.querySelector('[data-ui="page-header"]');
    if (!(header instanceof HTMLElement)) throw new Error("no page header");
    expect(await within(header).findAllByRole("progressbar")).toHaveLength(2);
    expect(
      screen.getByText(catalogEn["transactions.empty"]),
    ).toBeInTheDocument();
    release();
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
    expect(await screen.findByText("Weekly shop · Itau")).toBeInTheDocument();
  });
});

describe("TransactionsPage queue", () => {
  it("keeps the queue out of the filter bar's pills", async () => {
    await renderApp("/transactions?uncategorized=true", {
      fetch: api({ queries: [] }),
    });
    await screen.findByText("Weekly shop · Itau");
    expect(screen.queryByRole("group", { name: /uncategorized/i })).toBeNull();
    expect(
      screen.getByRole("tab", { name: "Uncategorized (1)", selected: true }),
    ).toBeInTheDocument();
  });
});

describe("TransactionsPage on a phone", () => {
  // jsdom lays nothing out; the grid's bottom edge is where the test says it is.
  let gridBottom = 0;

  beforeEach(() => {
    // jsdom measures every other element as an empty box at the origin, as here.
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(
      function (this: HTMLElement) {
        return this.dataset.ui === "data-grid"
          ? DOMRect.fromRect({ y: gridBottom - 1000, height: 1000 })
          : new DOMRect();
      },
    );
    return () => {
      vi.restoreAllMocks();
    };
  });

  // The phone's list grows with the page's scroll, not with the grid's: the grid there is as
  // tall as its rows, so it holds the next page until its end comes within a screen of the view.
  it("asks for the next page only when the end of the rows comes near", async () => {
    gridBottom = 5000;
    const seen: Seen = { queries: [] };
    await renderApp("/transactions", {
      fetch: api(seen),
      today: "2026-10-17",
      width: 390,
    });
    await screen.findByText("Padaria");
    await new Promise((resolve) => setTimeout(resolve, 200));
    expect(seen.queries.map((q) => q.get("cursor"))).toEqual([null]);
    expect(screen.queryByText("Year end")).toBeNull();

    gridBottom = innerHeight + 100;
    window.dispatchEvent(new Event("scroll"));
    expect(await screen.findByText("Year end")).toBeInTheDocument();
    expect(seen.queries.map((q) => q.get("cursor"))).toEqual([null, "page-2"]);
  });
});
