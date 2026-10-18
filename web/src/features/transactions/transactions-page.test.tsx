import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { components } from "@/api/schema.gen";
import { catalogPtBR } from "@/i18n/catalog.pt-BR";
import { writeLocale } from "@/i18n/locale";
import { fakeApi, json, problem } from "@/testing/fake-api";
import { renderApp } from "@/testing/render-app";

type Account = components["schemas"]["Account"];
type Transaction = components["schemas"]["Transaction"];

const checkingID = "11111111-1111-4111-8111-111111111111";
const foodID = "22222222-2222-4222-8222-222222222222";
const travelID = "33333333-3333-4333-8333-333333333333";
const bakeryID = "44444444-4444-4444-8444-444444444444";
const marketID = "55555555-5555-4555-8555-555555555555";
const savingsID = "66666666-6666-4666-8666-666666666666";
const uncategorizedID = "77777777-7777-4777-8777-777777777777";
const walletID = "88888888-8888-4888-8888-888888888888";

const payees = [
  { id: bakeryID, name: "Padaria" },
  { id: marketID, name: "Mercado Central" },
];

const accounts: Account[] = [
  {
    id: checkingID,
    name: "Itaú",
    class: "asset",
    kind: "checking",
    currency: "BRL",
  },
  { id: foodID, name: "Mercado", class: "expense", currency: "BRL" },
  { id: travelID, name: "Viagens", class: "expense", currency: "BRL" },
  {
    id: savingsID,
    name: "Reserva",
    class: "asset",
    kind: "savings",
    currency: "BRL",
  },
  {
    id: walletID,
    name: "Wise",
    class: "asset",
    kind: "checking",
    currency: "USD",
  },
  {
    id: uncategorizedID,
    name: "Sem categoria",
    class: "expense",
    currency: "BRL",
    system_role: "uncategorized_expense",
  },
];

function transaction(
  n: number,
  date: string,
  extra: Partial<Transaction> = {},
): Transaction {
  return {
    id: `t-${String(n)}`,
    date,
    description: `Compra ${String(n)}`,
    balancing_currency: "BRL",
    origin: "manual",
    version: 1,
    tags: [],
    links: [],
    postings: [
      {
        id: `p-${String(n)}-a`,
        account_id: checkingID,
        amount: { amount: -1000 * n, currency: "BRL" },
      },
      {
        id: `p-${String(n)}-b`,
        account_id: foodID,
        amount: { amount: 1000 * n, currency: "BRL" },
      },
    ],
    ...extra,
  };
}

const firstPage = {
  items: [
    transaction(1, "2026-10-16", { tags: ["viagem"] }),
    transaction(2, "2026-10-16"),
    transaction(3, "2026-10-15"),
  ],
  next_cursor: "cursor-2",
};
const secondPage = { items: [transaction(4, "2026-10-14")] };

interface Options {
  respond?: (params: URLSearchParams) => Response | Promise<Response>;
}

function listApi(opts: Options = {}) {
  const requests: URLSearchParams[] = [];
  const fetch = fakeApi({
    "GET /api/v1/me": () => json(200, { id: 1, email: "a@b.c", role: "admin" }),
    "GET /api/v1/settings": () => json(200, { base_currency: "BRL" }),
    "GET /api/v1/instruments": () =>
      json(200, {
        items: [
          { code: "BRL", type: "currency", scale: 2, name: "Real" },
          { code: "USD", type: "currency", scale: 2, name: "Dollar" },
        ],
      }),
    "GET /api/v1/accounts": () => json(200, { items: accounts }),
    "GET /api/v1/payees": () => json(200, { items: payees }),
    "GET /api/v1/tags": () => json(200, { items: ["casa", "viagem"] }),
    "GET /api/v1/transactions": (req) => {
      const params = new URL(req.url).searchParams;
      // Ledger sheet L8: the shell counts uncategorized transactions on every route.
      const shellCount =
        params.get("uncategorized") === "true" && params.get("limit") === "200";
      if (!shellCount) requests.push(params);
      if (opts.respond !== undefined) return opts.respond(params);
      return json(
        200,
        params.get("cursor") === "cursor-2" ? secondPage : firstPage,
      );
    },
  });
  return { fetch, requests };
}

