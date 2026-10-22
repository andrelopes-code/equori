import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { catalogEn } from "@/i18n/catalog.en";
import { fakeApi, json } from "@/testing/fake-api";
import { renderApp } from "@/testing/render-app";
import { sharedRoutes } from "@/testing/transaction-api";

// Records the rules whose row menu renders, so a test can tell a row's render from none.
const menus = vi.hoisted(() => ({ rendered: new Set<string>() }));
vi.mock("@/features/categories/rule-actions", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/features/categories/rule-actions")>();
  return {
    RuleActions: (props: Parameters<typeof actual.RuleActions>[0]) => {
      menus.rendered.add(props.rule.name);
      return actual.RuleActions(props);
    },
  };
});

const base = { currency: "BRL", opened_on: "2026-01-01", yield_mode: "none" };
const accounts = [
  { ...base, id: "ride", name: "Ride-hailing", class: "expense" },
  { ...base, id: "food", name: "Food", class: "expense" },
];

const uber = {
  id: "r1",
  name: "Uber",
  priority: 1,
  enabled: true,
  stop_processing: false,
  categorized_count: 12,
  last_categorized_at: "2026-10-15T12:00:00Z",
  conditions: [{ field: "description", operator: "contains", value: "uber" }],
  actions: [{ type: "set_category", category_id: "ride" }],
};
const market = {
  ...uber,
  id: "r2",
  name: "Market",
  priority: 2,
  categorized_count: 0,
  last_categorized_at: undefined,
  conditions: [{ field: "description", operator: "starts_with", value: "pao" }],
  actions: [{ type: "set_category", category_id: "food" }],
};

interface Sent {
  route: string;
  body: unknown;
}

function api(sent: Sent[]) {
  const record = (route: string, answer: unknown) => async (req: Request) => {
    const text = await req.text();
    sent.push({ route, body: text === "" ? null : JSON.parse(text) });
    return json(200, answer);
  };
  return fakeApi({
    ...sharedRoutes,
    "GET /api/v1/accounts": () => json(200, { items: accounts }),
    "GET /api/v1/rules": () => json(200, { items: [uber, market] }),
    "GET /api/v1/rule-suggestions": () =>
      json(200, {
        items: [
          {
            id: "s1",
            state: "pending",
            conditions: [
              { field: "description", operator: "contains", value: "padaria" },
            ],
            actions: [{ type: "set_category", category_id: "food" }],
            example_transaction_ids: ["a", "b"],
            created_at: "2026-10-16T12:00:00Z",
          },
        ],
      }),
    "GET /api/v1/categorization-statistics": () =>
      json(200, {
        from: "2026-10-01",
        to: "2026-10-17",
        total: 20,
        rule: 12,
        history: 2,
        source: 1,
        manual: 4,
        uncategorized: 1,
      }),
    "GET /api/v1/source-categories": () =>
      json(200, {
        items: [
          {
            id: "sc1",
            aggregator: "pluggy",
            external_id: "x",
            name: "Transporte",
            count: 7,
          },
        ],
      }),
    "PUT /api/v1/rules/r2": record("replace", market),
    "POST /api/v1/rules/reorder": record("reorder", { items: [market, uber] }),
    "POST /api/v1/rules/run": record("run", { examined: 9, categorized: 4 }),
    "POST /api/v1/rule-suggestions/s1/accept": record("accept", uber),
    "PUT /api/v1/source-categories/sc1": record("map", {}),
  });
}

function rowOf(name: string): HTMLElement {
  const row = screen.getByRole("rowheader", { name }).closest('[role="row"]');
  if (!(row instanceof HTMLElement)) throw new Error(`no row for ${name}`);
  return row;
}

beforeEach(() => {
  localStorage.clear();
});

