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

const series: Record<string, [string, number][]> = {
  "a-checking": [
    ["2026-10-01", 100000],
    ["2026-10-17", 123456],
  ],
  "a-savings": [["2026-10-01", 50000]],
};

const projections: Record<string, unknown> = {
  "a-checking": {
    account_id: "a-checking",
    from: "2026-10-17",
    to: "2026-10-31",
    opening: { amount: 123456, currency: "BRL" },
    closing: { amount: 61466, currency: "BRL" },
    points: [
      {
        date: "2026-10-20",
        occurrence_id: "o-net",
        schedule_id: "s-net",
        amount: { amount: -11990, currency: "BRL" },
        balance: { amount: 111466, currency: "BRL" },
      },
      {
        date: "2026-10-25",
        occurrence_id: "o-card",
        schedule_id: "s-card",
        amount: { amount: -50000, currency: "BRL" },
        balance: { amount: 61466, currency: "BRL" },
      },
    ],
  },
  "a-savings": {
    account_id: "a-savings",
    from: "2026-10-17",
    to: "2026-10-31",
    opening: { amount: 50000, currency: "BRL" },
    closing: { amount: 50000, currency: "BRL" },
    points: [],
  },
};

function schedule(id: string, kind: string, description: string) {
  return {
    id,
    kind,
    account_id: "a-checking",
    counterpart_id: "a-food",
    description,
    match_tolerance_bp: 1000,
    grace_days: 3,
    terms: [],
    pauses: [],
  };
}

function homeApi(opts: Options = {}) {
  const calls = { balances: 0, seriesFrom: [] as string[] };
  const routes: Record<string, (req: Request) => Response | Promise<Response>> =
    {
      "GET /api/v1/me": () =>
        json(200, { id: 1, email: "a@b.c", role: "admin" }),
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
      "GET /api/v1/reports/balances": (req) => {
        const params = new URL(req.url).searchParams;
        const id = params.get("account_id") ?? "";
        calls.seriesFrom.push(params.get("from") ?? "");
        return json(200, {
          account_id: id,
          basis: "booked",
          items: (series[id] ?? []).map(([date, amount]) => ({
            date,
            balance: { amount, currency: "BRL" },
          })),
        });
      },
      "GET /api/v1/schedules": () =>
        json(200, {
          items: [
            schedule("s-net", "subscription", "Internet fibra"),
            schedule("s-card", "transfer", "Fatura do cartão"),
          ],
        }),
      "GET /api/v1/budgets": () =>
        json(200, {
          items: [
            {
              id: "b-food",
              category_id: "a-food",
              rollover: false,
              amounts: [
                {
                  effective_from: "2026-08",
                  amount: { amount: 60000, currency: "BRL" },
                },
              ],
            },
          ],
        }),
      "GET /api/v1/budgets/b-food/progress": (req) =>
        json(200, {
          month: new URL(req.url).searchParams.get("month"),
          planned: { amount: 60000, currency: "BRL" },
          carried: { amount: 0, currency: "BRL" },
          spent: { amount: 45000, currency: "BRL" },
          available: { amount: 15000, currency: "BRL" },
        }),
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
        if (params.get("from") !== null) {
          return json(200, { items: [1, 2, 3, 4, 5].map(transaction) });
        }
        return (
          opts.recent?.() ??
          json(200, { items: [1, 2, 3, 4, 5].map(transaction) })
        );
      },
    };
  for (const [id, body] of Object.entries(projections)) {
    routes[`GET /api/v1/accounts/${id}/projection`] = () => json(200, body);
  }
  const fetch = fakeApi(routes);
  return { fetch, calls };
}

const text = (node: Element | null | undefined) =>
  node?.textContent.replace(/\u00a0/g, " ");

