import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";

import { catalogEn } from "@/i18n/catalog.en";
import { fakeApi, json } from "@/testing/fake-api";
import { renderApp } from "@/testing/render-app";
import { sharedRoutes, transactionFixture } from "@/testing/transaction-api";

const ride = "aaaaaaaa-0000-4000-8000-000000000001";
const ifood = "bbbbbbbb-0000-4000-8000-000000000002";
const base = { currency: "BRL", opened_on: "2026-01-01", yield_mode: "none" };

const rule = {
  id: "r1",
  name: "Uber",
  priority: 1,
  enabled: true,
  stop_processing: false,
  categorized_count: 3,
  conditions: [{ field: "description", operator: "contains", value: "uber" }],
  actions: [{ type: "set_category", category_id: ride }],
};

interface Sent {
  route: string;
  body: unknown;
}

function api(sent: Sent[]) {
  return fakeApi({
    ...sharedRoutes,
    "GET /api/v1/accounts": () =>
      json(200, {
        items: [{ ...base, id: ride, name: "Ride-hailing", class: "expense" }],
      }),
    "GET /api/v1/payees": () =>
      json(200, { items: [{ id: ifood, name: "iFood" }] }),
    "GET /api/v1/rules": () => json(200, { items: [rule] }),
    "POST /api/v1/rules": async (req) => {
      sent.push({ route: "create", body: await req.json() });
      return json(201, rule);
    },
    "PUT /api/v1/rules/r1": async (req) => {
      sent.push({ route: "replace", body: await req.json() });
      return json(200, rule);
    },
    "DELETE /api/v1/rules/r1": () => {
      sent.push({ route: "delete", body: null });
      return new Response(null, { status: 204 });
    },
    "POST /api/v1/rules/preview": async (req) => {
      sent.push({ route: "preview", body: await req.json() });
      return json(200, {
        would_categorize: { count: 2, transaction_ids: ["t1", "t2"] },
        conflicts: { count: 0, transaction_ids: [] },
      });
    },
    "GET /api/v1/transactions/t1": () =>
      json(
        200,
        transactionFixture({ id: "t1", description: "IFOOD *PEDIDO 1" }),
      ),
    "GET /api/v1/transactions/t2": () =>
      json(
        200,
        transactionFixture({ id: "t2", description: "IFOOD *PEDIDO 2" }),
      ),
  });
}

beforeEach(() => {
  localStorage.clear();
});

describe("rule editor", () => {
  it("opens on the payee and category it was asked for, reads it and previews it", async () => {
    const sent: Sent[] = [];
    await renderApp(`/categories/rules/new?payee=${ifood}&category=${ride}`, {
      fetch: api(sent),
    });
    expect(await screen.findByText("payee is iFood")).toBeInTheDocument();
    expect(screen.getByText("categorize as Ride-hailing")).toBeInTheDocument();
    await userEvent.type(
      screen.getByRole("textbox", { name: catalogEn["ruleEditor.name"] }),
      "iFood",
    );
    expect(await screen.findByText("Would categorize 2")).toBeInTheDocument();
    expect(await screen.findByText("IFOOD *PEDIDO 1")).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole("button", { name: catalogEn["ruleEditor.save"] }),
    );
    await waitFor(() => {
      expect(sent.filter((s) => s.route === "create")).toEqual([
        {
          route: "create",
          body: {
            name: "iFood",
            enabled: true,
            stop_processing: false,
            conditions: [{ field: "payee", operator: "equals", value: ifood }],
            actions: [{ type: "set_category", category_id: ride }],
          },
        },
      ]);
    });
  });

  // docs/contributing/forms.md F5 and F8: the steps are sections of the form, named by a
  // legend; the reading and the preview are sections of its aside.
  it("frames the reading and the preview as sections beside the steps", async () => {
    await renderApp("/categories/rules/new", { fetch: api([]) });
    expect(
      await screen.findByRole("group", { name: catalogEn["ruleEditor.when"] }),
    ).toBeInTheDocument();
    for (const key of ["ruleEditor.reading", "preview.title"] as const) {
      const heading = await screen.findByRole("heading", {
        name: catalogEn[key],
      });
      expect(heading.closest('[data-ui="section"]')).toHaveAttribute(
        "data-ground",
        "surface",
      );
    }
  });

  it("marks what the server would refuse before sending anything", async () => {
    const sent: Sent[] = [];
    await renderApp("/categories/rules/new", { fetch: api(sent) });
    await userEvent.click(
      await screen.findByRole("button", { name: catalogEn["ruleEditor.save"] }),
    );
    expect(
      screen.getByText(catalogEn["ruleDraft.nameRequired"]),
    ).toBeInTheDocument();
    expect(
      screen.getByText(catalogEn["ruleDraft.valueRequired"]),
    ).toBeInTheDocument();
    expect(
      screen.getByText(catalogEn["ruleDraft.categoryRequired"]),
    ).toBeInTheDocument();
    expect(sent.filter((s) => s.route !== "preview")).toEqual([]);
  });

  it("replaces an existing rule and deletes it", async () => {
    const sent: Sent[] = [];
    const { router } = await renderApp("/categories/rules/r1", {
      fetch: api(sent),
    });
    const name = await screen.findByRole("textbox", {
      name: catalogEn["ruleEditor.name"],
    });
    await userEvent.clear(name);
    await userEvent.type(name, "Rides");
    const value = screen.getByRole("textbox", {
      name: catalogEn["ruleEditor.value"],
    });
    await userEvent.clear(value);
    await userEvent.type(value, "99app");
    await userEvent.click(
      screen.getByRole("button", { name: catalogEn["ruleEditor.save"] }),
    );
    await waitFor(() => {
      expect(sent.filter((s) => s.route === "replace")).toEqual([
        {
          route: "replace",
          body: {
            name: "Rides",
            enabled: true,
            stop_processing: false,
            conditions: [
              { field: "description", operator: "contains", value: "99app" },
            ],
            actions: [{ type: "set_category", category_id: ride }],
          },
        },
      ]);
    });
    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/categories/rules");
    });
  });

  it("changes a condition's field and its value control with it", async () => {
    await renderApp("/categories/rules/new", { fetch: api([]) });
    const field = await screen.findByRole("combobox", {
      name: "Field of condition 1",
    });
    await userEvent.click(field);
    await userEvent.click(
      await screen.findByRole("option", { name: "installment" }),
    );
    expect(
      within(document.body).getByRole("switch", {
        name: catalogEn["rule.installment.yes"],
      }),
    ).toBeChecked();
  });
});
