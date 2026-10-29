import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { catalogEn } from "@/i18n/catalog.en";
import {
  accountFixtures,
  accountRoutes,
  brokerageID,
  cardID,
  checkingID,
  closedID,
  money,
  reserveID,
  stockID,
  usdID,
} from "@/testing/account-api";
import { fakeApi, json, problem } from "@/testing/fake-api";
import { moneyValue } from "@/testing/money-value";
import { renderApp } from "@/testing/render-app";

type Route = (req: Request) => Response | Promise<Response>;

function api(overrides: Record<string, Route> = {}) {
  return fakeApi(
    accountRoutes({
      [`GET /api/v1/accounts/${checkingID}/reconciliation`]: () =>
        json(200, { last_reconciled_on: "2026-09-30" }),
      [`GET /api/v1/accounts/${checkingID}/balance`]: (req) => {
        const basis = new URL(req.url).searchParams.get("basis");
        return json(200, {
          account_id: checkingID,
          date: "2026-10-17",
          basis,
          balance: money(basis === "settled" ? 500000 : 524055),
        });
      },
      [`GET /api/v1/accounts/${checkingID}/projection`]: (req) =>
        json(200, {
          account_id: checkingID,
          from: "2026-10-17",
          to: new URL(req.url).searchParams.get("to"),
          opening: money(524055),
          closing: money(374055),
          points: [
            {
              date: "2026-11-05",
              occurrence_id: "o1",
              schedule_id: "s1",
              amount: money(-150000),
              balance: money(374055),
            },
          ],
        }),
      ...overrides,
    }),
  );
}

function tab(name: keyof typeof catalogEn) {
  return screen.queryByRole("tab", { name: new RegExp(`^${catalogEn[name]}`) });
}

function findTab(name: keyof typeof catalogEn) {
  return screen.findByRole("tab", { name: new RegExp(`^${catalogEn[name]}`) });
}

