import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";

import type { components } from "@/api/schema.gen";
import { catalogPtBR } from "@/i18n/catalog.pt-BR";
import { writeLocale } from "@/i18n/locale";
import { fakeApi, json, problem } from "@/testing/fake-api";
import { renderApp } from "@/testing/render-app";

type Account = components["schemas"]["Account"];
type Transaction = components["schemas"]["Transaction"];

beforeEach(() => {
  localStorage.clear();
  writeLocale("pt-BR");
});

const accounts: Account[] = [
  {
    id: "a-checking",
    name: "Itaú",
    class: "asset",
    kind: "checking",
    currency: "BRL",
  },
  {
    id: "a-savings",
    name: "Reserva",
    class: "asset",
    kind: "savings",
    currency: "BRL",
  },
  {
    id: "a-card",
    name: "Nubank",
    class: "liability",
    kind: "credit_card",
    currency: "BRL",
  },
  { id: "a-food", name: "Mercado", class: "expense", currency: "BRL" },
];

const balances = [
  ["a-checking", 123456],
  ["a-savings", 50000],
  ["a-card", -30000],
].map(([account_id, amount]) => ({
  account_id,
  date: "2026-10-17",
  basis: "booked",
  balance: { amount, currency: "BRL" },
}));

function transaction(n: number): Transaction {
  return {
    id: `t-${String(n)}`,
    date: "2026-10-16",
    description: `Compra ${String(n)}`,
    balancing_currency: "BRL",
    origin: "manual",
    version: 1,
    tags: [],
    links: [],
    postings: [
      {
        id: `p-${String(n)}-a`,
        account_id: "a-checking",
        amount: { amount: -1000 * n, currency: "BRL" },
      },
      {
        id: `p-${String(n)}-b`,
        account_id: "a-food",
        amount: { amount: 1000 * n, currency: "BRL" },
      },
    ],
  };
}

interface Options {
  instruments?: () => Promise<Response>;
  recent?: () => Promise<Response>;
  balances?: () => Response | Promise<Response>;
  uncategorizedNext?: string;
}

function homeApi(opts: Options = {}) {
  const calls = { balances: 0 };
  const fetch = fakeApi({
    "GET /api/v1/me": () => json(200, { id: 1, email: "a@b.c", role: "admin" }),
    "GET /api/v1/settings": () => json(200, { base_currency: "BRL" }),
    "GET /api/v1/instruments": () =>
      opts.instruments?.() ??
      json(200, {
        items: [
          { code: "BRL", type: "currency", scale: 2, name: "Real" },
          { code: "USD", type: "currency", scale: 2, name: "Dollar" },
        ],
      }),
    "GET /api/v1/accounts": () => json(200, { items: accounts }),
    "GET /api/v1/balances": () => {
      calls.balances += 1;
      return opts.balances?.() ?? json(200, { items: balances });
    },
    "GET /api/v1/transactions": (req) => {
      const params = new URL(req.url).searchParams;
      if (params.get("uncategorized") === "true") {
        return json(200, {
          items: [1, 2, 3].map(transaction),
          ...(opts.uncategorizedNext === undefined
            ? {}
            : { next_cursor: opts.uncategorizedNext }),
        });
      }
      return (
        opts.recent?.() ??
        json(200, { items: [1, 2, 3, 4, 5].map(transaction) })
      );
    },
  });
  return { fetch, calls };
}

