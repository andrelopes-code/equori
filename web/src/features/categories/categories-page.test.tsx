import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { catalogEn } from "@/i18n/catalog.en";
import { fakeApi, json, problem } from "@/testing/fake-api";
import { moneyValue } from "@/testing/money-value";
import { renderApp } from "@/testing/render-app";
import { sharedRoutes } from "@/testing/transaction-api";

// Records the categories whose row menu renders, so a test can tell a row's render from none.
const menus = vi.hoisted(() => ({ rendered: new Set<string>() }));
vi.mock("@/features/categories/category-row-menu", async (importOriginal) => {
  const actual =
    await importOriginal<
      typeof import("@/features/categories/category-row-menu")
    >();
  return {
    ...actual,
    CategoryRowMenu: (props: Parameters<typeof actual.CategoryRowMenu>[0]) => {
      menus.rendered.add(props.entry.name);
      return actual.CategoryRowMenu(props);
    },
  };
});

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
  extraTotals: {
    account_id: string;
    total: unknown;
    subtree_total: unknown;
  }[] = [],
  // The totals a month answers instead of the default ones, by the month's first day.
  byMonth: Record<string, unknown[]> = {},
  // The totals of the income class, which the server answers positive: earnings count as earned.
  income?: unknown[],
  settings: () => Response | Promise<Response> = () =>
    json(200, { base_currency: "BRL" }),
) {
  const record = (route: string) => async (req: Request) => {
    sent.push({ route, body: await req.json() });
    return json(200, accounts[1]);
  };
  return fakeApi({
    ...sharedRoutes,
    "GET /api/v1/settings": settings,
    "GET /api/v1/instruments": () =>
      json(200, {
        items: [
          { code: "BRL", type: "currency", scale: 2, name: "Real" },
          { code: "EUR", type: "currency", scale: 2, name: "Euro" },
        ],
      }),
    "GET /api/v1/accounts": () => json(200, { items: accounts }),
    "GET /api/v1/reports/categories": (req) => {
      const query = new URL(req.url).searchParams;
      queries.push(query);
      if (income !== undefined && query.get("class") === "income") {
        return json(200, { items: income });
      }
      const other = byMonth[query.get("from") ?? ""];
      if (other !== undefined) return json(200, { items: other });
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
          ...extraTotals,
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

// The largest-group card repeats a category's name, so a row is looked up inside the tree.
function rowOf(name: string): HTMLElement {
  const grid = document.querySelector('[data-ui="data-grid"]');
  if (!(grid instanceof HTMLElement)) throw new Error("no tree");
  const row = within(grid)
    .getByText(name, { selector: "span, p" })
    .closest('[role="row"]');
  if (!(row instanceof HTMLElement)) throw new Error(`no row for ${name}`);
  return row;
}

// The charts' legends repeat the names of groups and of the held spending, so a card is the
// stat-card among the elements that carry its label.
async function figureCard(label: string): Promise<HTMLElement> {
  const card = (await screen.findAllByText(label))
    .map((el) => el.closest('[data-ui="stat-card"]'))
    .find((el) => el instanceof HTMLElement);
  if (card === undefined) throw new Error(`no card for ${label}`);
  return card;
}

async function findRow(name: string): Promise<HTMLElement> {
  return waitFor(() => rowOf(name));
}

async function chartOf(title: string): Promise<HTMLElement> {
  const chart = (await screen.findByText(title)).closest('[data-ui="chart"]');
  if (!(chart instanceof HTMLElement)) throw new Error(`no chart ${title}`);
  return chart;
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
  it("draws its waiting state and no amount while the settings are pending", async () => {
    await renderApp("/categories", {
      fetch: api(
        [],
        [],
        undefined,
        [],
        {},
        undefined,
        () => new Promise<Response>(() => undefined),
      ),
      today: "2026-10-17",
    });
    await waitFor(() => {
      expect(document.querySelector('[aria-busy="true"]')).not.toBeNull();
    });
    expect(screen.queryByText(/R\$|€/u)).toBeNull();
  });

  it("writes the amounts in the base currency of the settings", async () => {
    await renderApp("/categories", {
      fetch: api([], [], undefined, [], {}, undefined, () =>
        json(200, { base_currency: "EUR" }),
      ),
      today: "2026-10-17",
    });
    await screen.findByText("Groceries", { selector: "span, p" });
    expect(within(rowOf("Food")).getByText("€300.00")).toBeInTheDocument();
    expect(screen.queryByText(/R\$/u)).toBeNull();
  });

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
    expect(
      queries.find((q) => q.get("from") === "2026-10-01")?.toString(),
    ).toBe("from=2026-10-01&to=2026-10-31&class=expense");
  });

  // Owner review 2026-10-22: a render of the page, such as a dialog opening, rendered every row.
  it("renders no row of the tree when a dialog opens over it", async () => {
    await renderApp("/categories", { fetch: api([]), today: "2026-10-17" });
    await screen.findByText("Groceries", { selector: "span, p" });
    menus.rendered.clear();
    await userEvent.click(
      screen.getByRole("button", { name: catalogEn["category.new"] }),
    );
    await screen.findByRole("dialog");
    expect([...menus.rendered]).toEqual([]);
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

  it("keeps what no category decided yet out of the tree and names it in a card", async () => {
    const { router } = await renderApp("/categories", {
      fetch: api([], [], undefined, [
        { account_id: "unc", total: money(8000), subtree_total: money(8000) },
      ]),
      today: "2026-10-17",
    });
    await screen.findByText("Groceries", { selector: "span, p" });
    expect(
      screen.queryByText(catalogEn["system.uncategorized_expense"], {
        selector: "span, p",
      }),
    ).toBeNull();
    // The held spending still counts in the class total: 30000 of 48000 and 10000 of 48000.
    expect(within(rowOf("Food")).getByText("62.5%")).toBeInTheDocument();
    expect(within(rowOf("Fun")).getByText("20.8%")).toBeInTheDocument();
    const card = await figureCard(catalogEn["category.pending"]);
    expect(within(card).getByText(moneyValue("R$80.00"))).toBeInTheDocument();
    expect(
      within(card).getByText("16.7% of the month's spending"),
    ).toBeInTheDocument();
    await userEvent.click(
      within(card).getByRole("link", { name: catalogEn["coverage.review"] }),
    );
    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/transactions");
    });
    expect(router.state.location.search).toMatchObject({
      uncategorized: true,
      from: "2026-10-01",
      to: "2026-10-31",
    });
  });

  it("draws no pending card when nothing waits for a category", async () => {
    await renderApp("/categories", { fetch: api([]), today: "2026-10-17" });
    await screen.findByText("Groceries", { selector: "span, p" });
    expect(screen.queryByText(catalogEn["category.pending"])).toBeNull();
  });

  it("refetches the month when the refresh button is pressed", async () => {
    const queries: URLSearchParams[] = [];
    await renderApp("/categories", {
      fetch: api([], queries),
      today: "2026-10-17",
    });
    await screen.findByText("Groceries", { selector: "span, p" });
    const ofMonth = () => queries.filter((q) => q.get("from") === "2026-10-01");
    expect(ofMonth()).toHaveLength(1);
    await userEvent.click(
      screen.getByRole("button", { name: catalogEn["category.refresh"] }),
    );
    await waitFor(() => {
      expect(ofMonth()).toHaveLength(2);
    });
  });

  it("sums the month against the same days of the month before", async () => {
    const queries: URLSearchParams[] = [];
    await renderApp("/categories", {
      fetch: api([], queries, undefined, [], {
        "2026-09-01": [
          {
            account_id: "food",
            total: money(20000),
            subtree_total: money(20000),
          },
          {
            account_id: "fun",
            total: money(10000),
            subtree_total: money(10000),
          },
        ],
      }),
      today: "2026-10-17",
    });
    const card = await figureCard(catalogEn["category.kpi.spent"]);
    expect(within(card).getByText(moneyValue("R$400.00"))).toBeInTheDocument();
    expect(within(card).getByText("+33.3%")).toBeInTheDocument();
    expect(
      within(card).getByText("R$300.00 in september, up to day 17"),
    ).toBeInTheDocument();
    expect(
      queries.some(
        (q) => q.get("from") === "2026-09-01" && q.get("to") === "2026-09-17",
      ),
    ).toBe(true);
  });

  it("sums a finished month against the whole month before", async () => {
    await renderApp("/categories?month=2026-09", {
      fetch: api([], [], undefined, [], {
        "2026-08-01": [
          {
            account_id: "food",
            total: money(50000),
            subtree_total: money(50000),
          },
        ],
      }),
      today: "2026-10-17",
    });
    const card = await figureCard(catalogEn["category.kpi.spent"]);
    expect(within(card).getByText(moneyValue("R$400.00"))).toBeInTheDocument();
    expect(within(card).getByText("-20%")).toBeInTheDocument();
    expect(within(card).getByText("R$500.00 in august")).toBeInTheDocument();
  });

  it("says so when the month before recorded nothing", async () => {
    await renderApp("/categories", {
      fetch: api([], [], undefined, [], { "2026-09-01": [] }),
      today: "2026-10-17",
    });
    const card = await figureCard(catalogEn["category.kpi.spent"]);
    expect(within(card).getByText(moneyValue("R$400.00"))).toBeInTheDocument();
    expect(
      within(card).getByText("Nothing recorded in september"),
    ).toBeInTheDocument();
    expect(card.querySelector('[data-part="delta"]')).toBeNull();
  });

  it("projects the month at the pace of the days gone by", async () => {
    await renderApp("/categories", { fetch: api([]), today: "2026-10-17" });
    const card = await figureCard(catalogEn["category.kpi.projection"]);
    expect(within(card).getByText(moneyValue("R$729.41"))).toBeInTheDocument();
    expect(
      within(card).getByText("R$23.53 per day so far"),
    ).toBeInTheDocument();
  });

  it("projects nothing for a finished month or for income", async () => {
    const { router } = await renderApp("/categories?month=2026-09", {
      fetch: api([]),
      today: "2026-10-17",
    });
    await figureCard(catalogEn["category.kpi.spent"]);
    expect(screen.queryByText(catalogEn["category.kpi.projection"])).toBeNull();
    await router.navigate({
      to: "/categories",
      search: { class: "income" },
    });
    await screen.findByText(catalogEn["category.kpi.earned"]);
    expect(screen.queryByText(catalogEn["category.kpi.projection"])).toBeNull();
  });

  it("names the group that rose most since the same days of the month before", async () => {
    await renderApp("/categories", {
      fetch: api([], [], undefined, [], {
        "2026-09-01": [
          {
            account_id: "food",
            total: money(25000),
            subtree_total: money(25000),
          },
          {
            account_id: "fun",
            total: money(2000),
            subtree_total: money(2000),
          },
        ],
      }),
      today: "2026-10-17",
    });
    const card = await figureCard(catalogEn["category.kpi.rise"]);
    expect(within(card).getByText("Fun")).toBeInTheDocument();
    expect(
      within(card).getByText("R$80.00 more than in september"),
    ).toBeInTheDocument();
  });

  it("says nothing rose when every group is at or below the month before", async () => {
    await renderApp("/categories", {
      fetch: api([], [], undefined, [], {
        "2026-09-01": [
          {
            account_id: "food",
            total: money(90000),
            subtree_total: money(90000),
          },
          {
            account_id: "fun",
            total: money(90000),
            subtree_total: money(90000),
          },
        ],
      }),
      today: "2026-10-17",
    });
    const card = await figureCard(catalogEn["category.kpi.rise"]);
    expect(
      within(card).getByText("Nothing rose from september"),
    ).toBeInTheDocument();
    expect(within(card).queryByText("Fun")).toBeNull();
  });

  it("reads the last six months for the trend and names both charts", async () => {
    const queries: URLSearchParams[] = [];
    await renderApp("/categories", {
      fetch: api([], queries),
      today: "2026-10-17",
    });
    const trend = await chartOf(catalogEn["category.chart.trend"]);
    const composition = await chartOf(catalogEn["category.chart.composition"]);
    expect(within(trend).getAllByText("Food").length).toBeGreaterThan(0);
    expect(within(trend).getAllByText("Fun").length).toBeGreaterThan(0);
    // Analytics design 7: the composition ranks the groups as bars, each label with its share.
    expect(composition.textContent).toContain(
      "from Food · 75.00% to Fun · 25.00%",
    );
    const froms = new Set(queries.map((q) => q.get("from")));
    for (const month of [
      "2026-05",
      "2026-06",
      "2026-07",
      "2026-08",
      "2026-09",
      "2026-10",
    ]) {
      expect(froms.has(`${month}-01`)).toBe(true);
    }
    expect(froms.has("2026-04-01")).toBe(false);
  });

  it("reads income totals as the server sends them, positive", async () => {
    await renderApp("/categories?class=income", {
      fetch: api([], [], undefined, [], {}, [
        {
          account_id: "salary",
          total: money(200000),
          subtree_total: money(200000),
        },
      ]),
      today: "2026-10-17",
    });
    const card = await figureCard(catalogEn["category.kpi.earned"]);
    expect(
      within(card).getByText(moneyValue("R$2,000.00")),
    ).toBeInTheDocument();
    const row = await findRow("Salary");
    expect(within(row).getAllByText("R$2,000.00")).toHaveLength(2);
    expect(within(row).getByText("100%")).toBeInTheDocument();
  });

  it("reads income figures as earned", async () => {
    await renderApp("/categories?class=income", {
      fetch: api([]),
      today: "2026-10-17",
    });
    expect(
      await screen.findByText(catalogEn["category.kpi.earned"]),
    ).toBeInTheDocument();
    expect(screen.queryByText(catalogEn["category.kpi.spent"])).toBeNull();
  });

  it("creates a category under another with its look", async () => {
    const sent: Sent[] = [];
    await renderApp("/categories", { fetch: api(sent) });
    await findRow("Fun");
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
    await findRow("Fun");
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
    await findRow("Fun");
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
    await findRow("Fun");
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