describe("RulesPage", () => {
  it("lists the rules in order, read as sentences, with the month's coverage", async () => {
    await renderApp("/categories/rules", { fetch: api([]) });
    const uberRow = rowOf(
      await screen.findByRole("rowheader", { name: "Uber" }).then(() => "Uber"),
    );
    expect(
      within(uberRow).getByText(
        "When description contains “uber” → categorize as Ride-hailing",
      ),
    ).toBeInTheDocument();
    expect(within(uberRow).getByText("12 categorized")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Rules (1)" })).toBeInTheDocument();
    expect(await screen.findByText("75%")).toBeInTheDocument();
  });

  // Owner review 2026-10-22: a render of the page, such as a dialog opening, rendered every row.
  it("renders no row of the list when the delete dialog opens over it", async () => {
    await renderApp("/categories/rules", { fetch: api([]) });
    await userEvent.click(
      await screen.findByRole("button", {
        name: catalogEn["rules.actions"].replace("{name}", "Uber"),
      }),
    );
    const remove = await screen.findByRole("menuitem", {
      name: catalogEn["rules.delete"],
    });
    menus.rendered.clear();
    await userEvent.click(remove);
    await screen.findByRole("alertdialog");
    expect([...menus.rendered]).toEqual([]);
  });

  it("switches a rule off with the whole rule", async () => {
    const sent: Sent[] = [];
    await renderApp("/categories/rules", { fetch: api(sent) });
    await userEvent.click(
      await screen.findByRole("switch", { name: "Rule Market on" }),
    );
    await waitFor(() => {
      expect(sent).toEqual([
        {
          route: "replace",
          body: {
            name: "Market",
            enabled: false,
            stop_processing: false,
            conditions: market.conditions,
            actions: market.actions,
          },
        },
      ]);
    });
  });

  it("moves a rule to the top", async () => {
    const sent: Sent[] = [];
    await renderApp("/categories/rules", { fetch: api(sent) });
    await userEvent.click(
      await screen.findByRole("button", { name: "Actions for rule Market" }),
    );
    await userEvent.click(
      await screen.findByRole("menuitem", { name: catalogEn["rules.moveTop"] }),
    );
    await waitFor(() => {
      expect(sent).toEqual([
        { route: "reorder", body: { rule_ids: ["r2", "r1"] } },
      ]);
    });
  });

  it("runs the rules and says what they did", async () => {
    const sent: Sent[] = [];
    await renderApp("/categories/rules", { fetch: api(sent) });
    await userEvent.click(
      await screen.findByRole("button", { name: catalogEn["rules.run"] }),
    );
    expect(
      (
        await screen.findAllByText(
          "4 of 9 uncategorized transactions categorized",
        )
      ).length,
    ).toBeGreaterThan(0);
  });

  it("accepts a suggestion under the name the reader gives", async () => {
    const sent: Sent[] = [];
    await renderApp("/categories/rules", { fetch: api(sent) });
    await userEvent.click(
      await screen.findByRole("button", {
        name: catalogEn["suggestion.accept"],
      }),
    );
    const name = screen.getByRole("textbox", { name: catalogEn["rules.name"] });
    expect(name).toHaveValue("Food");
    await userEvent.clear(name);
    await userEvent.type(name, "Bakery");
    await userEvent.click(
      screen.getByRole("button", { name: catalogEn["suggestion.create"] }),
    );
    await waitFor(() => {
      expect(sent).toEqual([{ route: "accept", body: { name: "Bakery" } }]);
    });
  });

  it("maps a bank category to one of the owner's", async () => {
    const sent: Sent[] = [];
    await renderApp("/categories/rules", { fetch: api(sent) });
    const picker = await screen.findByRole("combobox", {
      name: "Category for Transporte",
    });
    await userEvent.click(picker);
    await userEvent.type(picker, "Ride");
    await waitFor(() => {
      expect(screen.getAllByRole("option").length).toBeGreaterThan(0);
    });
    await userEvent.keyboard("{ArrowDown}{Enter}");
    await waitFor(() => {
      expect(sent).toEqual([{ route: "map", body: { category_id: "ride" } }]);
    });
  });
});