describe("home balances", () => {
  it("renders the group headings and base-currency totals in pt-BR", async () => {
    const { fetch } = homeApi();
    await renderApp("/", { fetch });
    const region = await screen.findByRole("region", {
      name: catalogPtBR["home.balances"],
    });
    expect(
      await within(region).findByText(catalogPtBR["home.group.available"]),
    ).toBeInTheDocument();
    expect(within(region).getByText("R$ 1.734,56")).toBeInTheDocument();
    expect(
      within(region).getByText(catalogPtBR["home.group.cards"]),
    ).toBeInTheDocument();
    expect(within(region).getByText("-R$ 300,00")).toBeInTheDocument();
    expect(
      within(region).queryByText(catalogPtBR["home.group.loans"]),
    ).toBeNull();
  });

  it("lists each account under its group heading with a link to the account", async () => {
    const { fetch } = homeApi();
    await renderApp("/", { fetch });
    const region = await screen.findByRole("region", {
      name: catalogPtBR["home.accounts"],
    });
    const cards = await within(region).findByRole("heading", {
      name: catalogPtBR["home.group.cards"],
    });
    expect(cards).toBeInTheDocument();
    expect(within(region).getByText("-R$ 300,00")).toBeInTheDocument();
    expect(within(region).getByRole("link", { name: /Itaú/ })).toHaveAttribute(
      "href",
      "/accounts/a-checking",
    );
  });

  it("renders the five recent transactions", async () => {
    const { fetch } = homeApi();
    await renderApp("/", { fetch });
    const region = await screen.findByRole("region", {
      name: catalogPtBR["home.recent"],
    });
    const rows = await within(region).findAllByRole("listitem");
    expect(rows).toHaveLength(5);
    const [firstRow] = rows;
    if (firstRow === undefined) throw new Error("no recent row");
    const first = within(firstRow);
    expect(first.getByText("Compra 1")).toBeInTheDocument();
    expect(first.getByText("-R$ 10,00")).toBeInTheDocument();
  });

  it("shows the uncategorized count with a link to the filtered list", async () => {
    const { fetch } = homeApi();
    await renderApp("/", { fetch });
    const title = await screen.findByText(
      catalogPtBR["home.uncategorized"].replace("{count}", "3"),
    );
    const notice = title.closest('[data-ui="alert"]');
    expect(notice).not.toBeNull();
    const link = within(notice as HTMLElement).getByRole("link", {
      name: catalogPtBR["home.uncategorized.action"],
    });
    expect(link).toHaveAttribute("href", "/transactions?uncategorized=true");
  });

  it("shows 200+ when another page of uncategorized exists", async () => {
    const { fetch } = homeApi({ uncategorizedNext: "cursor" });
    await renderApp("/", { fetch });
    expect(
      await screen.findByText(
        catalogPtBR["home.uncategorized"].replace("{count}", "200+"),
      ),
    ).toBeInTheDocument();
  });
});

describe("home money rows", () => {
  it("says in words which accounts a total excludes", async () => {
    const usd: Account = {
      id: "a-usd",
      name: "Wise",
      class: "asset",
      kind: "checking",
      currency: "USD",
    };
    const fetch = fakeApi({
      "GET /api/v1/me": () =>
        json(200, { id: 1, email: "a@b.c", role: "admin" }),
      "GET /api/v1/settings": () => json(200, { base_currency: "BRL" }),
      "GET /api/v1/instruments": () =>
        json(200, {
          items: [
            { code: "BRL", type: "currency", scale: 2, name: "Real" },
            { code: "USD", type: "currency", scale: 2, name: "Dollar" },
          ],
        }),
      "GET /api/v1/accounts": () => json(200, { items: [...accounts, usd] }),
      "GET /api/v1/balances": () => json(200, { items: balances }),
      "GET /api/v1/transactions": () => json(200, { items: [] }),
    });
    await renderApp("/", { fetch, width: 360 });
    const region = await screen.findByRole("region", {
      name: catalogPtBR["home.balances"],
    });
    expect(
      await within(region).findByText(catalogPtBR["home.excluded.one"]),
    ).toBeInTheDocument();
  });

  it("puts each account balance on the name's line at 360 px", async () => {
    const { fetch } = homeApi();
    await renderApp("/", { fetch, width: 360 });
    const region = await screen.findByRole("region", {
      name: catalogPtBR["home.accounts"],
    });
    const row = (await within(region).findByText("Itaú")).closest("li");
    const line = row?.querySelector('[data-own="balance-line"]');
    expect(line?.textContent.replace(/\u00a0/g, " ")).toBe("ItaúR$ 1.234,56");
    expect(row?.querySelector('[data-part="end"]')).toBeNull();
  });
});

describe("home without accounts", () => {
  it("states the empty ledger once and leads to the accounts page", async () => {
    const fetch = fakeApi({
      "GET /api/v1/me": () =>
        json(200, { id: 1, email: "a@b.c", role: "admin" }),
      "GET /api/v1/settings": () => json(200, { base_currency: "BRL" }),
      "GET /api/v1/instruments": () =>
        json(200, {
          items: [{ code: "BRL", type: "currency", scale: 2, name: "Real" }],
        }),
      "GET /api/v1/accounts": () => json(200, { items: [] }),
      "GET /api/v1/balances": () => json(200, { items: [] }),
      "GET /api/v1/transactions": () => json(200, { items: [] }),
    });
    await renderApp("/", { fetch });
    const region = await screen.findByRole("region", {
      name: catalogPtBR["home.balances"],
    });
    expect(
      await within(region).findByText(catalogPtBR["home.empty"]),
    ).toBeInTheDocument();
    expect(
      within(region).getByRole("link", {
        name: catalogPtBR["home.empty.action"],
      }),
    ).toHaveAttribute("href", "/accounts");
    expect(
      screen.queryByRole("region", { name: catalogPtBR["home.accounts"] }),
    ).toBeNull();
  });
});

