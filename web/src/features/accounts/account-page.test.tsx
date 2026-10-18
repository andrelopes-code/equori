import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";

import type { components } from "@/api/schema.gen";
import { catalogPtBR } from "@/i18n/catalog.pt-BR";
import { writeLocale } from "@/i18n/locale";
import { fakeApi, json } from "@/testing/fake-api";
import { renderApp } from "@/testing/render-app";

type Account = components["schemas"]["Account"];

const checkingID = "11111111-1111-4111-8111-111111111111";
const foodID = "22222222-2222-4222-8222-222222222222";

beforeEach(() => {
  localStorage.clear();
  writeLocale("pt-BR");
});

const accounts: Account[] = [
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
  id: "t-1",
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
    },
    {
      id: "p-2",
      account_id: foodID,
      amount: { amount: 4500, currency: "BRL" },
    },
  ],
};

function accountApi() {
  const balanceRequests: URLSearchParams[] = [];
  const seriesRequests: URLSearchParams[] = [];
  const transactionRequests: URLSearchParams[] = [];
  const closed: unknown[] = [];
  const patched: unknown[] = [];
  const fetch = fakeApi({
    "GET /api/v1/me": () => json(200, { id: 1, email: "a@b.c", role: "admin" }),
    "GET /api/v1/settings": () => json(200, { base_currency: "BRL" }),
    "GET /api/v1/instruments": () =>
      json(200, {
        items: [{ code: "BRL", type: "currency", scale: 2, name: "Real" }],
      }),
    "GET /api/v1/accounts": () => json(200, { items: accounts }),
    "GET /api/v1/payees": () => json(200, { items: [] }),
    [`GET /api/v1/accounts/${checkingID}/balance`]: (req) => {
      const params = new URL(req.url).searchParams;
      balanceRequests.push(params);
      const settled = params.get("basis") === "settled";
      return json(200, {
        account_id: checkingID,
        date: params.get("date"),
        basis: params.get("basis"),
        balance: { amount: settled ? 100000 : 123456, currency: "BRL" },
      });
    },
    "GET /api/v1/reports/balances": (req) => {
      seriesRequests.push(new URL(req.url).searchParams);
      return json(200, {
        items: [
          {
            date: "2026-10-16",
            balance: { amount: 123456, currency: "BRL" },
          },
          {
            date: "2026-10-17",
            balance: { amount: 118956, currency: "BRL" },
          },
        ],
      });
    },
    "GET /api/v1/transactions": (req) => {
      transactionRequests.push(new URL(req.url).searchParams);
      return json(200, { items: [transaction] });
    },
    [`POST /api/v1/accounts/${checkingID}/close`]: async (req) => {
      closed.push(await req.json());
      return json(200, accounts[0]);
    },
    [`PATCH /api/v1/accounts/${checkingID}`]: async (req) => {
      patched.push(await req.json());
      return json(200, accounts[0]);
    },
  });
  return {
    fetch,
    balanceRequests,
    seriesRequests,
    transactionRequests,
    closed,
    patched,
  };
}

