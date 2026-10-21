import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";

import { catalogEn } from "@/i18n/catalog.en";
import { fakeApi, json, problem } from "@/testing/fake-api";
import { renderApp } from "@/testing/render-app";
import { sharedRoutes } from "@/testing/transaction-api";

const base = { currency: "BRL", opened_on: "2026-01-01", yield_mode: "none" };
const accounts = [
  { ...base, id: "checking", name: "Itau", class: "asset", kind: "checking" },
  {
    ...base,
    id: "food",
    name: "Food",
    class: "expense",
    color: 2,
    icon: "utensils",
  },
  {
    ...base,
    id: "groceries",
    name: "Groceries",
    class: "expense",
    parent_id: "food",
  },
  { ...base, id: "fun", name: "Fun", class: "expense" },
  { ...base, id: "salary", name: "Salary", class: "income" },
  {
    ...base,
    id: "unc",
    name: "Uncategorized expense",
    class: "expense",
    system_role: "uncategorized_expense",
  },
];

const money = (amount: number) => ({ amount, currency: "BRL" });

interface Sent {
  route: string;
  body: unknown;
}

function api(
  sent: Sent[],
  queries: URLSearchParams[] = [],
  close = () => json(200, accounts[3]),
) {
  const record = (route: string) => async (req: Request) => {
    sent.push({ route, body: await req.json() });
    return json(200, accounts[1]);
  };
  return fakeApi({
    ...sharedRoutes,
    "GET /api/v1/accounts": () => json(200, { items: accounts }),
    "GET /api/v1/reports/categories": (req) => {
      const query = new URL(req.url).searchParams;
      queries.push(query);
      return json(200, {
        items: [
          {
            account_id: "food",
            total: money(5000),
            subtree_total: money(30000),
          },
          {
            account_id: "groceries",
            total: money(25000),
            subtree_total: money(25000),
          },
          {
            account_id: "fun",
            total: money(10000),
            subtree_total: money(10000),
          },
        ],
      });
    },
    "POST /api/v1/accounts": async (req) => {
      sent.push({ route: "create", body: await req.json() });
      return json(201, { ...base, id: "new", name: "Pets", class: "expense" });
    },
    "PATCH /api/v1/accounts/fun": record("rename"),
    "PUT /api/v1/accounts/fun/appearance": record("appearance"),
    "PUT /api/v1/accounts/fun/parent": record("parent"),
    "POST /api/v1/accounts/fun/merge": record("merge"),
    "POST /api/v1/accounts/fun/close": async (req) => {
      sent.push({ route: "close", body: await req.json() });
      return close();
    },
  });
}

function rowOf(name: string): HTMLElement {
  const row = screen
    .getByText(name, { selector: "span, p" })
    .closest('[role="row"]');
  if (!(row instanceof HTMLElement)) throw new Error(`no row for ${name}`);
  return row;
}

async function openMenu(name: string) {
  await userEvent.click(
    within(rowOf(name)).getByRole("button", { name: `Actions for ${name}` }),
  );
}

beforeEach(() => {
  localStorage.clear();
});

