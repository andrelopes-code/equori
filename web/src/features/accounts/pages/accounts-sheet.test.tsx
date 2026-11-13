import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";

import { catalogEn } from "@/i18n/catalog.en";
import { accountRoutes, stockID } from "@/testing/account-api";
import { fakeApi, json } from "@/testing/fake-api";
import { renderApp } from "@/testing/render-app";

beforeEach(() => {
  localStorage.clear();
});

// The hierarchy, the grouping and the order of the list (AL1 to AL9 of
// docs/specs/2026-11-13-accounts-list-design.md).
describe("AccountsPage list", () => {
  it("folds the children of a parent and opens them again", async () => {
    await renderApp("/accounts", { fetch: fakeApi(accountRoutes()) });
    const table = await available();
    expect(
      await within(table).findByRole("link", { name: "Dinheiro" }),
    ).toBeInTheDocument();

    await userEvent.click(
      within(table).getByRole("button", {
        name: "Hide the accounts under Carteiras",
      }),
    );

    expect(
      within(table).queryByRole("link", { name: "Dinheiro" }),
    ).not.toBeInTheDocument();
    const toggle = within(table).getByRole("button", {
      name: "Show the accounts under Carteiras",
    });
    expect(toggle).toHaveAttribute("aria-expanded", "false");

    await userEvent.click(toggle);

    expect(
      within(table).getByRole("link", { name: "Dinheiro" }),
    ).toBeInTheDocument();
  });

  it("folds the positions of a brokerage into one line until it is opened", async () => {
    await renderApp("/accounts", { fetch: fakeApi(accountRoutes()) });
    const table = await screen.findByRole("table", {
      name: catalogEn["home.group.reserves"],
    });
    const toggle = await within(table).findByRole("button", {
      name: "Show the positions of Corretora",
    });
    expect(within(table).getByText("1 position")).toBeInTheDocument();
    expect(
      within(table).queryByRole("link", { name: "PETR4" }),
    ).not.toBeInTheDocument();

    await userEvent.click(toggle);

    expect(
      within(table).getByRole("link", { name: "PETR4" }),
    ).toBeInTheDocument();
  });

  it("orders the accounts by name when the address says so", async () => {
    await renderApp("/accounts?order=name", {
      fetch: fakeApi(accountRoutes()),
    });
    const table = await available();

    await waitFor(() => {
      expect(rowHeaders(table)).toEqual([
        expect.stringContaining("Carteiras"),
        expect.stringContaining("Dinheiro"),
        expect.stringContaining("Nubank"),
        expect.stringContaining("Wise USD"),
      ]);
    });
  });

  it("puts first the parent of a folded position in difference when ordered by attention", async () => {
    await renderApp("/accounts?order=attention", {
      fetch: fakeApi(
        accountRoutes({
          // The position stands folded, so no row reads its status: the list reads it.
          [`GET /api/v1/accounts/${stockID}/reconciliation`]: () =>
            json(200, {
              open_difference: {
                difference: { amount: 3840, currency: "BRL" },
              },
            }),
        }),
      ),
    });
    const table = await screen.findByRole("table", {
      name: catalogEn["home.group.reserves"],
    });

    await waitFor(() => {
      expect(rowHeaders(table)[0]).toContain("Corretora");
    });
    expect(rowHeaders(table).at(-1)).toContain("Reserva de emergência");
  });

  it("orders the reserves by balance when the address says nothing", async () => {
    await renderApp("/accounts", { fetch: fakeApi(accountRoutes()) });
    const table = await screen.findByRole("table", {
      name: catalogEn["home.group.reserves"],
    });

    await waitFor(() => {
      expect(rowHeaders(table)[0]).toContain("Reserva de emergência");
    });
  });

  it("groups the accounts by institution when the address says so", async () => {
    await renderApp("/accounts?group=institution", {
      fetch: fakeApi(accountRoutes()),
    });

    expect(
      await screen.findByRole("table", { name: "Nubank" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("table", { name: "Itaú" })).toBeInTheDocument();
    expect(
      screen.getByRole("table", {
        name: catalogEn["balanceSheet.noInstitution"],
      }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("table", { name: catalogEn["home.group.available"] }),
    ).not.toBeInTheDocument();
  });

  it("lists the accounts in one table and leaves out a parent with no balance of its own", async () => {
    await renderApp("/accounts?group=none", {
      fetch: fakeApi(accountRoutes()),
    });

    const table = await screen.findByRole("table", {
      name: catalogEn["balanceSheet.allAccounts"],
    });

    expect(
      await within(table).findByRole("link", { name: "Dinheiro" }),
    ).toBeInTheDocument();
    expect(
      within(table).queryByRole("link", { name: "Carteiras" }),
    ).not.toBeInTheDocument();
  });

  it("changes the grouping from the controls", async () => {
    await renderApp("/accounts", { fetch: fakeApi(accountRoutes()) });
    await available();

    await userEvent.click(
      screen.getByRole("radio", {
        name: catalogEn["balanceSheet.groupInstitution"],
      }),
    );

    expect(
      await screen.findByRole("table", { name: "Nubank" }),
    ).toBeInTheDocument();
  });
});

describe("AccountsPage remembers the grouping and the order (AL16)", () => {
  const key = "equori.accounts.sheet";

  it("opens the list as the reader left it", async () => {
    localStorage.setItem(
      key,
      JSON.stringify({ group: "institution", order: "name" }),
    );

    await renderApp("/accounts", { fetch: fakeApi(accountRoutes()) });

    expect(
      await screen.findByRole("table", { name: "Nubank" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("table", { name: catalogEn["home.group.available"] }),
    ).not.toBeInTheDocument();
  });

  it("lets the address win over the remembered choice", async () => {
    localStorage.setItem(
      key,
      JSON.stringify({ group: "institution", order: "balance" }),
    );

    await renderApp("/accounts?group=kind", {
      fetch: fakeApi(accountRoutes()),
    });

    expect(await available()).toBeInTheDocument();
    expect(
      screen.queryByRole("table", { name: "Nubank" }),
    ).not.toBeInTheDocument();
  });

  it("remembers a choice made from the controls", async () => {
    await renderApp("/accounts", { fetch: fakeApi(accountRoutes()) });
    await available();

    await userEvent.click(
      screen.getByRole("radio", {
        name: catalogEn["balanceSheet.groupInstitution"],
      }),
    );
    await screen.findByRole("table", { name: "Nubank" });
    await userEvent.click(
      screen.getByRole("radio", { name: catalogEn["balanceSheet.orderName"] }),
    );

    await waitFor(() => {
      expect(JSON.parse(localStorage.getItem(key) ?? "{}")).toEqual({
        group: "institution",
        order: "name",
      });
    });
  });

  it("goes back to the type grouping when the reader chooses it again", async () => {
    localStorage.setItem(
      key,
      JSON.stringify({ group: "institution", order: "balance" }),
    );
    await renderApp("/accounts", { fetch: fakeApi(accountRoutes()) });
    await screen.findByRole("table", { name: "Nubank" });

    await userEvent.click(
      screen.getByRole("radio", { name: catalogEn["balanceSheet.groupKind"] }),
    );

    expect(await available()).toBeInTheDocument();
  });
});

describe("AccountsPage list on a phone (AL12)", () => {
  it("folds the positions into one row and lists the children of a parent", async () => {
    await renderApp("/accounts", {
      fetch: fakeApi(accountRoutes()),
      width: 390,
    });
    const reserves = await screen.findByRole("list", {
      name: catalogEn["home.group.reserves"],
    });
    const toggle = await within(reserves).findByRole("button", {
      name: "Show the positions of Corretora",
    });
    expect(
      within(reserves).queryByRole("link", { name: /PETR4/ }),
    ).not.toBeInTheDocument();

    await userEvent.click(toggle);

    expect(
      within(reserves).getByRole("link", { name: /PETR4/ }),
    ).toBeInTheDocument();
    const available = await screen.findByRole("list", {
      name: catalogEn["home.group.available"],
    });
    expect(
      within(available).getByRole("link", { name: /Dinheiro/ }),
    ).toBeInTheDocument();
  });

  it("offers the grouping and the order as selects", async () => {
    await renderApp("/accounts", {
      fetch: fakeApi(accountRoutes()),
      width: 390,
    });

    expect(
      await screen.findByRole("combobox", {
        name: catalogEn["balanceSheet.groupBy"],
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("combobox", { name: catalogEn["balanceSheet.order"] }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("radio", {
        name: catalogEn["balanceSheet.groupInstitution"],
      }),
    ).not.toBeInTheDocument();
  });
});

async function available() {
  return screen.findByRole("table", {
    name: catalogEn["home.group.available"],
  });
}

function rowHeaders(table: HTMLElement): (string | null)[] {
  return within(table)
    .getAllByRole("rowheader")
    .map((cell) => cell.textContent);
}
