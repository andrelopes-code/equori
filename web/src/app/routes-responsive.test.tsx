import { configure, getConfig, screen } from "@testing-library/react";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import { catalogPtBR } from "@/i18n/catalog.pt-BR";
import { writeLocale } from "@/i18n/locale";
import { fakeApi, json } from "@/testing/fake-api";
import { renderApp } from "@/testing/render-app";

const checkingID = "11111111-1111-4111-8111-111111111111";
const foodID = "22222222-2222-4222-8222-222222222222";
const txID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

// Mounting the Chart on the account page costs about 600 ms of synchronous work per render in jsdom, so the default 5 s test
// timeout and 1 s query timeout are CPU bound here. vitest reads the test timeout when `it` is collected, so it is set at
// module level; the query timeout is read per call.
vi.setConfig({ testTimeout: 20_000 });
const defaultAsyncUtilTimeout = getConfig().asyncUtilTimeout;
beforeAll(() => {
  configure({ asyncUtilTimeout: 10_000 });
});
afterAll(() => {
  configure({ asyncUtilTimeout: defaultAsyncUtilTimeout });
});

beforeEach(() => {
  localStorage.clear();
  writeLocale("pt-BR");
});

const accounts = [
  {
    id: checkingID,
    name: "Itaú",
    class: "asset",
    kind: "checking",
    currency: "BRL",
    opened_on: "2026-01-01",
    yield_mode: "none",
  },
  {
    id: foodID,
    name: "Mercado",
    class: "expense",
    currency: "BRL",
    opened_on: "2026-01-01",
    yield_mode: "none",
  },
];

const transaction = {
  id: txID,
  date: "2026-10-16",
  description: "Compra no mercado",
  balancing_currency: "BRL",
  origin: "manual",
  version: 1,
  tags: [],
  links: [],
  postings: [
    {
      id: "p-1",
      account_id: checkingID,
      amount: { amount: -4500, currency: "BRL" },
      weight: { amount: -4500, currency: "BRL" },
      status: "cleared",
    },
    {
      id: "p-2",
      account_id: foodID,
      amount: { amount: 4500, currency: "BRL" },
      weight: { amount: 4500, currency: "BRL" },
      status: "cleared",
    },
  ],
};

function newFetch() {
  return fakeApi({
    "GET /api/v1/me": () => json(200, { id: 1, email: "a@b.c", role: "admin" }),
    "GET /api/v1/settings": () => json(200, { base_currency: "BRL" }),
    "GET /api/v1/instruments": () =>
      json(200, {
        items: [{ code: "BRL", type: "currency", scale: 2, name: "Real" }],
      }),
    "GET /api/v1/accounts": () => json(200, { items: accounts }),
    "GET /api/v1/payees": () => json(200, { items: [] }),
    "GET /api/v1/tags": () => json(200, { items: [] }),
    "GET /api/v1/institutions": () => json(200, { items: [] }),
    "GET /api/v1/schedules": () => json(200, { items: [] }),
    "GET /api/v1/budgets": () => json(200, { items: [] }),
    [`GET /api/v1/accounts/${checkingID}/projection`]: () =>
      json(200, {
        account_id: checkingID,
        from: "2026-10-17",
        to: "2026-10-31",
        opening: { amount: 123456, currency: "BRL" },
        closing: { amount: 123456, currency: "BRL" },
        points: [],
      }),
    "GET /api/v1/balances": () =>
      json(200, {
        items: [
          {
            account_id: checkingID,
            date: "2026-10-17",
            basis: "booked",
            balance: { amount: 123456, currency: "BRL" },
          },
        ],
      }),
    [`GET /api/v1/accounts/${checkingID}/balance`]: (req) => {
      const params = new URL(req.url).searchParams;
      return json(200, {
        account_id: checkingID,
        date: params.get("date"),
        basis: params.get("basis"),
        balance: { amount: 123456, currency: "BRL" },
      });
    },
    "GET /api/v1/reports/balances": () =>
      json(200, {
        items: [
          { date: "2026-10-16", balance: { amount: 123456, currency: "BRL" } },
          { date: "2026-10-17", balance: { amount: 118956, currency: "BRL" } },
        ],
      }),
    "GET /api/v1/transactions": () => json(200, { items: [transaction] }),
    [`GET /api/v1/transactions/${txID}`]: () => json(200, transaction),
    [`GET /api/v1/transactions/${txID}/versions`]: () =>
      json(200, { items: [] }),
  });
}

interface RouteCase {
  path: string;
  heading: string;
  // Text that renders only once the page data has loaded.
  loaded: string;
  authenticated: boolean;
}

const routes: RouteCase[] = [
  {
    path: "/",
    heading: "Outubro de 2026",
    loaded: "Itaú",
    authenticated: true,
  },
  {
    path: "/transactions",
    heading: catalogPtBR["nav.transactions"],
    loaded: "Compra no mercado",
    authenticated: true,
  },
  {
    path: "/transactions/new",
    heading: catalogPtBR["nav.new"],
    loaded: catalogPtBR["transactions.new.category"],
    authenticated: true,
  },
  {
    path: `/transactions/${txID}`,
    heading: "Compra no mercado",
    loaded: "Mercado",
    authenticated: true,
  },
  {
    path: "/accounts",
    heading: catalogPtBR["accounts.title"],
    loaded: "Itaú",
    authenticated: true,
  },
  {
    path: `/accounts/${checkingID}`,
    heading: "Itaú",
    loaded: catalogPtBR["accounts.balance.booked"],
    authenticated: true,
  },
  {
    path: "/settings",
    heading: catalogPtBR["more.settings"],
    loaded: catalogPtBR["more.settings"],
    authenticated: true,
  },
  {
    path: "/login",
    heading: catalogPtBR["login.title"],
    loaded: catalogPtBR["login.title"],
    authenticated: false,
  },
];

describe.each([360, 768, 1280])("routes at %i px", (width) => {
  it.each(routes)(
    "renders $path with the navigation of the width",
    async ({ path, heading, loaded, authenticated }) => {
      const { container } = await renderApp(path, {
        width,
        fetch: newFetch(),
      });

      expect(
        await screen.findByRole("heading", { name: heading, level: 1 }),
      ).toBeInTheDocument();
      expect((await screen.findAllByText(loaded)).length).toBeGreaterThan(0);
      expect(
        container.querySelector(
          '[data-ui="result-state"][data-status="error"]',
        ),
      ).toBeNull();

      const bar = container.querySelector('[data-own="bottom-bar"]');
      // Shell second pass S1 and S2: the ledger index from 1024 px, a bottom bar below.
      const index = container.querySelector('[data-own="ledger-index"]');
      if (!authenticated) {
        expect(bar).toBeNull();
        expect(index).toBeNull();
      } else if (width < 1024) {
        expect(bar).not.toBeNull();
        expect(index).toBeNull();
      } else {
        expect(bar).toBeNull();
        expect(index).not.toBeNull();
      }
      expect(container.querySelector('[data-ui="top-navigation"]')).toBeNull();
    },
  );
});