describe("CategoriesPage", () => {
  it("shows the tree of the month with totals and shares", async () => {
    const queries: URLSearchParams[] = [];
    await renderApp("/categories", {
      fetch: api([], queries),
      today: "2026-10-17",
    });
    await screen.findByText("Groceries", { selector: "span, p" });
    const food = rowOf("Food");
    expect(within(food).getByText("R$300.00")).toBeInTheDocument();
    expect(within(food).getByText("R$50.00")).toBeInTheDocument();
    expect(within(food).getByText("75%")).toBeInTheDocument();
    expect(within(rowOf("Fun")).getByText("25%")).toBeInTheDocument();
    expect(screen.queryByText("Salary")).toBeNull();
    expect(queries[0]?.toString()).toBe(
      "from=2026-10-01&to=2026-10-31&class=expense",
    );
  });

  it("switches to income categories", async () => {
    const queries: URLSearchParams[] = [];
    const { router } = await renderApp("/categories", {
      fetch: api([], queries),
    });
    await userEvent.click(
      await screen.findByRole("radio", {
        name: catalogEn["category.group.income"],
      }),
    );
    await waitFor(() => {
      expect(router.state.location.search).toEqual({ class: "income" });
    });
    expect(
      await screen.findByText("Salary", { selector: "span, p" }),
    ).toBeInTheDocument();
  });

  it("creates a category under another with its look", async () => {
    const sent: Sent[] = [];
    await renderApp("/categories", { fetch: api(sent) });
    await screen.findByText("Fun", { selector: "span, p" });
    await openMenu("Food");
    await userEvent.click(
      await screen.findByRole("menuitem", {
        name: catalogEn["category.addChild"],
      }),
    );
    const dialog = await screen.findByRole("dialog");
    await userEvent.type(
      within(dialog).getByRole("textbox", { name: catalogEn["category.name"] }),
      "Pets",
    );
    await userEvent.click(
      within(dialog).getByRole("radio", { name: "Colour 5" }),
    );
    await userEvent.click(within(dialog).getByRole("radio", { name: "dog" }));
    await userEvent.click(
      within(dialog).getByRole("button", {
        name: catalogEn["category.create.confirm"],
      }),
    );
    await waitFor(() => {
      expect(sent).toEqual([
        {
          route: "create",
          body: {
            name: "Pets",
            class: "expense",
            currency: "BRL",
            parent_id: "food",
            color: 5,
            icon: "dog",
          },
        },
      ]);
    });
  });

  it("renames and recolours a category with one request each", async () => {
    const sent: Sent[] = [];
    await renderApp("/categories", { fetch: api(sent) });
    await screen.findByText("Fun", { selector: "span, p" });
    await openMenu("Fun");
    await userEvent.click(
      await screen.findByRole("menuitem", { name: catalogEn["category.edit"] }),
    );
    const dialog = await screen.findByRole("dialog");
    const name = within(dialog).getByRole("textbox", {
      name: catalogEn["category.name"],
    });
    await userEvent.clear(name);
    await userEvent.type(name, "Leisure");
    await userEvent.click(
      within(dialog).getByRole("radio", { name: "Colour 3" }),
    );
    await userEvent.click(
      within(dialog).getByRole("button", { name: catalogEn["detail.save"] }),
    );
    await waitFor(() => {
      expect(sent).toEqual([
        { route: "rename", body: { name: "Leisure" } },
        { route: "appearance", body: { color: 3, icon: null } },
      ]);
    });
  });

  it("merges a category into another", async () => {
    const sent: Sent[] = [];
    await renderApp("/categories", { fetch: api(sent) });
    await screen.findByText("Fun", { selector: "span, p" });
    await openMenu("Fun");
    await userEvent.click(
      await screen.findByRole("menuitem", {
        name: catalogEn["category.merge"],
      }),
    );
    const dialog = await screen.findByRole("alertdialog");
    const picker = within(dialog).getByRole("combobox");
    await userEvent.type(picker, "Groc");
    await waitFor(() => {
      expect(within(dialog).getAllByRole("option").length).toBeGreaterThan(0);
    });
    await userEvent.keyboard("{ArrowDown}{Enter}");
    await userEvent.click(
      within(dialog).getByRole("button", { name: catalogEn["merge.confirm"] }),
    );
    await waitFor(() => {
      expect(sent).toEqual([{ route: "merge", body: { into: "groceries" } }]);
    });
  });

  it("archives from today and says why the server refused", async () => {
    const sent: Sent[] = [];
    await renderApp("/categories", {
      fetch: api(sent, [], () => problem(422, "system_account")),
      today: "2026-10-17",
    });
    await screen.findByText("Fun", { selector: "span, p" });
    await openMenu("Fun");
    await userEvent.click(
      await screen.findByRole("menuitem", {
        name: catalogEn["category.archive"],
      }),
    );
    const dialog = await screen.findByRole("alertdialog");
    await userEvent.click(
      within(dialog).getByRole("button", {
        name: catalogEn["category.archive"],
      }),
    );
    await waitFor(() => {
      expect(sent).toEqual([
        { route: "close", body: { closed_on: "2026-10-17" } },
      ]);
    });
    expect(
      (await screen.findAllByText(catalogEn["problem.system_account"])).length,
    ).toBeGreaterThan(0);
  });
});