// Complete frontend decisions O1 to O7.
describe("overview forecast", () => {
  it("heads the month with today, the forecast, the lowest point and the month's flows", async () => {
    const { fetch } = homeApi();
    await renderApp("/", { fetch });
    expect(
      await screen.findByRole("heading", { level: 1, name: "Outubro de 2026" }),
    ).toBeInTheDocument();
    const region = screen.getByRole("region", {
      name: catalogPtBR["home.balances"],
    });
    await within(region).findByText(catalogPtBR["overview.today"]);
    const items = [
      ...region.querySelectorAll('[data-own="figure-strip"] dl > div'),
    ];
    expect(items.map((item) => text(item.querySelector("dt")))).toEqual([
      catalogPtBR["overview.today"],
      "Previsto para 31 out",
      catalogPtBR["overview.lowest"],
      "Outubro até agora",
    ]);
    expect(text(items[0]?.querySelector('[data-ui="visually-hidden"]'))).toBe(
      "R$ 1.734,56",
    );
    const forecast = items[1];
    expect(
      forecast?.querySelector('[data-own="money-figure"]'),
    ).toHaveAttribute("data-tone", "accent");
    expect(text(forecast?.querySelector('[data-ui="visually-hidden"]'))).toBe(
      "R$ 1.114,66",
    );
    expect(text(forecast)).toContain("\u2212R$ 619,90 em relação a hoje");
    expect(text(items[2])).toContain("em 25 out, depois de Fatura do cartão");
    expect(text(items[3])).toContain("SaiuR$ 150,00");
    expect(screen.getByText("Previsão de Itaú, Reserva")).toBeInTheDocument();
  });

  it("lists the remaining occurrences and closes them with the forecast balance", async () => {
    const { fetch } = homeApi();
    await renderApp("/", { fetch });
    const table = await screen.findByRole("table", {
      name: catalogPtBR["overview.ahead"],
    });
    const rows = within(table)
      .getAllByRole("row")
      .map((row) => text(row));
    expect(rows).toEqual([
      "20 outInternet fibra · assinatura\u2212119,90",
      "25 outFatura do cartão · transferência\u2212500,00",
      "31 outSaldo previstoR$ 1.114,66R$1.114,66",
    ]);
  });

  it("reads each budget against the month's pace", async () => {
    const { fetch } = homeApi();
    await renderApp("/", { fetch });
    const table = await screen.findByRole("table", {
      name: catalogPtBR["overview.budget"],
    });
    const row = within(table).getByText("Mercado").closest("tr");
    expect(text(row)).toBe("Mercado450,00600,00150,00");
    expect(row?.querySelector("[data-pace]")).toHaveAttribute(
      "data-pace",
      "ahead",
    );
    const bar = row?.querySelector('[data-own="budget-bar"]');
    expect(bar?.querySelector('[data-part-own="pace"]')).not.toBeNull();
  });

  it("moves to the previous month and keeps the next month closed on the current one", async () => {
    const user = userEvent.setup();
    const { fetch, calls } = homeApi();
    const { router } = await renderApp("/", { fetch });
    const next = await screen.findByRole("button", {
      name: catalogPtBR["overview.month.next"],
    });
    expect(next).toBeDisabled();
    await user.click(
      screen.getByRole("button", {
        name: catalogPtBR["overview.month.previous"],
      }),
    );
    expect(router.state.location.search).toEqual({ month: "2026-09" });
    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: "Setembro de 2026",
      }),
    ).toBeInTheDocument();
    await waitFor(() => {
      expect(calls.seriesFrom).toContain("2026-09-01");
    });
    expect(
      screen.queryByRole("table", { name: catalogPtBR["overview.ahead"] }),
    ).toBeNull();
  });
});