class StubObserver {
  static readonly all: StubObserver[] = [];
  target: Element | undefined;
  disconnected = false;
  readonly callback: IntersectionObserverCallback;

  constructor(callback: IntersectionObserverCallback) {
    this.callback = callback;
    StubObserver.all.push(this);
  }

  observe(target: Element): void {
    this.target = target;
  }

  unobserve(): void {
    this.disconnected = true;
  }

  disconnect(): void {
    this.disconnected = true;
  }

  takeRecords(): IntersectionObserverEntry[] {
    return [];
  }
}

// Scrolling the sentinel into view: every live observer reports an intersecting target.
async function scrollToSentinel() {
  await act(async () => {
    for (const observer of StubObserver.all) {
      if (observer.disconnected || observer.target === undefined) continue;
      const entry = {
        isIntersecting: true,
        target: observer.target,
      } as IntersectionObserverEntry;
      observer.callback([entry], observer as unknown as IntersectionObserver);
    }
    await Promise.resolve();
  });
}

beforeEach(() => {
  localStorage.clear();
  writeLocale("pt-BR");
  StubObserver.all.length = 0;
  vi.stubGlobal("IntersectionObserver", StubObserver);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

// Ledger sheet decisions L13 to L16.
describe("transactions list", () => {
  it("draws a table at 1280 px: date once per day, description, category, amount", async () => {
    const { fetch } = listApi();
    const { container } = await renderApp("/transactions", { fetch });
    await screen.findByText("Compra 1");
    const table = screen.getByRole("table", {
      name: catalogPtBR["transactions.list"],
    });
    expect(
      within(table)
        .getAllByRole("columnheader")
        .map((th) => th.textContent),
    ).toEqual([
      catalogPtBR["transactions.column.date"],
      catalogPtBR["transactions.column.description"],
      catalogPtBR["transactions.column.category"],
      catalogPtBR["transactions.column.amount"],
    ]);
    const rows = within(table)
      .getAllByRole("row")
      .slice(1)
      .map((row) =>
        within(row)
          .getAllByRole("cell")
          .map((cell) => cell.textContent.replace(/\u00a0/g, " ")),
      );
    expect(rows).toEqual([
      ["Ontem", "Compra 1 · Itaú · viagem", "Mercado", "−10,00"],
      ["", "Compra 2 · Itaú", "Mercado", "−20,00"],
      ["qui, 15 out", "Compra 3 · Itaú", "Mercado", "−30,00"],
    ]);
    expect(
      within(table).getByRole("link", { name: "Compra 1" }),
    ).toHaveAttribute("href", "/transactions/t-1");
    expect(table.querySelector("svg")).toBeNull();
    expect(container.querySelector('[data-ui="list"]')).toBeNull();
  });

  it("groups rows under day headers at 768 px, newest day first", async () => {
    const { fetch } = listApi();
    await renderApp("/transactions", { fetch, width: 768 });
    const days = await screen.findAllByRole("heading", { level: 2 });
    expect(days.map((d) => d.textContent)).toEqual([
      catalogPtBR["date.yesterday"],
      "qui, 15 out",
    ]);
    for (const day of days) {
      expect(day.closest("[data-sticky]")).not.toBeNull();
    }
    const firstDay = screen.getByRole("list", {
      name: catalogPtBR["date.yesterday"],
    });
    expect(within(firstDay).getAllByRole("listitem")).toHaveLength(2);
    expect(
      within(screen.getByRole("list", { name: "qui, 15 out" })).getAllByRole(
        "listitem",
      ),
    ).toHaveLength(1);
  });

  it("shows two lines per row on a phone: description and amount, then category and account", async () => {
    const { fetch } = listApi();
    await renderApp("/transactions", { fetch, width: 360 });
    const row = (await screen.findByText("Compra 1")).closest("li");
    if (row === null) throw new Error("row not found");
    const line = row.querySelector('[data-own="transaction-line"]');
    expect(line?.textContent.replace(/\u00a0/g, " ")).toBe("Compra 1−R$ 10,00");
    const description = row.querySelector('[data-part="description"]');
    expect(description?.textContent).toBe("Mercado · Itaú · viagem");
    expect(row.querySelector("a")).toHaveAttribute("href", "/transactions/t-1");
    expect(row.querySelector("svg")).toBeNull();
  });

  it("marks an uncategorized row for review, names a transfer and keeps a foreign symbol", async () => {
    const { fetch } = listApi({
      respond: () =>
        json(200, {
          items: [
            transaction(6, "2026-10-16", {
              postings: [
                {
                  id: "p-6-a",
                  account_id: checkingID,
                  amount: { amount: -1500, currency: "BRL" },
                },
                {
                  id: "p-6-b",
                  account_id: uncategorizedID,
                  amount: { amount: 1500, currency: "BRL" },
                },
              ],
            }),
            transaction(7, "2026-10-16", {
              postings: [
                {
                  id: "p-7-a",
                  account_id: checkingID,
                  amount: { amount: -5000, currency: "BRL" },
                },
                {
                  id: "p-7-b",
                  account_id: savingsID,
                  amount: { amount: 5000, currency: "BRL" },
                },
              ],
            }),
            transaction(8, "2026-10-16", {
              balancing_currency: "USD",
              postings: [
                {
                  id: "p-8-a",
                  account_id: walletID,
                  amount: { amount: -1250, currency: "USD" },
                },
                {
                  id: "p-8-b",
                  account_id: travelID,
                  amount: { amount: 1250, currency: "USD" },
                },
              ],
            }),
          ],
        }),
    });
    await renderApp("/transactions", { fetch });
    await screen.findByText("Compra 6");
    const table = screen.getByRole("table", {
      name: catalogPtBR["transactions.list"],
    });
    const cells = (name: RegExp) => {
      const row = within(table).getByText(name).closest("tr");
      if (row === null) throw new Error("row not found");
      return within(row)
        .getAllByRole("cell")
        .map((cell) => cell.textContent.replace(/\u00a0/g, " "));
    };
    expect(cells(/^Compra 6/)).toEqual([
      "Ontem",
      "Compra 6 · Itaú",
      catalogPtBR["transactions.review"],
      "−15,00",
    ]);
    expect(cells(/^Compra 7/)).toEqual([
      "",
      "Compra 7 · Itaú → Reserva",
      catalogPtBR["transactions.transfer"],
      "−50,00",
    ]);
    expect(cells(/^Compra 8/)).toEqual([
      "",
      "Compra 8 · Wise",
      "Viagens",
      "−US$ 12,50",
    ]);
  });

  it("writes the date of a day once even when the next page continues it", async () => {
    const { fetch } = listApi({
      respond: (params) =>
        json(
          200,
          params.get("cursor") === "cursor-2"
            ? { items: [transaction(9, "2026-10-15")] }
            : {
                items: [
                  transaction(1, "2026-10-16"),
                  transaction(3, "2026-10-15"),
                ],
                next_cursor: "cursor-2",
              },
        ),
    });
    await renderApp("/transactions", { fetch });
    await screen.findByText("Compra 3");
    await scrollToSentinel();
    const row = (await screen.findByText("Compra 9")).closest("tr");
    if (row === null) throw new Error("row not found");
    expect(within(row).getAllByRole("cell")[0]?.textContent).toBe("");
  });
});

describe("transactions rows and paging", () => {
  it("shows the payee name instead of the description, then the category", async () => {
    const { fetch } = listApi({
      respond: () =>
        json(200, {
          items: [transaction(5, "2026-10-16", { payee_id: bakeryID })],
        }),
    });
    await renderApp("/transactions", { fetch, width: 360 });
    const row = (await screen.findByText(/^Padaria/)).closest("li");
    if (row === null) throw new Error("row not found");
    expect(within(row).getByText(/^Padaria/).textContent).toBe("Padaria");
    expect(row.querySelector('[data-part="description"]')?.textContent).toBe(
      "Mercado · Itaú",
    );
    expect(screen.queryByText(/Compra 5/)).toBeNull();
  });

  it("keeps the loaded rows and offers a retry when the next page fails", async () => {
    const user = userEvent.setup();
    let fail = true;
    const { fetch, requests } = listApi({
      respond: (params) => {
        if (params.get("cursor") !== "cursor-2") return json(200, firstPage);
        return fail ? problem(500, "internal_error") : json(200, secondPage);
      },
    });
    await renderApp("/transactions", { fetch });
    await screen.findByText("Compra 3");
    await scrollToSentinel();
    const retry = await screen.findByRole("button", {
      name: catalogPtBR["common.retry"],
    });
    expect(screen.getByText("Compra 3")).toBeInTheDocument();
    fail = false;
    await user.click(retry);
    expect(await screen.findByText("Compra 4")).toBeInTheDocument();
    expect(requests.at(-1)?.get("cursor")).toBe("cursor-2");
    expect(screen.getByText("Compra 1")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: catalogPtBR["common.retry"] }),
    ).toBeNull();
  });
});