describe("home waiting states", () => {
  it("marks the balance region busy with skeletons while it loads", async () => {
    let release: (response: Response) => void = () => undefined;
    const pending = new Promise<Response>((resolve) => {
      release = resolve;
    });
    const { fetch } = homeApi({ balances: () => pending });
    const { container } = await renderApp("/", { fetch });
    const region = screen.getByRole("region", {
      name: catalogPtBR["home.balances"],
    });
    expect(region).toHaveAttribute("aria-busy", "true");
    expect(
      container.querySelectorAll('[data-ui="skeleton"]').length,
    ).toBeGreaterThan(0);
    expect(
      screen.getByRole("heading", { level: 1, name: catalogPtBR["nav.home"] }),
    ).toBeInTheDocument();
    release(json(200, { items: balances }));
    await waitFor(() => {
      expect(region).not.toHaveAttribute("aria-busy", "true");
    });
  });

  it("keeps placeholders and formats no amount until the instrument scales load", async () => {
    let release: (response: Response) => void = () => undefined;
    const pending = new Promise<Response>((resolve) => {
      release = resolve;
    });
    const { fetch, calls } = homeApi({ instruments: () => pending });
    const { container } = await renderApp("/", { fetch });
    const region = screen.getByRole("region", {
      name: catalogPtBR["home.balances"],
    });
    await waitFor(() => {
      expect(calls.balances).toBe(1);
    });
    await screen.findByText(
      catalogPtBR["home.uncategorized"].replace("{count}", "3"),
    );
    await act(async () => {
      await Promise.resolve();
    });
    expect(region).toHaveAttribute("aria-busy", "true");
    expect(
      container.querySelectorAll('[data-ui="skeleton"]').length,
    ).toBeGreaterThan(0);
    expect(container.textContent).not.toContain("R$");
    release(
      json(200, {
        items: [{ code: "BRL", type: "currency", scale: 2, name: "Real" }],
      }),
    );
    expect(await within(region).findByText("R$ 1.734,56")).toBeInTheDocument();
  });

  it("marks the recent list busy while its transactions load", async () => {
    let release: (response: Response) => void = () => undefined;
    const pending = new Promise<Response>((resolve) => {
      release = resolve;
    });
    const { fetch } = homeApi({ recent: () => pending });
    await renderApp("/", { fetch });
    const recent = screen.getByRole("region", {
      name: catalogPtBR["home.recent"],
    });
    expect(recent.querySelector('[data-part="region"]')).toHaveAttribute(
      "aria-busy",
      "true",
    );
    release(json(200, { items: [1, 2, 3, 4, 5].map(transaction) }));
    expect(await within(recent).findAllByRole("listitem")).toHaveLength(5);
    expect(recent.querySelector('[aria-busy="true"]')).toBeNull();
  });

  it("shows a result-state with a retry that requests the balances again", async () => {
    const { fetch, calls } = homeApi({
      balances: () => problem(500, "internal_error"),
    });
    const { container } = await renderApp("/", { fetch });
    const retry = await screen.findByRole(
      "button",
      { name: catalogPtBR["common.retry"] },
      { timeout: 3000 },
    );
    expect(container.querySelector('[data-ui="result-state"]')).not.toBeNull();
    const before = calls.balances;
    await userEvent.setup().click(retry);
    await waitFor(
      () => {
        expect(calls.balances).toBeGreaterThan(before);
      },
      { timeout: 3000 },
    );
  }, 20000);
});

describe("home new transaction action", () => {
  it("is the bottom-bar centre item on a phone and not in the header", async () => {
    const { fetch } = homeApi();
    const { container } = await renderApp("/", { fetch, width: 360 });
    const links = await screen.findAllByRole("link", {
      name: catalogPtBR["nav.new"],
    });
    expect(links).toHaveLength(1);
    expect(links[0]?.closest('[data-own="bottom-bar"]')).not.toBeNull();
    const header = container.querySelector('[data-ui="page-header"]');
    expect(header).not.toBeNull();
    expect(
      within(header as HTMLElement).queryByRole("link", {
        name: catalogPtBR["nav.new"],
      }),
    ).toBeNull();
  });

  it.each([768, 1280])("is the page header action at %i px", async (width) => {
    const { fetch } = homeApi();
    const { container } = await renderApp("/", { fetch, width });
    const header = container.querySelector('[data-ui="page-header"]');
    expect(header).not.toBeNull();
    const link = within(header as HTMLElement).getByRole("link", {
      name: catalogPtBR["nav.new"],
    });
    expect(link).toHaveAttribute("href", "/transactions/new");
    expect(
      screen.getAllByRole("link", { name: catalogPtBR["nav.new"] }),
    ).toHaveLength(1);
  });
});
