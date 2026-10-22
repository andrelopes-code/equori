import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { catalogEn } from "@/i18n/catalog.en";
import { formatDate, formatMoney, formatReferenceMonth } from "@/i18n/format";
import { fakeApi, json } from "@/testing/fake-api";
import { renderApp } from "@/testing/render-app";

const checking = {
  id: "0b9a6c1e-2f43-4d1a-9a55-7c1f0e3d2b10",
  name: "Checking",
  class: "asset",
  kind: "checking",
  currency: "BRL",
};

const card = {
  id: "5d1f3a20-9c1b-4e7a-8f00-2a6b4c8d9e01",
  name: "Visa",
  class: "liability",
  kind: "credit_card",
  currency: "BRL",
  card: {
    credit_limit: { amount: 500000, currency: "BRL" },
    available_limit: { amount: 300000, currency: "BRL" },
  },
};

const BRL = (amount: number) => ({ amount, currency: "BRL" });

function statement(reference: string, due: number, paid: number) {
  return {
    id: `s-${reference}`,
    account_id: card.id,
    reference,
    closing_date: `${reference}-03`,
    due_date: `${reference}-10`,
    opening: BRL(0),
    charges: BRL(due),
    credits: BRL(0),
    amount_due: BRL(due),
    payments: BRL(paid),
    unpaid: BRL(due - paid),
    status: paid >= due ? "paid" : "partially_paid",
    reconciled: false,
  };
}

function balance(basis: string, amount: number) {
  return {
    items: [
      {
        account_id: checking.id,
        date: "2026-10-17",
        basis,
        balance: { amount, currency: "BRL" },
      },
    ],
  };
}

function newFetch(
  posted: unknown[] = [],
  routes: Parameters<typeof fakeApi>[0] = {},
) {
  return fakeApi({
    "GET /api/v1/me": () => json(200, { id: 1, email: "owner@example.com" }),
    "GET /api/v1/accounts": () => json(200, { items: [checking, card] }),
    [`GET /api/v1/accounts/${card.id}/statements`]: () =>
      json(200, {
        items: [
          statement("2026-10", 150000, 50000),
          statement("2026-09", 7000, 7000),
        ],
      }),
    "GET /api/v1/commitments": () =>
      json(200, {
        month: "2026-10",
        installments: BRL(30000),
        occurrences: BRL(250000),
        total: BRL(280000),
      }),
    "GET /api/v1/instruments": () =>
      json(200, {
        items: [{ code: "BRL", type: "currency", scale: 2, name: "Real" }],
      }),
    "GET /api/v1/balances": (req) => {
      const url = new URL(req.url);
      expect(url.searchParams.get("date")).toBe("2026-10-17");
      return url.searchParams.get("basis") === "settled"
        ? json(200, balance("settled", 100000))
        : json(200, balance("booked", 123456));
    },
    "POST /api/v1/transactions": async (req) => {
      const body: unknown = await req.json();
      posted.push(body);
      return json(201, body);
    },
    "POST /api/v1/payees": async (req) => {
      const body: unknown = await req.json();
      posted.push(body);
      return json(201, { id: "p-1", name: "Bakery" });
    },
    ...routes,
  });
}

const food = {
  id: "7a0c1f2e-3b4d-4e5f-8a9b-0c1d2e3f4a50",
  name: "Food",
  class: "expense",
  currency: "BRL",
};

const groceries = {
  id: "7a0c1f2e-3b4d-4e5f-8a9b-0c1d2e3f4a51",
  name: "Groceries",
  class: "expense",
  currency: "BRL",
  parent_id: food.id,
};

const monthOfOctober = (req: Request) => {
  const url = new URL(req.url);
  expect(url.searchParams.get("from")).toBe("2026-10-01");
  expect(url.searchParams.get("to")).toBe("2026-10-31");
};