describe("transactions search", () => {
  it("navigates to ?q= and requests with q", async () => {
    const user = userEvent.setup();
    const { fetch, requests } = listApi();
    const { router } = await renderApp("/transactions", { fetch });
    await screen.findByText("Compra 1");
    await user.type(
      screen.getByRole("searchbox", {
        name: catalogPtBR["transactions.search"],
      }),
      "mercado{Enter}",
    );
    await waitFor(() => {
      expect(router.state.location.search).toEqual({ q: "mercado" });
    });
    expect(router.state.location.href).toBe("/transactions?q=mercado");
    await waitFor(() => {
      expect(requests.at(-1)?.get("q")).toBe("mercado");
    });
  });

  it("keeps focus in the search field after submitting", async () => {
    const user = userEvent.setup();
    const { fetch } = listApi();
    const { router } = await renderApp("/transactions", { fetch });
    await screen.findByText("Compra 1");
    const field = screen.getByRole("searchbox", {
      name: catalogPtBR["transactions.search"],
    });
    await user.type(field, "mercado{Enter}");
    await waitFor(() => {
      expect(router.state.location.search).toEqual({ q: "mercado" });
    });
    expect(
      screen.getByRole("searchbox", {
        name: catalogPtBR["transactions.search"],
      }),
    ).toBe(field);
    expect(field).toHaveFocus();
  });

  it("clears the search field and the URL query with the field's clear control", async () => {
    const user = userEvent.setup();
    const { fetch } = listApi();
    const { router } = await renderApp("/transactions?q=mercado", { fetch });
    const field = await screen.findByRole("searchbox", {
      name: catalogPtBR["transactions.search"],
    });
    expect(field).toHaveValue("mercado");
    const search = screen.getByRole("search");
    await user.click(within(search).getByRole("button", { name: "Limpar" }));
    await waitFor(() => {
      expect(router.state.location.href).toBe("/transactions");
    });
    expect(field).toHaveValue("");
  });

  it("empties the rows and shows skeleton rows while a changed filter loads", async () => {
    const user = userEvent.setup();
    let release: (response: Response) => void = () => undefined;
    const pending = new Promise<Response>((resolve) => {
      release = resolve;
    });
    const { fetch } = listApi({
      respond: (params) =>
        params.get("q") === "mercado" ? pending : json(200, firstPage),
    });
    const { container } = await renderApp("/transactions", { fetch });
    await screen.findByText("Compra 1");
    await user.type(
      screen.getByRole("searchbox", {
        name: catalogPtBR["transactions.search"],
      }),
      "mercado{Enter}",
    );
    await waitFor(() => {
      expect(screen.queryByText("Compra 1")).toBeNull();
    });
    expect(
      container.querySelectorAll('[data-ui="skeleton"]').length,
    ).toBeGreaterThan(0);
    release(json(200, { items: [transaction(9, "2026-10-10")] }));
    expect(await screen.findByText("Compra 9")).toBeInTheDocument();
  });
});

