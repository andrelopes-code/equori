import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { catalogEn } from "@/i18n/catalog.en";
import { shiftDate } from "@/i18n/format";
import {
  accountRoutes,
  balancesAt,
  brokerageID,
  cardID,
  checkingID,
  connectionFixture,
  reserveID,
} from "@/testing/account-api";
import { fakeApi, json, problem } from "@/testing/fake-api";
import { moneyValue } from "@/testing/money-value";
import { renderApp } from "@/testing/render-app";

function api(queries: URLSearchParams[] = [], overrides = {}) {
  return fakeApi(
    accountRoutes({
      "GET /api/v1/balances": (req) => {
        const query = new URL(req.url).searchParams;
        queries.push(query);
        return balancesAt(req);
      },
      [`GET /api/v1/accounts/${checkingID}/reconciliation`]: () =>
        json(200, { last_reconciled_on: "2026-09-30" }),
      ...overrides,
    }),
  );
}

function words(key: keyof typeof catalogEn, values: Record<string, string>) {
  return Object.entries(values).reduce<string>(
    (text, [k, v]) => text.replace(`{${k}}`, v),
    catalogEn[key],
  );
}

// A return route: the reserve paid 101.80% of the CDI (a rate profile) and the brokerage lost
// 13.80% while the CDI grew 3.52% (a market profile). asked collects the account of each request.
function comparedIn90Days(asked: string[], startsAfter = 0) {
  return (req: Request) => {
    const query = new URL(req.url).searchParams;
    const account = query.get("account_id") ?? "";
    asked.push(account);
    const window = {
      index: "cdi",
      from: shiftDate(query.get("from") ?? "", startsAfter),
      until: query.get("to"),
      days: 63,
      index_annual_bp: 1490,
    };
    const rate = {
      profile: "rate",
      period_bp: 340,
      benchmark: {
        ...window,
        return_bp: 340,
        index_bp: 334,
        percent_bp: 10180,
        annual_bp: 1517,
        excess_bp: 6,
      },
    };
    const market = {
      profile: "market",
      period_bp: -1380,
      benchmark: {
        ...window,
        return_bp: -1380,
        index_bp: 352,
        excess_bp: -1732,
      },
    };
    return json(200, {
      annual_bp: 0,
      flows: [],
      opening: { amount: 1000000, currency: "BRL" },
      closing: { amount: 1034000, currency: "BRL" },
      ...(account === brokerageID ? market : rate),
    });
  };
}