describe("account page", () => {
  it("shows the booked and settled balance of the account at today", async () => {
    const { fetch, balanceRequests } = accountApi();
    await renderApp(`/accounts/${checkingID}`, { fetch });
    expect(
      await screen.findByRole("heading", { name: "Itaú", level: 1 }),
    ).toBeInTheDocument();
    expect(
      await screen.findByText(/1\.234,56/, { selector: "span" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/1\.000,00/)).toBeInTheDocument();
    expect(
      screen.getByText(catalogPtBR["accounts.balance.booked"]),
    ).toBeInTheDocument();
    expect(
      screen.getByText(catalogPtBR["accounts.balance.settled"]),
    ).toBeInTheDocument();
    expect(
      balanceRequests.map((p) => [p.get("date"), p.get("basis")]).sort(),
    ).toEqual([
      ["2026-10-17", "booked"],
      ["2026-10-17", "settled"],
    ]);
  });

  it("requests the 90-day daily balance series and draws the chart", async () => {
    const { fetch, seriesRequests } = accountApi();
    const { container } = await renderApp(`/accounts/${checkingID}`, { fetch });
    await waitFor(() => {
      expect(seriesRequests).toHaveLength(1);
    });
    expect(Object.fromEntries(seriesRequests[0] ?? [])).toEqual({
      account_id: checkingID,
      from: "2026-07-20",
      to: "2026-10-17",
    });
    await waitFor(() => {
      expect(container.querySelector('[data-ui="chart"]')).not.toBeNull();
    });
  });

  it("lists the transactions of the account", async () => {
    const { fetch, transactionRequests } = accountApi();
    await renderApp(`/accounts/${checkingID}`, { fetch });
    expect(await screen.findByText("Compra no mercado")).toBeInTheDocument();
    expect(transactionRequests[0]?.get("account_id")).toBe(checkingID);
  });

  it("links the new-transaction action in the page header with the account preselected", async () => {
    const { fetch } = accountApi();
    await renderApp(`/accounts/${checkingID}`, { fetch });
    await screen.findByText("Compra no mercado");
    const links = screen.getAllByRole("link", {
      name: catalogPtBR["nav.new"],
    });
    expect(links).toHaveLength(1);
    expect(links[0]).toHaveAttribute(
      "href",
      `/transactions/new?account_id=${checkingID}`,
    );
  });

  it("opens the edit dialog and saves a rename", async () => {
    const { fetch, patched } = accountApi();
    const user = userEvent.setup();
    await renderApp(`/accounts/${checkingID}`, { fetch });
    await user.click(
      await screen.findByRole("button", { name: "Ações de Itaú" }),
    );
    await user.click(
      await screen.findByRole("menuitem", {
        name: catalogPtBR["accounts.action.edit"],
      }),
    );
    const dialog = await screen.findByRole("dialog");
    expect(
      within(dialog).getByText(catalogPtBR["accounts.edit.title"]),
    ).toBeInTheDocument();
    const name = within(dialog).getByRole("textbox", {
      name: catalogPtBR["accounts.field.name"],
    });
    await user.type(name, "2");
    await user.click(
      within(dialog).getByRole("button", {
        name: catalogPtBR["accounts.edit.submit"],
      }),
    );
    await waitFor(() => {
      expect(patched).toHaveLength(1);
    });
    expect(patched).toEqual([{ name: "Itaú2" }]);
  });

  it("closes the account on today's date", async () => {
    const { fetch, closed } = accountApi();
    const user = userEvent.setup();
    await renderApp(`/accounts/${checkingID}`, { fetch });
    await user.click(
      await screen.findByRole("button", { name: "Ações de Itaú" }),
    );
    await user.click(
      await screen.findByRole("menuitem", {
        name: catalogPtBR["accounts.action.close"],
      }),
    );
    await user.click(
      await screen.findByRole("button", {
        name: catalogPtBR["accounts.close.confirm"],
      }),
    );
    await waitFor(() => {
      expect(closed).toEqual([{ closed_on: "2026-10-17" }]);
    });
  });

  it("shows no balance or chart for a category account", async () => {
    const { fetch, balanceRequests, seriesRequests } = accountApi();
    const { container } = await renderApp(`/accounts/${foodID}`, { fetch });
    expect(
      await screen.findByRole("heading", { name: "Mercado", level: 1 }),
    ).toBeInTheDocument();
    expect(container.querySelector('[data-ui="chart"]')).toBeNull();
    expect(balanceRequests).toHaveLength(0);
    expect(seriesRequests).toHaveLength(0);
  });

  it("states that an unknown account does not exist", async () => {
    const { fetch } = accountApi();
    await renderApp("/accounts/99999999-9999-4999-8999-999999999999", {
      fetch,
    });
    expect(
      await screen.findByText(catalogPtBR["accounts.notfound"]),
    ).toBeInTheDocument();
  });

  it("puts the chart in the content width and the new-transaction action in the bottom bar on a phone", async () => {
    const { fetch } = accountApi();
    const { container } = await renderApp(`/accounts/${checkingID}`, {
      fetch,
      width: 360,
    });
    await screen.findByText("Compra no mercado");
    await waitFor(() => {
      expect(container.querySelector('[data-ui="chart"]')).not.toBeNull();
    });
    const nav = screen.getByRole("navigation", {
      name: catalogPtBR["nav.label"],
    });
    const centre = within(nav).getByRole("link", {
      name: catalogPtBR["nav.new"],
    });
    expect(centre).toHaveAttribute(
      "href",
      `/transactions/new?account_id=${checkingID}`,
    );
    expect(
      screen.getAllByRole("link", { name: catalogPtBR["nav.new"] }),
    ).toHaveLength(1);
  });
});