describe("AccountPage", () => {
  it("names the account with its kind and when it was last reconciled", async () => {
    await renderApp(`/accounts/${checkingID}`, { fetch: api() });
    expect(
      await screen.findByRole("heading", { level: 1, name: "Nubank" }),
    ).toBeInTheDocument();
    expect(
      await screen.findByText(/Reconciled on 09\/30\/2026/),
    ).toBeInTheDocument();
    expect(
      screen.getAllByText(catalogEn["kind.title.checking"]).length,
    ).toBeGreaterThan(0);
  });

  it("sends a card to the cards destination", async () => {
    const { router } = await renderApp(`/accounts/${cardID}`, { fetch: api() });
    await waitFor(() => {
      expect(router.state.location.pathname).toBe(`/cards/${cardID}`);
    });
  });

  it("says the account does not exist and keeps the way back", async () => {
    const missing = "a1000000-0000-4000-8000-0000000000ff";
    await renderApp(`/accounts/${missing}`, {
      fetch: api({
        [`GET /api/v1/accounts/${missing}`]: () => problem(404, "not_found"),
      }),
    });
    expect(
      await screen.findByText(catalogEn["account.notFound"]),
    ).toBeInTheDocument();
    expect(
      screen
        .getAllByRole("link", { name: catalogEn["nav.accounts"] })
        .some((link) => link.getAttribute("data-part") === "back"),
    ).toBe(true);
  });

  it("offers to try again after a failed read", async () => {
    let failing = true;
    await renderApp(`/accounts/${checkingID}`, {
      fetch: api({
        [`GET /api/v1/accounts/${checkingID}`]: () =>
          failing ? problem(503, "server_busy") : json(200, accountFixtures[0]),
      }),
    });
    const retry = await screen.findByRole("button", {
      name: catalogEn["common.retry"],
    });
    failing = false;
    await userEvent.click(retry);
    expect(
      await screen.findByRole("heading", { level: 1, name: "Nubank" }),
    ).toBeInTheDocument();
  });

  it("reads the balance, the settled balance and the projection in 30 days", async () => {
    const tos: (string | null)[] = [];
    await renderApp(`/accounts/${checkingID}`, {
      fetch: api({
        [`GET /api/v1/accounts/${checkingID}/projection`]: (req) => {
          tos.push(new URL(req.url).searchParams.get("to"));
          return json(200, {
            account_id: checkingID,
            from: "2026-10-17",
            to: "2026-11-16",
            opening: money(524055),
            closing: money(374055),
            points: [],
          });
        },
      }),
    });
    const figures = await screen.findByRole("region", {
      name: catalogEn["account.figures"],
    });
    expect(
      await within(figures).findByText(moneyValue("R$5,240.55")),
    ).toBeInTheDocument();
    expect(
      await within(figures).findByText(/R\$5,000\.00/),
    ).toBeInTheDocument();
    expect(
      await within(figures).findByText(moneyValue("R$3,740.55")),
    ).toBeInTheDocument();
    expect(tos).toContain("2026-11-16");
  });

  it("shows the progress of a goal that covers the account", async () => {
    await renderApp(`/accounts/${reserveID}`, {
      fetch: api({
        "GET /api/v1/goals": () =>
          json(200, {
            items: [
              {
                id: "g1",
                name: "Viagem",
                target: money(2000000),
                due_on: "2027-06-30",
                account_ids: [reserveID],
                current: money(1000000),
                remaining: money(1000000),
                progress_bp: 5000,
              },
            ],
          }),
      }),
    });
    const figures = await screen.findByRole("region", {
      name: catalogEn["account.figures"],
    });
    expect(await within(figures).findByText("Viagem")).toBeInTheDocument();
    expect(within(figures).getByText(/50%/)).toBeInTheDocument();
  });

  it("charts the balance of the last 90 days", async () => {
    const froms: (string | null)[] = [];
    await renderApp(`/accounts/${checkingID}`, {
      fetch: api({
        "GET /api/v1/reports/balances": (req) => {
          froms.push(new URL(req.url).searchParams.get("from"));
          return json(200, { items: [] });
        },
      }),
    });
    await waitFor(() => {
      expect(froms).toContain("2026-07-20");
    });
  });

  it("offers positions only for a brokerage account and sync only for a linked one", async () => {
    await renderApp(`/accounts/${checkingID}`, { fetch: api() });
    await screen.findByRole("heading", { level: 1, name: "Nubank" });
    expect(await findTab("account.tab.sync")).toBeInTheDocument();
    expect(tab("account.tab.positions")).not.toBeInTheDocument();
  });

  it("offers positions on a brokerage account", async () => {
    await renderApp(`/accounts/${brokerageID}`, { fetch: api() });
    await screen.findByRole("heading", { level: 1, name: "Corretora" });
    expect(await findTab("account.tab.positions")).toBeInTheDocument();
    expect(tab("account.tab.sync")).not.toBeInTheDocument();
  });

  it("closes the account on a date and states a balance left in it", async () => {
    const bodies: unknown[] = [];
    await renderApp(`/accounts/${checkingID}`, {
      fetch: api({
        [`POST /api/v1/accounts/${checkingID}/close`]: async (req) => {
          bodies.push(await req.json());
          return problem(409, "account_not_empty");
        },
      }),
    });
    await userEvent.click(
      await screen.findByRole("button", { name: catalogEn["account.more"] }),
    );
    await userEvent.click(
      await screen.findByRole("menuitem", { name: catalogEn["account.close"] }),
    );
    const dialog = await screen.findByRole("dialog");
    await userEvent.click(
      within(dialog).getByRole("button", {
        name: catalogEn["account.closeConfirm"],
      }),
    );
    expect(
      await within(dialog).findByText(catalogEn["problem.account_not_empty"], {
        exact: false,
      }),
    ).toBeInTheDocument();
    expect(bodies).toEqual([{ closed_on: "2026-10-17" }]);
  });

  it("reopens a closed account", async () => {
    const sent: string[] = [];
    await renderApp(`/accounts/${closedID}`, {
      fetch: api({
        [`POST /api/v1/accounts/${closedID}/reopen`]: () => {
          sent.push("reopen");
          return json(200, { ...accountFixtures[9], closed_on: undefined });
        },
      }),
    });
    await userEvent.click(
      await screen.findByRole("button", { name: catalogEn["account.more"] }),
    );
    await userEvent.click(
      await screen.findByRole("menuitem", {
        name: catalogEn["account.reopen"],
      }),
    );
    const dialog = await screen.findByRole("dialog");
    await userEvent.click(
      within(dialog).getByRole("button", {
        name: catalogEn["account.reopenConfirm"],
      }),
    );
    await waitFor(() => {
      expect(sent).toEqual(["reopen"]);
    });
  });

  it("records a trade from the page of a security account, with the account chosen", async () => {
    const { router } = await renderApp(`/accounts/${stockID}`, {
      fetch: api(),
    });
    await userEvent.click(
      await screen.findByRole("button", { name: catalogEn["trade.record"] }),
    );
    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/transactions/new");
    });
    expect(router.state.location.search).toEqual({
      account_id: stockID,
      kind: "trade",
    });
  });

  it("records an income from the page of a security account, with the account chosen", async () => {
    const { router } = await renderApp(`/accounts/${stockID}`, {
      fetch: api(),
    });
    await userEvent.click(
      await screen.findByRole("button", { name: catalogEn["income.record"] }),
    );
    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/transactions/new");
    });
    expect(router.state.location.search).toEqual({
      account_id: stockID,
      kind: "investment_income",
    });
  });

  it("records a currency exchange from the page of a foreign currency account, with the account chosen", async () => {
    const { router } = await renderApp(`/accounts/${usdID}`, {
      fetch: api(),
    });
    await userEvent.click(
      await screen.findByRole("button", { name: catalogEn["exchange.record"] }),
    );
    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/transactions/new");
    });
    expect(router.state.location.search).toEqual({
      account_id: usdID,
      kind: "exchange",
    });
  });

  it("offers no exchange on an account in the base currency", async () => {
    await renderApp(`/accounts/${checkingID}`, { fetch: api() });
    await screen.findByRole("button", {
      name: catalogEn["account.recordBalance"],
    });
    expect(
      screen.queryByRole("button", { name: catalogEn["exchange.record"] }),
    ).toBeNull();
  });

  it("offers no trade on an account that holds a currency", async () => {
    await renderApp(`/accounts/${checkingID}`, { fetch: api() });
    await screen.findByRole("button", {
      name: catalogEn["account.recordBalance"],
    });
    expect(
      screen.queryByRole("button", { name: catalogEn["trade.record"] }),
    ).toBeNull();
  });
});