const categorizationRoutes: Parameters<typeof fakeApi>[0] = {
  "GET /api/v1/accounts": () =>
    json(200, { items: [checking, card, food, groceries] }),
  "GET /api/v1/categorization-statistics": (req) => {
    monthOfOctober(req);
    return json(200, {
      from: "2026-10-01",
      to: "2026-10-31",
      total: 40,
      rule: 20,
      source: 6,
      history: 4,
      manual: 2,
      uncategorized: 8,
    });
  },
  "GET /api/v1/reports/categories": (req) => {
    monthOfOctober(req);
    expect(new URL(req.url).searchParams.get("class")).toBe("expense");
    return json(200, {
      items: [
        { account_id: food.id, total: BRL(0), subtree_total: BRL(30000) },
        {
          account_id: groceries.id,
          total: BRL(30000),
          subtree_total: BRL(30000),
        },
      ],
    });
  },
  "GET /api/v1/rules": () =>
    json(200, {
      items: [
        {
          id: "r-2",
          name: "Disabled",
          priority: 2,
          enabled: false,
          stop_processing: false,
          conditions: [
            { field: "description", operator: "contains", value: "x" },
          ],
          actions: [{ type: "mark_reimbursable" }],
          categorized_count: 0,
        },
        {
          id: "r-1",
          name: "Market",
          priority: 1,
          enabled: true,
          stop_processing: true,
          conditions: [
            { field: "description", operator: "contains", value: "market" },
          ],
          actions: [{ type: "set_category", category_id: groceries.id }],
          categorized_count: 20,
          last_categorized_at: "2026-10-16T12:00:00Z",
        },
      ],
    }),
  "GET /api/v1/rule-suggestions": () =>
    json(200, {
      items: [
        {
          id: "s-1",
          state: "pending",
          conditions: [
            { field: "description", operator: "starts_with", value: "UBER" },
          ],
          actions: [{ type: "set_category", category_id: food.id }],
          example_transaction_ids: ["t-1", "t-2", "t-3"],
          created_at: "2026-10-15T09:00:00Z",
        },
      ],
    }),
  "GET /api/v1/source-categories": () =>
    json(200, {
      items: [
        {
          id: "c-1",
          provider: "pluggy",
          external_id: "05010000",
          name: "Supermarkets",
          count: 5,
          category_id: groceries.id,
        },
        {
          id: "c-2",
          provider: "pluggy",
          external_id: "06020000",
          name: "Food delivery",
          count: 12,
        },
      ],
    }),
  "GET /api/v1/payee-aliases": () => json(200, { items: [] }),
};

function tableRows(name: string): Promise<HTMLElement[]> {
  return screen
    .findByRole("table", { name })
    .then((table) => within(table).getAllByRole("row").slice(1));
}

const money = (amount: number) => formatMoney(BRL(amount), 2, "en");

async function statCard(label: string): Promise<HTMLElement> {
  const tiles = (await screen.findAllByText(label))
    .map((element) => element.closest('[data-ui="stat-card"]'))
    .filter((tile) => tile instanceof HTMLElement);
  const [tile] = tiles;
  if (tiles.length !== 1 || tile === undefined) {
    throw new Error(`${String(tiles.length)} stat cards ${label}`);
  }
  return tile;
}

function breakdownItem(term: string): HTMLElement {
  const item = screen.getByText(term).closest('[data-part="item"]');
  if (!(item instanceof HTMLElement)) throw new Error(`no item ${term}`);
  return item;
}

async function chooseOperation(
  user: ReturnType<typeof userEvent.setup>,
  name: RegExp,
) {
  await user.click(
    await screen.findByRole("combobox", { name: catalogEn["admin.op.choose"] }),
  );
  await user.click(await screen.findByRole("option", { name }));
}