describe("AccountsPage", () => {
  it("adds up assets, liabilities and net worth in the base currency", async () => {
    await renderApp("/accounts", { fetch: api() });
    const figures = await screen.findByRole("region", {
      name: catalogEn["balanceSheet.figures"],
    });
    await waitFor(() => {
      expect(
        within(figures).getByText(moneyValue("R$15,390.55")),
      ).toBeInTheDocument();
    });
    expect(
      within(figures).getByText(moneyValue("R$14,500.00")),
    ).toBeInTheDocument();
    expect(
      within(figures).getByText(moneyValue("R$890.55")),
    ).toBeInTheDocument();
  });

  it("compares with the balances of 30 days earlier", async () => {
    const queries: URLSearchParams[] = [];
    await renderApp("/accounts", { fetch: api(queries) });
    await waitFor(() => {
      expect(queries.map((q) => q.get("date")).sort()).toEqual([
        "2026-09-17",
        "2026-10-17",
      ]);
    });
  });

  it("leaves the trend empty, not loading, for an account that holds several instruments", async () => {
    let refused = 0;
    const { container } = await renderApp("/accounts", {
      fetch: api([], {
        "GET /api/v1/reports/balances": () => {
          refused += 1;
          return problem(422, "mixed_instruments");
        },
      }),
    });
    await waitFor(() => {
      expect(refused).toBeGreaterThan(0);
      expect(container.querySelector('[data-ui="skeleton"]')).toBeNull();
    });
  });

  it("reads the settled balances when the basis says so", async () => {
    const queries: URLSearchParams[] = [];
    await renderApp("/accounts?basis=settled", { fetch: api(queries) });
    await waitFor(() => {
      expect(queries.length).toBeGreaterThan(0);
    });
    expect(queries.every((q) => q.get("basis") === "settled")).toBe(true);
  });

  it("nests sub-accounts under their parent and states the currencies left out", async () => {
    await renderApp("/accounts", { fetch: api() });
    const table = await screen.findByRole("table", {
      name: catalogEn["home.group.available"],
    });
    await waitFor(() => {
      expect(
        within(table)
          .getAllByRole("rowheader")
          .map((cell) => cell.textContent)
          // The summary row's header closes the list.
          .filter((text) => text !== catalogEn["balanceSheet.groupTotal"]),
      ).toEqual([
        expect.stringContaining("Carteiras"),
        expect.stringContaining("Dinheiro"),
        expect.stringContaining("Nubank"),
        expect.stringContaining("Wise USD"),
      ]);
    });
    // Wise USD among the available accounts, PETR4 among the reserves.
    expect(
      screen.getAllByText(words("balanceSheet.excluded", { count: "1" })),
    ).toHaveLength(2);
  });

  it("states when an account was last reconciled", async () => {
    await renderApp("/accounts", { fetch: api() });
    const table = await screen.findByRole("table", {
      name: catalogEn["home.group.available"],
    });
    const nubank = await within(table).findByRole("row", { name: /Nubank/ });
    expect(await within(nubank).findByText(/Reconciled/)).toBeInTheDocument();
  });

  it("adds a yield column to the group of a reserve and a brokerage (A208 R17)", async () => {
    const asked: string[] = [];
    await renderApp("/accounts", {
      fetch: api([], { "GET /api/v1/reports/return": comparedIn90Days(asked) }),
    });
    const reserves = await screen.findByRole("table", {
      name: catalogEn["home.group.reserves"],
    });
    expect(
      within(reserves).getByRole("columnheader", {
        name: catalogEn["balanceSheet.yield"],
      }),
    ).toBeInTheDocument();
    const reserve = await within(reserves).findByRole("row", {
      name: /Reserva de emergência/,
    });
    expect(
      await within(reserve).findByText("15.17% a year"),
    ).toBeInTheDocument();
    expect(within(reserve).getByText("101.80% of CDI")).toBeInTheDocument();
    const broker = within(reserves).getByRole("row", { name: /Corretora/ });
    // A loss reads in the danger tone; a gain in the default one.
    expect(await within(broker).findByText("−13.80%")).toHaveAttribute(
      "data-tone",
      "danger",
    );
    expect(within(reserve).getByText("15.17% a year")).toHaveAttribute(
      "data-tone",
      "default",
    );
    expect(within(broker).getByText("CDI 3.52%")).toBeInTheDocument();
    expect(within(broker).queryByText(/a year|of CDI/)).not.toBeInTheDocument();
    const available = screen.getByRole("table", {
      name: catalogEn["home.group.available"],
    });
    expect(
      within(available).queryByRole("columnheader", {
        name: catalogEn["balanceSheet.yield"],
      }),
    ).not.toBeInTheDocument();
    expect(asked.sort()).toEqual([reserveID, brokerageID].sort());
  });

  it("says from when the comparison runs when it starts late (A208 R8)", async () => {
    await renderApp("/accounts", {
      fetch: api([], {
        "GET /api/v1/reports/return": comparedIn90Days([], 20),
      }),
    });
    const reserves = await screen.findByRole("table", {
      name: catalogEn["home.group.reserves"],
    });
    const reserve = await within(reserves).findByRole("row", {
      name: /Reserva de emergência/,
    });

    expect(
      await within(reserve).findByText(/^101.80% of CDI · since /),
    ).toBeInTheDocument();
  });

  it("states only the figure on a phone (A208 R17)", async () => {
    await renderApp("/accounts", {
      fetch: api([], { "GET /api/v1/reports/return": comparedIn90Days([]) }),
      width: 390,
    });
    const list = await screen.findByRole("list", {
      name: catalogEn["home.group.reserves"],
    });
    const reserve = await within(list).findByRole("link", {
      name: /Reserva de emergência/,
    });
    expect(
      await within(reserve).findByText("15.17% a year"),
    ).toBeInTheDocument();
    expect(within(reserve).queryByText(/of CDI/)).not.toBeInTheDocument();
  });

  it("opens a card on the cards destination", async () => {
    const { router } = await renderApp("/accounts", { fetch: api() });
    const table = await screen.findByRole("table", {
      name: catalogEn["home.group.cards"],
    });
    await userEvent.click(
      await within(table).findByRole("link", { name: /Itaú Visa/ }),
    );
    await waitFor(() => {
      expect(router.state.location.pathname).toBe(`/cards/${cardID}`);
    });
  });

  it("shows closed accounts only when asked", async () => {
    await renderApp("/accounts", { fetch: api() });
    await screen.findByRole("table", {
      name: catalogEn["home.group.available"],
    });
    expect(screen.queryByText("Conta antiga")).not.toBeInTheDocument();
    await userEvent.click(
      screen.getByRole("switch", {
        name: catalogEn["balanceSheet.showClosed"],
      }),
    );
    // The sheet renders again from the deferred search, after the switch has painted (CP-09).
    expect(
      await screen.findByText("Conta antiga", {}, { timeout: 4000 }),
    ).toBeInTheDocument();
  });

  it("says how many external accounts wait for a link", async () => {
    await renderApp("/accounts", { fetch: api() });
    const pending = connectionFixture.accounts.filter(
      (a) => a.state === "pending",
    ).length;
    expect(
      await screen.findByText(
        words("balanceSheet.pendingLinks", { count: String(pending) }),
      ),
    ).toBeInTheDocument();
  });

  it("offers the first account when there is none", async () => {
    await renderApp("/accounts", {
      fetch: api([], {
        "GET /api/v1/accounts": () => json(200, { items: [] }),
        "GET /api/v1/balances": () => json(200, { items: [] }),
        "GET /api/v1/connections": () => json(200, { items: [] }),
      }),
    });
    expect(
      await screen.findByText(catalogEn["balanceSheet.empty"]),
    ).toBeInTheDocument();
  });

  it("lists rows instead of tables on a phone", async () => {
    await renderApp("/accounts", { fetch: api(), width: 390 });
    expect(
      await screen.findByRole("list", {
        name: catalogEn["home.group.available"],
      }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });
});

describe("AccountsPage on a phone (ADR 027, S6)", () => {
  it("offers no new account and no strip of desktop-only tabs", async () => {
    await renderApp("/accounts", { fetch: api(), width: 390 });
    await screen.findByRole("heading", { level: 1 });

    expect(
      screen.queryByRole("button", { name: catalogEn["balanceSheet.new"] }),
    ).toBeNull();
    expect(
      screen.queryByRole("tablist", { name: catalogEn["nav.accounts"] }),
    ).toBeNull();
  });
});