describe("home balances", () => {
  it("closes each account group with its total", async () => {
    const { fetch } = homeApi();
    const { container } = await renderApp("/", { fetch });
    const region = await screen.findByRole("region", {
      name: catalogPtBR["home.accounts"],
    });
    const available = await within(region).findByRole("table", {
      name: catalogPtBR["home.group.available"],
    });
    const total = available.querySelector("tfoot");
    expect(text(total)).toBe(
      `${catalogPtBR["accounts.group.total"]}R$ 1.734,56`,
    );
    expect(container.querySelector('[data-ui="stat-card"]')).toBeNull();
    expect(container.querySelector('[data-ui="card"]')).toBeNull();
  });

  it("lists the accounts of each group in a table captioned by the group", async () => {
    const { fetch } = homeApi();
    await renderApp("/", { fetch });
    const region = await screen.findByRole("region", {
      name: catalogPtBR["home.accounts"],
    });
    const cards = await within(region).findByRole("table", {
      name: catalogPtBR["home.group.cards"],
    });
    expect(within(cards).getByText("\u2212R$ 300,00")).toBeInTheDocument();
    expect(within(region).getAllByRole("table")).toHaveLength(2);
    expect(within(region).getByRole("link", { name: /Itaú/ })).toHaveAttribute(
      "href",
      "/accounts/a-checking",
    );
  });

  // Ledger sheet L17: Date, Description and Amount, without the Category column.
  it("renders the five recent transactions", async () => {
    const { fetch } = homeApi();
    await renderApp("/", { fetch });
    const region = await screen.findByRole("region", {
      name: catalogPtBR["home.recent"],
    });
    await within(region).findByText("Compra 1");
    const table = within(region).getByRole("table");
    expect(
      within(table)
        .getAllByRole("columnheader")
        .map((th) => th.textContent),
    ).toEqual([
      catalogPtBR["transactions.column.date"],
      catalogPtBR["transactions.column.description"],
      catalogPtBR["transactions.column.amount"],
    ]);
    const rows = within(table).getAllByRole("row").slice(1);
    expect(rows).toHaveLength(5);
    const [firstRow] = rows;
    if (firstRow === undefined) throw new Error("no recent row");
    expect(within(firstRow).getByText("Compra 1")).toBeInTheDocument();
    expect(within(firstRow).getByText("\u221210,00")).toBeInTheDocument();
  });

  // Ledger sheet L8: the count moved to the Transactions destination.
  it("shows no uncategorized alert", async () => {
    const { fetch } = homeApi();
    const { container } = await renderApp("/", { fetch });
    await screen.findByRole("region", { name: catalogPtBR["home.balances"] });
    expect(container.querySelector('[data-ui="alert"]')).toBeNull();
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
      name: catalogPtBR["home.accounts"],
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
    const row = (await within(region).findByText("Itaú")).closest("tr");
    expect(row?.textContent.replace(/\u00a0/g, " ")).toBe("ItaúR$ 1.234,56");
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
      "GET /api/v1/schedules": () => json(200, { items: [] }),
      "GET /api/v1/budgets": () => json(200, { items: [] }),
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
      screen.getByRole("heading", {
        level: 1,
        name: "Outubro de 2026",
      }),
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
    await within(recent).findByText("Compra 5");
    expect(within(recent).getAllByRole("row")).toHaveLength(6);
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

// Ledger sheet L5 and L7: the page header holds New on a phone, the top bar from 600 px.
// Shell second pass S2: New stands once, in the shell, never in the page header.
describe("home new transaction action", () => {
  it.each([
    [360, '[data-own="bottom-bar"]'],
    [768, '[data-own="bottom-bar"]'],
    [1280, '[data-own="ledger-index"]'],
  ])("is the shell's action at %i px", async (width, shell) => {
    const { fetch } = homeApi();
    const { container } = await renderApp("/", { fetch, width });
    const links = await screen.findAllByRole("link", {
      name: new RegExp(`^${catalogPtBR["nav.entry"]}`),
    });
    expect(links).toHaveLength(1);
    expect(links[0]?.closest(shell)).not.toBeNull();
    expect(links[0]).toHaveAttribute("href", "/transactions/new");
    expect(container.querySelector('[data-ui="page-header"] a')).toBeNull();
  });
});