describe("AdminPage", () => {
  it("opens on the overview with the month's statement totals and commitments", async () => {
    await renderApp("/admin", { fetch: newFetch() });
    const due = await screen.findByText(
      catalogEn["admin.overview.due"].replace("{month}", "2026-10"),
    );
    const tile = due.closest('[data-ui="stat-card"]');
    if (!(tile instanceof HTMLElement)) throw new Error("no tile");
    expect(within(tile).getByText("1500.00 BRL")).toBeInTheDocument();
    const byMonth = screen.getByRole("table", {
      name: catalogEn["admin.overview.byMonth"],
    });
    expect(
      within(byMonth).getByRole("row", { name: /2026-09/ }),
    ).toHaveTextContent("70.00 BRL");
    expect(await screen.findByText("2800.00 BRL")).toBeInTheDocument();
  });

  it("opens with each card's statement of the month, its status and due date", async () => {
    await renderApp("/admin", { fetch: newFetch() });
    const tile = await statCard("Visa");
    expect(await within(tile).findByText(money(150000))).toBeInTheDocument();
    expect(within(tile).getByText("Partially paid")).toBeInTheDocument();
    expect(
      within(tile).getByText(
        `Closes ${formatDate("2026-10-03", "en")} · due ${formatDate("2026-10-10", "en")}`,
      ),
    ).toBeInTheDocument();
    expect(
      within(
        await statCard(`Net worth on ${formatDate("2026-10-17", "en")}`),
      ).getByText(money(123456)),
    ).toBeInTheDocument();
  });

  it("leads the cards tab with the month's statement, its dates and composition", async () => {
    const user = userEvent.setup();
    await renderApp("/admin", { fetch: newFetch() });
    await user.click(
      await screen.findByRole("tab", { name: catalogEn["admin.tab.cards"] }),
    );
    const amount = await statCard(
      `Statement due in ${formatReferenceMonth("2026-10", "en")}`,
    );
    expect(within(amount).getByText(money(150000))).toBeInTheDocument();
    expect(within(amount).getByText("Partially paid")).toBeInTheDocument();
    expect(
      within(await statCard("Closing date")).getByText(
        formatDate("2026-10-03", "en"),
      ),
    ).toBeInTheDocument();
    expect(
      within(await statCard("Due date")).getByText(
        formatDate("2026-10-10", "en"),
      ),
    ).toBeInTheDocument();
    expect(
      within(await statCard("Unpaid")).getByText(money(100000)),
    ).toBeInTheDocument();
    expect(
      within(await statCard("Available limit")).getByText(money(300000)),
    ).toBeInTheDocument();
    expect(breakdownItem("Opening balance")).toHaveTextContent(money(0));
    expect(breakdownItem("Charges")).toHaveTextContent(money(150000));
    expect(breakdownItem("Amount due")).toHaveTextContent(money(150000));
    expect(breakdownItem("Payments")).toHaveTextContent(money(50000));
  });

  it("shows another month's statement when the month changes", async () => {
    const user = userEvent.setup();
    await renderApp("/admin", { fetch: newFetch() });
    await user.click(
      await screen.findByRole("tab", { name: catalogEn["admin.tab.cards"] }),
    );
    // The month picker's trigger carries the chosen month in its name.
    await user.click(
      await screen.findByRole("button", { name: /October 2026$/ }),
    );
    await user.click(
      within(await screen.findByRole("dialog")).getByRole("button", {
        name: "September 2026",
      }),
    );
    const amount = await statCard(
      `Statement due in ${formatReferenceMonth("2026-09", "en")}`,
    );
    expect(within(amount).getByText(money(7000))).toBeInTheDocument();
    expect(within(amount).getByText("Paid")).toBeInTheDocument();
  });

  it("leads the accounts tab with each account's balance", async () => {
    const user = userEvent.setup();
    await renderApp("/admin", { fetch: newFetch() });
    await user.click(
      await screen.findByRole("tab", { name: catalogEn["admin.tab.accounts"] }),
    );
    const tile = await statCard("Checking");
    expect(within(tile).getByText(money(123456))).toBeInTheDocument();
    expect(
      within(tile).getByText(`Settled ${money(100000)}`),
    ).toBeInTheDocument();
  });

  it("lists every account with its booked and settled balance", async () => {
    const user = userEvent.setup();
    await renderApp("/admin", { fetch: newFetch() });
    await user.click(
      await screen.findByRole("tab", { name: catalogEn["admin.tab.accounts"] }),
    );
    const table = await screen.findByRole("table", {
      name: catalogEn["admin.accounts.table"],
    });
    const row = await within(table).findByRole("row", { name: /Checking/ });
    expect(within(row).getByText("1234.56 BRL")).toBeInTheDocument();
    expect(within(row).getByText("1000.00 BRL")).toBeInTheDocument();
  });

  it("leads the categorization tab with the month's coverage and what is left to decide", async () => {
    const user = userEvent.setup();
    await renderApp("/admin", { fetch: newFetch([], categorizationRoutes) });
    await user.click(
      await screen.findByRole("tab", {
        name: catalogEn["admin.tab.categorization"],
      }),
    );
    const coverage = await statCard(
      `Categorized in ${formatReferenceMonth("2026-10", "en")}`,
    );
    expect(within(coverage).getByText("80%")).toBeInTheDocument();
    expect(
      within(coverage).getByText("32 of 40 transactions"),
    ).toBeInTheDocument();
    expect(
      within(await statCard("Uncategorized")).getByText("8"),
    ).toBeInTheDocument();
    const rules = await statCard("Enabled rules");
    expect(within(rules).getByText("1")).toBeInTheDocument();
    expect(within(rules).getByText("2 rules in all")).toBeInTheDocument();
    expect(
      within(await statCard("Pending rule suggestions")).getByText("1"),
    ).toBeInTheDocument();
    const unmapped = await statCard("Unmapped institution categories");
    expect(within(unmapped).getByText("1")).toBeInTheDocument();
    expect(within(unmapped).getByText("12 transactions")).toBeInTheDocument();
  });

  it("writes the rules, the suggestions and the category totals in words", async () => {
    const user = userEvent.setup();
    await renderApp("/admin", { fetch: newFetch([], categorizationRoutes) });
    await user.click(
      await screen.findByRole("tab", {
        name: catalogEn["admin.tab.categorization"],
      }),
    );
    const [market, disabled] = await tableRows("Rules in priority order");
    expect(market).toHaveTextContent('description contains "market"');
    expect(market).toHaveTextContent("set_category Groceries");
    expect(disabled).toHaveTextContent("Disabled");
    const [suggestion] = await tableRows(
      "Rule suggestions waiting for a decision",
    );
    expect(suggestion).toHaveTextContent('description starts_with "UBER"');
    expect(suggestion).toHaveTextContent("set_category Food");
    const [delivery, supermarkets] = await tableRows(
      "Institution categories, unmapped first",
    );
    expect(delivery).toHaveTextContent("Food delivery");
    expect(delivery).toHaveTextContent("None");
    expect(supermarkets).toHaveTextContent("Food › Groceries");
    const [, groceryRow] = await tableRows(
      "Each category's own total and the total of its subtree",
    );
    expect(groceryRow).toHaveTextContent("Food › Groceries");
    expect(groceryRow).toHaveTextContent("300.00 BRL");
  });

  it("sends an operation's body and shows the response", async () => {
    const posted: unknown[] = [];
    const user = userEvent.setup();
    await renderApp("/admin", { fetch: newFetch(posted) });
    await user.click(
      await screen.findByRole("tab", { name: catalogEn["admin.tab.registry"] }),
    );
    await chooseOperation(user, /createPayee/);
    const form = screen.getByRole("form", { name: /createPayee/ });
    const name = within(form).getByRole("textbox", { name: "name" });
    await user.clear(name);
    await user.type(name, "Bakery");
    await user.click(
      within(form).getByRole("button", { name: catalogEn["admin.op.send"] }),
    );
    await waitFor(() => {
      expect(posted).toEqual([{ name: "Bakery" }]);
    });
    expect(await within(form).findByText(/^201/)).toBeInTheDocument();
  });

  it("sends a decimal amount in minor units and drops empty fields", async () => {
    const posted: unknown[] = [];
    const user = userEvent.setup();
    await renderApp("/admin", { fetch: newFetch(posted) });
    await user.click(
      await screen.findByRole("tab", {
        name: catalogEn["admin.tab.transactions"],
      }),
    );
    await chooseOperation(user, / createTransaction$/);
    const form = screen.getByRole("form", { name: / createTransaction$/ });
    const [amount] = within(form).getAllByRole("textbox", { name: "amount" });
    if (amount === undefined) throw new Error("no amount field");
    await user.clear(amount);
    await user.type(amount, "12.34");
    await user.click(
      within(form).getByRole("button", { name: catalogEn["admin.op.send"] }),
    );
    await waitFor(() => {
      expect(posted).toHaveLength(1);
    });
    expect(posted[0]).toEqual({
      date: "2026-10-17",
      description: "Groceries",
      tags: [],
      postings: [
        { amount: { amount: 1234, currency: "BRL" } },
        {
          account_id: checking.id,
          amount: { amount: -5000, currency: "BRL" },
          status: "cleared",
        },
      ],
    });
  });
});