// The filter bar is the filter-bar family: a pinned pill per URL filter, a
// popover with the value picker, and a removable chip per active filter.
async function choose(
  user: ReturnType<typeof userEvent.setup>,
  pill: string,
  option: string,
) {
  await user.click(screen.getByRole("button", { name: pill }));
  const popover = await screen.findByRole("dialog");
  await user.click(within(popover).getByRole("combobox", { name: "Valor" }));
  await user.click(await screen.findByRole("option", { name: option }));
  await user.keyboard("{Escape}");
  await user.click(within(popover).getByRole("button", { name: "Concluído" }));
  await waitFor(() => {
    expect(screen.queryByRole("dialog")).toBeNull();
  });
}

describe("transactions filters", () => {
  it("chooses an account from the filter bar on a phone, shows a removable chip and clears it", async () => {
    const user = userEvent.setup();
    const { fetch, requests } = listApi();
    const { router } = await renderApp("/transactions", { fetch, width: 360 });
    await screen.findByText("Compra 1");
    await choose(user, catalogPtBR["transactions.filter.account"], "Itaú");
    await waitFor(() => {
      expect(router.state.location.search).toEqual({ account_id: checkingID });
    });
    await waitFor(() => {
      expect(requests.at(-1)?.get("account_id")).toBe(checkingID);
    });
    expect(
      screen.getByRole("group", { name: /^Conta: .*Itaú$/ }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Remover Conta" }));
    await waitFor(() => {
      expect(router.state.location.href).toBe("/transactions");
    });
    expect(screen.queryByRole("group", { name: /^Conta:/ })).toBeNull();
  });

  it("filters by payee and tag from the bar and names the payee in its chip", async () => {
    const user = userEvent.setup();
    const { fetch, requests } = listApi();
    const { router } = await renderApp("/transactions", { fetch });
    await screen.findByText("Compra 1");
    await choose(user, catalogPtBR["transactions.filter.payee"], "Padaria");
    await waitFor(() => {
      expect(router.state.location.search).toEqual({ payee_id: bakeryID });
    });
    await choose(user, catalogPtBR["transactions.filter.tag"], "casa");
    await waitFor(() => {
      expect(router.state.location.search).toEqual({
        payee_id: bakeryID,
        tag: "casa",
      });
    });
    await waitFor(() => {
      expect(requests.at(-1)?.get("payee_id")).toBe(bakeryID);
      expect(requests.at(-1)?.get("tag")).toBe("casa");
    });
    expect(
      screen.getByRole("group", { name: /^Beneficiário: .*Padaria$/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("group", { name: /^Tag: .*casa$/ }),
    ).toBeInTheDocument();
  });

  it("names the payee in the chip of a payee filter loaded from the URL", async () => {
    const { fetch } = listApi();
    await renderApp(`/transactions?payee_id=${marketID}`, { fetch });
    expect(
      await screen.findByRole("group", {
        name: /^Beneficiário: .*Mercado Central$/,
      }),
    ).toBeInTheDocument();
  });

  it("holds the search and the filters in one bar above the list, and leaves the header the title and New (LP-02)", async () => {
    const { fetch } = listApi();
    await renderApp("/transactions", { fetch, width: 1280 });
    await screen.findByText("Compra 1");
    const header = document.querySelector('[data-ui="page-header"]');
    if (!(header instanceof HTMLElement)) throw new Error("no page header");
    expect(within(header).queryByRole("searchbox")).toBeNull();
    // Ledger sheet L7: from 600 px New stands in the top bar.
    const topBar = document.querySelector('[data-ui="top-navigation"]');
    if (!(topBar instanceof HTMLElement)) throw new Error("no top bar");
    expect(
      within(topBar).getByRole("link", {
        name: new RegExp(`^${catalogPtBR["nav.entry"]}`),
      }),
    ).toHaveAttribute("href", "/transactions/new");
    const bar = screen.getByRole("search");
    expect(
      within(bar).getByRole("searchbox", {
        name: catalogPtBR["transactions.search"],
      }),
    ).toBeInTheDocument();
    for (const pill of [
      catalogPtBR["transactions.filter.account"],
      catalogPtBR["transactions.filter.period"],
      catalogPtBR["transactions.filter.payee"],
      catalogPtBR["transactions.filter.tag"],
      catalogPtBR["transactions.filter.uncategorized"],
    ]) {
      expect(
        within(bar).getByRole("button", { name: pill }),
      ).toBeInTheDocument();
    }
    const list = screen.getByRole("table", {
      name: catalogPtBR["transactions.list"],
    });
    expect(
      bar.compareDocumentPosition(list) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("shows a no-results state with a clear-filters action when filters match nothing", async () => {
    const user = userEvent.setup();
    const { fetch } = listApi({ respond: () => json(200, { items: [] }) });
    const { router } = await renderApp("/transactions?q=zzz", { fetch });
    const title = await screen.findByText(
      catalogPtBR["transactions.noresults"],
    );
    expect(title.closest("[data-status]")).toHaveAttribute(
      "data-status",
      "no-results",
    );
    await user.click(
      screen.getByRole("button", {
        name: catalogPtBR["transactions.filters.clear"],
      }),
    );
    await waitFor(() => {
      expect(router.state.location.href).toBe("/transactions");
    });
  });

  it("shows an empty state with the new-transaction action when nothing exists", async () => {
    const { fetch } = listApi({ respond: () => json(200, { items: [] }) });
    await renderApp("/transactions", { fetch });
    const title = await screen.findByText(catalogPtBR["transactions.empty"]);
    expect(title.closest("[data-status]")).toHaveAttribute(
      "data-status",
      "empty",
    );
    const region = title.closest("[data-status]");
    if (!(region instanceof HTMLElement)) throw new Error("no result state");
    expect(
      within(region).getByRole("link", { name: catalogPtBR["nav.new"] }),
    ).toHaveAttribute("href", "/transactions/new");
  });
});

describe("transactions filter bar on a phone", () => {
  it("counts the active filters and shows their chips before the empty pills", async () => {
    const { fetch } = listApi();
    await renderApp(`/transactions?uncategorized=true&payee_id=${bakeryID}`, {
      fetch,
      width: 360,
    });
    await screen.findByText("Compra 1");
    const bar = screen.getByRole("toolbar", { name: "Filtros" });
    expect(
      within(bar).getByRole("button", { name: "Filtros (2)" }),
    ).toBeInTheDocument();
    const items = [
      ...bar.querySelectorAll('[data-part="chip"], [data-part="pill"]'),
    ].map((el) => el.getAttribute("data-part"));
    expect(items).toEqual(["chip", "chip", "pill", "pill", "pill"]);
  });

  it("writes the uncategorized value as a word, not as true", async () => {
    const { fetch } = listApi();
    await renderApp("/transactions?uncategorized=true", { fetch });
    expect(
      await screen.findByRole("group", { name: /^Sem categoria: .*Sim$/ }),
    ).toBeInTheDocument();
  });

  it("offers the uncategorized value as words in its popover", async () => {
    const user = userEvent.setup();
    const { fetch } = listApi();
    await renderApp("/transactions?uncategorized=true", { fetch });
    await user.click(await screen.findByRole("button", { name: /^é Sim$/ }));
    const popover = await screen.findByRole("dialog");
    expect(
      within(popover).getByRole("combobox", { name: "Valor" }),
    ).toHaveTextContent("Sim");
  });

  it("writes the period in the app's date format", async () => {
    const { fetch } = listApi();
    await renderApp("/transactions?from=2026-09-01&to=2026-10-10", { fetch });
    expect(
      await screen.findByRole("group", {
        name: /^Período: .*01\/09\/2026 – 10\/10\/2026$/,
      }),
    ).toBeInTheDocument();
  });
});

// Complete frontend decisions T1 to T3.
describe("transaction pane", () => {
  function paneApi() {
    const categorized: unknown[] = [];
    const base = listApi();
    let version = 1;
    let category = foodID;
    const current = () =>
      transaction(1, "2026-10-16", {
        version,
        postings: [
          {
            id: "p-1-a",
            account_id: checkingID,
            amount: { amount: -1000, currency: "BRL" },
          },
          {
            id: "p-1-b",
            account_id: category,
            amount: { amount: 1000, currency: "BRL" },
          },
        ],
      });
    const fetch = fakeApi({
      ...Object.fromEntries(
        [
          "GET /api/v1/me",
          "GET /api/v1/settings",
          "GET /api/v1/instruments",
          "GET /api/v1/accounts",
          "GET /api/v1/payees",
          "GET /api/v1/tags",
        ].map((key) => [key, (req: Request) => base.fetch(req)]),
      ),
      "GET /api/v1/transactions": (req) => base.fetch(req),
      "GET /api/v1/transactions/t-1": () => json(200, current()),
      "POST /api/v1/transactions/t-1/categorize": async (req) => {
        const body = (await req.json()) as {
          parts: { account_id: string }[];
        };
        categorized.push(body);
        category = body.parts[0]?.account_id ?? category;
        version += 1;
        return json(200, current());
      },
    });
    return { fetch, categorized };
  }

  it("opens the selected row beside the table instead of leaving the list", async () => {
    const user = userEvent.setup();
    const { fetch } = paneApi();
    const { router } = await renderApp("/transactions", { fetch });
    await user.click(await screen.findByRole("link", { name: "Compra 1" }));
    expect(router.state.location.pathname).toBe("/transactions");
    expect(router.state.location.search).toEqual({ selected: "t-1" });
    const pane = await screen.findByRole("complementary", {
      name: catalogPtBR["transactions.pane"],
    });
    expect(
      await within(pane).findByRole("heading", { name: "Compra 1" }),
    ).toBeInTheDocument();
    expect(
      within(pane).getByRole("button", { name: "Mercado", pressed: true }),
    ).toBeInTheDocument();
    expect(
      within(pane).getByRole("link", {
        name: catalogPtBR["transactions.pane.open"],
      }),
    ).toHaveAttribute("href", "/transactions/t-1");
  });

  it("moves the transaction to another category and undoes it from the toast", async () => {
    const user = userEvent.setup();
    const { fetch, categorized } = paneApi();
    await renderApp("/transactions?selected=t-1", { fetch });
    const pane = await screen.findByRole("complementary", {
      name: catalogPtBR["transactions.pane"],
    });
    await user.click(
      await within(pane).findByRole("button", { name: "Viagens" }),
    );
    await waitFor(() => {
      expect(categorized).toHaveLength(1);
    });
    expect(categorized[0]).toEqual({
      expected_version: 1,
      parts: [
        { account_id: travelID, amount: { amount: 1000, currency: "BRL" } },
      ],
    });
    await user.click(
      await screen.findByRole("button", {
        name: catalogPtBR["transactions.pane.undo"],
      }),
    );
    await waitFor(() => {
      expect(categorized).toHaveLength(2);
    });
    expect(categorized[1]).toEqual({
      expected_version: 2,
      parts: [
        { account_id: foodID, amount: { amount: 1000, currency: "BRL" } },
      ],
    });
  });

  it("keeps the row a link to the transaction page on a phone", async () => {
    const user = userEvent.setup();
    const { fetch } = paneApi();
    const { router } = await renderApp("/transactions", { fetch, width: 360 });
    const row = (await screen.findByText("Compra 1")).closest("a");
    if (row === null) throw new Error("row link not found");
    await user.click(row);
    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/transactions/t-1");
    });
  });
});

// Complete frontend decision T4.
describe("upcoming occurrences", () => {
  function upcomingApi() {
    const base = listApi();
    const ranges: string[] = [];
    const fetch = fakeApi({
      ...Object.fromEntries(
        [
          "GET /api/v1/me",
          "GET /api/v1/settings",
          "GET /api/v1/instruments",
          "GET /api/v1/accounts",
          "GET /api/v1/payees",
          "GET /api/v1/tags",
          "GET /api/v1/transactions",
        ].map((key) => [key, (req: Request) => base.fetch(req)]),
      ),
      "GET /api/v1/occurrences": (req) => {
        const params = new URL(req.url).searchParams;
        ranges.push(`${params.get("from") ?? ""}..${params.get("to") ?? ""}`);
        return json(200, {
          items: [
            {
              id: "o-1",
              schedule_id: "s-1",
              sequence: 3,
              expected_on: "2026-10-20",
              expected_amount: { amount: 11990, currency: "BRL" },
              state: "expected",
            },
            {
              id: "o-2",
              schedule_id: "s-2",
              sequence: 1,
              expected_on: "2026-10-18",
              expected_amount: { amount: 840000, currency: "BRL" },
              state: "expected",
            },
            {
              id: "o-3",
              schedule_id: "s-1",
              sequence: 2,
              expected_on: "2026-10-10",
              expected_amount: { amount: 11990, currency: "BRL" },
              state: "realized",
            },
          ],
        });
      },
      "GET /api/v1/schedules": () =>
        json(200, {
          items: [
            {
              id: "s-1",
              kind: "subscription",
              account_id: checkingID,
              counterpart_id: foodID,
              description: "Internet fibra",
              match_tolerance_bp: 1000,
              grace_days: 3,
              terms: [],
              pauses: [],
            },
            {
              id: "s-2",
              kind: "income",
              account_id: checkingID,
              counterpart_id: foodID,
              description: "Salário",
              match_tolerance_bp: 1000,
              grace_days: 3,
              terms: [],
              pauses: [],
            },
          ],
        }),
    });
    return { fetch, ranges };
  }

  it("lists the expected occurrences of the next 31 days above Today", async () => {
    const { fetch, ranges } = upcomingApi();
    await renderApp("/transactions", { fetch });
    await screen.findByText(/^Internet fibra/);
    expect(ranges).toEqual(["2026-10-18..2026-11-17"]);
    const table = screen.getByRole("table", {
      name: catalogPtBR["transactions.list"],
    });
    const rows = within(table)
      .getAllByRole("row")
      .slice(1, 4)
      .map((row) =>
        within(row)
          .getAllByRole("cell")
          .map((cell) => cell.textContent.replace(/\u00a0/g, " ")),
      );
    expect(rows).toEqual([
      ["ter, 20 out", "Internet fibra · Itaú", "assinatura", "−119,90"],
      ["dom, 18 out", "Salário · Itaú", "receita", "+8.400,00"],
      [
        catalogPtBR["date.today"],
        catalogPtBR["transactions.upcoming.note"],
        "",
        "",
      ],
    ]);
  });

  it("shows no occurrence while a filter is set", async () => {
    const { fetch, ranges } = upcomingApi();
    await renderApp(`/transactions?account_id=${checkingID}`, { fetch });
    await screen.findByText("Compra 1");
    expect(ranges).toEqual([]);
    expect(screen.queryByText(/^Internet fibra/)).toBeNull();
  });
});
