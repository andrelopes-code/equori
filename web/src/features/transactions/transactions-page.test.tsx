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
        items: [{ code: "BRL", type: "currency", scale: 2, name: "Real" }],
      }),
    "GET /api/v1/accounts": () => json(200, { items: accounts }),
    "GET /api/v1/payees": () => json(200, { items: payees }),
    "GET /api/v1/tags": () => json(200, { items: ["casa", "viagem"] }),
    "GET /api/v1/transactions": (req) => {
      const params = new URL(req.url).searchParams;
      requests.push(params);
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

describe("transactions list", () => {
  it("groups rows under day headers, newest day first", async () => {
    const { fetch } = listApi();
    await renderApp("/transactions", { fetch });
    const days = await screen.findAllByRole("heading", { level: 2 });
    expect(days.map((d) => d.textContent)).toEqual([
      "16/10/2026",
      "15/10/2026",
    ]);
    for (const day of days) {
      expect(day.closest("[data-sticky]")).not.toBeNull();
    }
    const firstDay = screen.getByRole("list", { name: "16/10/2026" });
    expect(
      within(firstDay)
        .getAllByRole("listitem")
        .map((row) => within(row).getByText(/^Compra/).textContent),
    ).toEqual(["Compra 1 · Mercado", "Compra 2 · Mercado"]);
    const secondDay = screen.getByRole("list", { name: "15/10/2026" });
    expect(within(secondDay).getAllByRole("listitem")).toHaveLength(1);
  });

  it("puts the title, category and amount on the first line and the account and tags on the second", async () => {
    const { fetch } = listApi();
    await renderApp("/transactions", { fetch, width: 360 });
    const row = (await screen.findByText("Compra 1")).closest("li");
    expect(row).not.toBeNull();
    const line = row?.querySelector('[data-own="transaction-line"]');
    expect(line).not.toBeNull();
    expect(line?.textContent.replace(/\u00a0/g, " ")).toBe(
      "Compra 1 · Mercado\u2212R$ 10,00",
    );
    const description = row?.querySelector('[data-part="description"]');
    expect(description?.textContent).toBe("Itaú · viagem");
    expect(line?.contains(description ?? null)).toBe(false);
    expect(row?.querySelector('[data-part="end"]')).toBeNull();
  });

  it("requests the next page with the cursor when the sentinel is reached", async () => {
    const { fetch, requests } = listApi();
    await renderApp("/transactions", { fetch });
    await screen.findByText("Compra 3");
    expect(requests).toHaveLength(1);
    await scrollToSentinel();
    expect(await screen.findByText("Compra 4")).toBeInTheDocument();
    expect(requests).toHaveLength(2);
    expect(requests[1]?.get("cursor")).toBe("cursor-2");
    expect(
      screen.getAllByRole("heading", { level: 2 }).map((d) => d.textContent),
    ).toEqual(["16/10/2026", "15/10/2026", "14/10/2026"]);
  });

  it("stops observing when no next page exists", async () => {
    const { fetch } = listApi({ respond: () => json(200, secondPage) });
    await renderApp("/transactions", { fetch });
    await screen.findByText("Compra 4");
    expect(
      StubObserver.all.every((o) => o.disconnected || o.target === undefined),
    ).toBe(true);
  });

  it("sends the URL filters exactly", async () => {
    const { fetch, requests } = listApi();
    await renderApp("/transactions?tag=viagem&from=2026-10-01", { fetch });
    await screen.findByText("Compra 1");
    expect(Object.fromEntries(requests[0] ?? [])).toEqual({
      tag: "viagem",
      from: "2026-10-01",
      limit: "50",
    });
  });

  it("shows two lines per row on a phone: description and amount, then account and tags", async () => {
    const { fetch } = listApi();
    await renderApp("/transactions", { fetch, width: 360 });
    const row = (await screen.findByText("Compra 1")).closest("li");
    if (row === null) throw new Error("row not found");
    expect(within(row).getByText("\u2212R$ 10,00")).toBeInTheDocument();
    expect(within(row).getByText("Itaú · viagem")).toBeInTheDocument();
    expect(row.querySelector("a")).toHaveAttribute("href", "/transactions/t-1");
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
    expect(within(row).getByText(/^Padaria/).textContent).toBe(
      "Padaria · Mercado",
    );
    expect(within(row).getByText("Itaú")).toBeInTheDocument();
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
    const header = document.querySelector("header");
    if (header === null) throw new Error("no page header");
    expect(within(header).queryByRole("searchbox")).toBeNull();
    expect(
      within(header).getByRole("link", { name: catalogPtBR["nav.new"] }),
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
    const list = screen.getByRole("list", { name: "16/10/2026" });
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
