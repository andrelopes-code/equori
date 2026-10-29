import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { catalogEn } from "@/i18n/catalog.en";
import {
  accountRoutes,
  balancesAt,
  cardID,
  checkingID,
  connectionFixture,
} from "@/testing/account-api";
import { fakeApi, json, problem } from "@/testing/fake-api";
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

describe("AccountsPage", () => {
  it("adds up assets, liabilities and net worth in the base currency", async () => {
    await renderApp("/accounts", { fetch: api() });
    const figures = await screen.findByRole("region", {
      name: catalogEn["balanceSheet.figures"],
    });
    await waitFor(() => {
      expect(within(figures).getByText("R$15,390.55")).toBeInTheDocument();
    });
    expect(within(figures).getByText("R$14,500.00")).toBeInTheDocument();
    expect(within(figures).getByText("R$890.55")).toBeInTheDocument();
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
