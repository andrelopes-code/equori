import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { catalogEn } from "@/i18n/catalog.en";
import { fakeApi, json } from "@/testing/fake-api";
import { renderApp } from "@/testing/render-app";
import { sharedRoutes } from "@/testing/transaction-api";

const base = { currency: "BRL", opened_on: "2026-01-01", yield_mode: "none" };
const accounts = [
  { ...base, id: "food", name: "Food", class: "expense" },
  {
    ...base,
    id: "groceries",
    name: "Groceries",
    class: "expense",
    parent_id: "food",
  },
  { ...base, id: "fun", name: "Fun", class: "expense" },
  { ...base, id: "salary", name: "Salary", class: "income" },
];
const method = {
  buckets: [
    {
      id: "needs",
      name: "Needs",
      share_bp: 6000,
      takes_savings: false,
      takes_goals: false,
      at_least: false,
      category_ids: ["food"],
    },
    {
      id: "wants",
      name: "Wants",
      share_bp: 4000,
      takes_savings: false,
      takes_goals: false,
      at_least: false,
      category_ids: [],
    },
  ],
};

function api(sent: unknown[]) {
  return fakeApi({
    ...sharedRoutes,
    "GET /api/v1/settings": () => json(200, { base_currency: "BRL" }),
    "GET /api/v1/instruments": () =>
      json(200, {
        items: [{ code: "BRL", type: "currency", scale: 2, name: "Real" }],
      }),
    "GET /api/v1/accounts": () => json(200, { items: accounts }),
    // A category without activity hides from the tree.
    "GET /api/v1/reports/categories": () =>
      json(200, {
        items: ["food", "groceries", "fun"].map((id) => ({
          account_id: id,
          total: { amount: 1000, currency: "BRL" },
          subtree_total: { amount: 1000, currency: "BRL" },
        })),
      }),
    "GET /api/v1/budget-buckets": () => json(200, method),
    "PUT /api/v1/budget-buckets": async (req) => {
      sent.push(await req.json());
      return new Response(null, { status: 204 });
    },
    "POST /api/v1/accounts": () =>
      json(201, { ...base, id: "pets", name: "Pets", class: "expense" }),
  });
}

describe("Categories under an income split", () => {
  // Income buckets spec 5: the bucket of each expense category, own or from its parent.
  it("shows the bucket each expense category draws from", async () => {
    await renderApp("/categories", { fetch: api([]) });

    expect(await screen.findByText("Needs")).toBeVisible();
    expect(
      screen.getByText(
        catalogEn["buckets.inherited"].replace("{name}", "Needs"),
      ),
    ).toBeVisible();
    expect(screen.getByText(catalogEn["buckets.outside"])).toBeVisible();
  });

  it("places a new category in the bucket chosen in its form", async () => {
    const sent: unknown[] = [];
    await renderApp("/categories", { fetch: api(sent) });
    await screen.findByText("Needs");
    await userEvent.click(
      screen.getByRole("button", { name: catalogEn["category.new"] }),
    );
    const dialog = await screen.findByRole("dialog");
    await userEvent.type(
      within(dialog).getByRole("textbox", { name: catalogEn["category.name"] }),
      "Pets",
    );

    await userEvent.click(
      within(dialog).getByRole("combobox", {
        name: catalogEn["buckets.field.bucket"],
      }),
    );
    await userEvent.click(await screen.findByRole("option", { name: "Wants" }));
    await userEvent.click(
      within(dialog).getByRole("button", {
        name: catalogEn["category.create.confirm"],
      }),
    );

    await waitFor(() => {
      expect(sent).toEqual([
        {
          buckets: [
            {
              name: "Needs",
              share_bp: 6000,
              takes_savings: false,
              takes_goals: false,
              at_least: false,
              category_ids: ["food"],
            },
            {
              name: "Wants",
              share_bp: 4000,
              takes_savings: false,
              takes_goals: false,
              at_least: false,
              category_ids: ["pets"],
            },
          ],
        },
      ]);
    });
  });

  it("asks before removing the split", async () => {
    const sent: unknown[] = [];
    await renderApp("/categories", { fetch: api(sent) });
    await screen.findByText("Needs");
    await userEvent.click(
      screen.getByRole("button", { name: catalogEn["buckets.manage"] }),
    );
    const dialog = await screen.findByRole("dialog");
    // Fun has no bucket: the last entry of the bucket list counts it.
    const unplaced = within(dialog).getByRole("button", {
      name: new RegExp(`^${catalogEn["buckets.unplaced"]}`),
    });
    expect(unplaced).toHaveTextContent(catalogEn["buckets.count.one"]);

    await userEvent.click(
      within(dialog).getByRole("button", {
        name: catalogEn["buckets.removeAll"],
      }),
    );

    expect(sent).toEqual([]);
    expect(
      within(dialog).getByText(catalogEn["buckets.removeConfirm"]),
    ).toBeVisible();

    const confirm = within(dialog).getAllByRole("button", {
      name: catalogEn["buckets.removeAll"],
    })[0];
    if (confirm === undefined) throw new Error("no confirm button");
    await userEvent.click(confirm);

    await waitFor(() => {
      expect(sent).toEqual([{ buckets: [] }]);
    });
  });

  it("checks what goes in the chosen bucket", async () => {
    const sent: unknown[] = [];
    await renderApp("/categories", { fetch: api(sent) });
    await screen.findByText("Needs");
    await userEvent.click(
      screen.getByRole("button", { name: catalogEn["buckets.manage"] }),
    );
    const dialog = await screen.findByRole("dialog");

    // Needs is chosen first: Groceries follows Food and stays fixed while Food is in it.
    const groceries = within(dialog).getByRole("checkbox", {
      name: "Groceries",
    });
    expect(groceries).toBeChecked();
    expect(groceries).toBeDisabled();
    expect(
      within(dialog).getByText(
        catalogEn["buckets.follows"].replace("{name}", "Food"),
      ),
    ).toBeVisible();

    await userEvent.click(
      within(dialog).getByRole("button", { name: /^Wants/ }),
    );
    await userEvent.click(
      within(dialog).getByRole("checkbox", { name: "Fun" }),
    );
    await userEvent.click(
      within(dialog).getByRole("button", { name: catalogEn["buckets.save"] }),
    );

    await waitFor(() => {
      expect(sent).toEqual([
        {
          buckets: [
            {
              name: "Needs",
              share_bp: 6000,
              takes_savings: false,
              takes_goals: false,
              at_least: false,
              category_ids: ["food"],
            },
            {
              name: "Wants",
              share_bp: 4000,
              takes_savings: false,
              takes_goals: false,
              at_least: false,
              category_ids: ["fun"],
            },
          ],
        },
      ]);
    });
  });
});
