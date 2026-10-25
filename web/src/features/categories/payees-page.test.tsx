import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { catalogEn } from "@/i18n/catalog.en";
import { fakeApi, json } from "@/testing/fake-api";
import { renderApp } from "@/testing/render-app";
import { sharedRoutes } from "@/testing/transaction-api";

// Records the payees whose row's actions render, so a test can tell one row's render from all.
const actions = vi.hoisted(() => ({ rendered: new Set<string>() }));
vi.mock("@/features/categories/payee-actions", async (importOriginal) => {
  const actual =
    await importOriginal<
      typeof import("@/features/categories/payee-actions")
    >();
  return {
    PayeeActions: (props: Parameters<typeof actual.PayeeActions>[0]) => {
      actions.rendered.add(props.payee.name);
      return actual.PayeeActions(props);
    },
  };
});

const payees = [
  { id: "p1", name: "iFood" },
  { id: "p2", name: "IFOOD" },
  { id: "p3", name: "Uber" },
];

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
    "GET /api/v1/payees": () => json(200, { items: payees }),
    "GET /api/v1/payee-aliases": () =>
      json(200, {
        items: [
          {
            id: "a1",
            pattern: "IFOOD *",
            match_type: "starts_with",
            payee_id: "p1",
          },
        ],
      }),
    "PATCH /api/v1/payees/p3": record("rename", { id: "p3", name: "Uber BR" }),
    "POST /api/v1/payees/p2/merge": record("merge p2", payees[0]),
    "POST /api/v1/payee-aliases": record("alias", {}),
    "DELETE /api/v1/payee-aliases/a1": () => {
      sent.push({ route: "delete alias", body: null });
      return new Response(null, { status: 204 });
    },
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

describe("PayeesPage", () => {
  it("lists the payees with their aliases and searches them", async () => {
    await renderApp("/categories/payees", { fetch: api([]) });
    await screen.findByRole("rowheader", { name: "iFood" });
    expect(within(rowOf("iFood")).getByText("IFOOD *")).toBeInTheDocument();
    await userEvent.type(
      screen.getByRole("searchbox", { name: catalogEn["payees.search"] }),
      "ub",
    );
    await waitFor(() => {
      expect(screen.queryByRole("rowheader", { name: "iFood" })).toBeNull();
    });
    expect(screen.getByRole("rowheader", { name: "Uber" })).toBeInTheDocument();
  });

  it("renames a payee in its cell", async () => {
    const sent: Sent[] = [];
    await renderApp("/categories/payees", { fetch: api(sent) });
    const cell = await screen.findByRole("rowheader", { name: "Uber" });
    await userEvent.dblClick(cell);
    const editor = within(cell).getByRole("textbox");
    await userEvent.clear(editor);
    await userEvent.type(editor, "Uber BR{Enter}");
    await waitFor(() => {
      expect(sent).toEqual([{ route: "rename", body: { name: "Uber BR" } }]);
    });
  });

  // Owner review 2026-10-22: a selection rendered every row of the grid again.
  it("renders only the selected row when the selection changes", async () => {
    await renderApp("/categories/payees", { fetch: api([]) });
    const box = await screen.findByRole("checkbox", { name: "Select iFood" });
    actions.rendered.clear();
    await userEvent.click(box);
    expect([...actions.rendered]).toEqual(["iFood"]);
  });

  it("merges the selected payees into the one the reader keeps", async () => {
    const sent: Sent[] = [];
    await renderApp("/categories/payees", { fetch: api(sent) });
    await userEvent.click(
      await screen.findByRole("checkbox", { name: "Select iFood" }),
    );
    await userEvent.click(
      screen.getByRole("checkbox", { name: "Select IFOOD" }),
    );
    await userEvent.click(
      screen.getByRole("button", { name: catalogEn["payees.merge"] }),
    );
    const dialog = await screen.findByRole("alertdialog");
    expect(within(dialog).getByRole("radio", { name: "iFood" })).toBeChecked();
    await userEvent.click(
      within(dialog).getByRole("button", { name: catalogEn["payees.merge"] }),
    );
    await waitFor(() => {
      expect(sent).toEqual([{ route: "merge p2", body: { into: "p1" } }]);
    });
  });

  it("adds and removes aliases of a payee", async () => {
    const sent: Sent[] = [];
    await renderApp("/categories/payees", { fetch: api(sent) });
    await userEvent.click(
      await screen.findByRole("button", { name: "Actions for iFood" }),
    );
    await userEvent.click(
      await screen.findByRole("menuitem", {
        name: catalogEn["payees.manageAliases"],
      }),
    );
    const drawer = await screen.findByRole("dialog");
    await userEvent.type(
      within(drawer).getByRole("textbox", { name: catalogEn["alias.pattern"] }),
      "PAG*IFOOD",
    );
    await userEvent.click(
      within(drawer).getByRole("button", { name: catalogEn["alias.add"] }),
    );
    await userEvent.click(
      within(drawer).getByRole("button", { name: "Remove alias IFOOD *" }),
    );
    await waitFor(() => {
      expect(sent).toEqual([
        {
          route: "alias",
          body: {
            pattern: "PAG*IFOOD",
            match_type: "contains",
            payee_id: "p1",
          },
        },
        { route: "delete alias", body: null },
      ]);
    });
  });

  it.each([
    [390, "bottom"],
    [1280, "end"],
  ])("opens the aliases drawer at %i px from the %s", async (width, side) => {
    await renderApp("/categories/payees", { fetch: api([]), width });
    await userEvent.click(
      await screen.findByRole("button", { name: "Actions for iFood" }),
    );
    await userEvent.click(
      await screen.findByRole("menuitem", {
        name: catalogEn["payees.manageAliases"],
      }),
    );
    const drawer = await screen.findByRole("dialog");
    expect(drawer.closest("[data-side]")).toHaveAttribute("data-side", side);
  });
});
