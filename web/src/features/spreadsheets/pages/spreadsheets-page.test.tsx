import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { catalogEn } from "@/i18n/catalog.en";
import { fakeApi, json, problem } from "@/testing/fake-api";
import { renderApp } from "@/testing/render-app";
import { sharedRoutes } from "@/testing/transaction-api";

// The editor is a chunk of its own; the list never loads it.
vi.mock("@/features/spreadsheets/editor/create-editor", () => ({
  createEditor: () =>
    Promise.resolve({
      snapshot: () => ({}),
      activeSheet: () => ({
        name: "Sheet1",
        rows: [
          ["a", 1.5],
          [null, "x,y"],
        ],
      }),
      setDark: () => undefined,
      dispose: () => undefined,
    }),
}));

const budgetID = "b0000000-0000-4000-8000-000000000001";
const tripID = "b0000000-0000-4000-8000-000000000002";

function summary(id: string, name: string) {
  return {
    id,
    name,
    version: 1,
    created_at: "2026-11-20T12:00:00Z",
    updated_at: "2026-11-21T15:30:00Z",
  };
}

interface Sent {
  route: string;
  body: unknown;
}

function api(
  sent: Sent[],
  items = [summary(budgetID, "Orçamento"), summary(tripID, "Trip")],
  role = "owner",
) {
  const record =
    (route: string, answer: () => Response) => async (req: Request) => {
      const text = await req.text();
      sent.push({ route, body: text === "" ? null : JSON.parse(text) });
      return answer();
    };
  return fakeApi({
    ...sharedRoutes,
    // A region other than BR and a base currency other than BRL.
    "GET /api/v1/me": () =>
      json(200, {
        id: 1,
        email: "a@b.c",
        role: "member",
        language: "en",
        region: "DE",
        books_id: 1,
        book_role: role,
      }),
    "GET /api/v1/settings": () => json(200, { base_currency: "EUR" }),
    "GET /api/v1/spreadsheets": () => json(200, { items }),
    "POST /api/v1/spreadsheets": record("create", () =>
      json(201, { ...summary(tripID, "Untitled spreadsheet"), content: {} }),
    ),
    [`GET /api/v1/spreadsheets/${tripID}`]: () =>
      json(200, { ...summary(tripID, "Trip"), content: {} }),
    [`PUT /api/v1/spreadsheets/${budgetID}/name`]: record("rename", () =>
      json(200, summary(budgetID, "Budget")),
    ),
    [`POST /api/v1/spreadsheets/${budgetID}/copies`]: record("copy", () =>
      problem(409, "spreadsheet_limit_reached"),
    ),
    [`DELETE /api/v1/spreadsheets/${budgetID}`]: record(
      "delete",
      () => new Response(null, { status: 204 }),
    ),
  });
}

async function openMenu(name: string) {
  await userEvent.click(
    await screen.findByRole("button", {
      name: catalogEn["spreadsheets.actions"].replace("{name}", name),
    }),
  );
}

beforeEach(() => {
  localStorage.clear();
});

describe("SpreadsheetsPage", () => {
  it("lists the spreadsheets and searches them without accents", async () => {
    await renderApp("/spreadsheets", { fetch: api([]) });

    await screen.findByRole("rowheader", { name: "Orçamento" });
    await userEvent.type(
      screen.getByRole("searchbox", {
        name: catalogEn["spreadsheets.search"],
      }),
      "orca",
    );

    await waitFor(() => {
      expect(screen.queryByRole("rowheader", { name: "Trip" })).toBeNull();
    });
    expect(screen.getByRole("link", { name: "Orçamento" })).toHaveAttribute(
      "href",
      `/spreadsheets/${budgetID}`,
    );
  });

  it("creates a spreadsheet with one sheet and opens it", async () => {
    const sent: Sent[] = [];
    const { router } = await renderApp("/spreadsheets", { fetch: api(sent) });

    await userEvent.click(
      await screen.findByRole("button", {
        name: catalogEn["spreadsheets.new"],
      }),
    );

    await waitFor(() => {
      expect(router.state.location.pathname).toBe(`/spreadsheets/${tripID}`);
    });
    expect(sent).toEqual([
      {
        route: "create",
        body: {
          name: catalogEn["spreadsheets.untitled"],
          content: {
            sheetOrder: ["sheet-1"],
            sheets: {
              "sheet-1": {
                id: "sheet-1",
                name: catalogEn["spreadsheets.firstSheet"],
              },
            },
          },
        },
      },
    ]);
  });

  it("offers the creation in the empty state", async () => {
    await renderApp("/spreadsheets", { fetch: api([], []) });

    expect(
      await screen.findByText(catalogEn["spreadsheets.empty"]),
    ).toBeInTheDocument();
    expect(screen.queryByRole("grid")).toBeNull();
  });

  it("renames a spreadsheet from its menu", async () => {
    const sent: Sent[] = [];
    await renderApp("/spreadsheets", { fetch: api(sent) });

    await openMenu("Orçamento");
    await userEvent.click(
      screen.getByRole("menuitem", {
        name: catalogEn["spreadsheets.rename"],
      }),
    );
    const dialog = await screen.findByRole("dialog");
    const field = within(dialog).getByRole("textbox", {
      name: new RegExp(catalogEn["spreadsheets.name"]),
    });
    expect(field).toHaveValue("Orçamento");
    await userEvent.clear(field);
    await userEvent.type(field, " Budget ");
    await userEvent.click(
      within(dialog).getByRole("button", {
        name: catalogEn["spreadsheets.save"],
      }),
    );

    await waitFor(() => {
      expect(sent).toEqual([{ route: "rename", body: { name: "Budget" } }]);
    });
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull();
    });
  });

  it("shows why a copy was refused and keeps the dialog", async () => {
    const sent: Sent[] = [];
    await renderApp("/spreadsheets", { fetch: api(sent) });

    await openMenu("Orçamento");
    await userEvent.click(
      screen.getByRole("menuitem", {
        name: catalogEn["spreadsheets.copy"],
      }),
    );
    const dialog = await screen.findByRole("dialog");
    await userEvent.click(
      within(dialog).getByRole("button", {
        name: catalogEn["spreadsheets.create"],
      }),
    );

    expect(
      await within(dialog).findByText(
        catalogEn["problem.spreadsheet_limit_reached"],
      ),
    ).toBeInTheDocument();
    expect(sent).toEqual([
      { route: "copy", body: { name: "Copy of Orçamento" } },
    ]);
  });

  it("deletes a spreadsheet after the confirmation", async () => {
    const sent: Sent[] = [];
    await renderApp("/spreadsheets", { fetch: api(sent) });

    await openMenu("Orçamento");
    await userEvent.click(
      screen.getByRole("menuitem", {
        name: catalogEn["spreadsheets.delete"],
      }),
    );
    const dialog = await screen.findByRole("alertdialog");
    expect(sent).toEqual([]);
    await userEvent.click(
      within(dialog).getByRole("button", {
        name: catalogEn["spreadsheets.delete"],
      }),
    );

    await waitFor(() => {
      expect(sent).toEqual([{ route: "delete", body: null }]);
    });
  });

  it("creates a spreadsheet from a CSV file and opens it", async () => {
    const sent: Sent[] = [];
    const { router } = await renderApp("/spreadsheets", { fetch: api(sent) });
    await screen.findByRole("rowheader", { name: "Orçamento" });

    await userEvent.upload(
      screen.getByLabelText(catalogEn["spreadsheets.import.choose"]),
      new File(["Item;Valor\nAluguel;1.500,00\n"], "Extrato.csv"),
    );

    await waitFor(() => {
      expect(router.state.location.pathname).toBe(`/spreadsheets/${tripID}`);
    });
    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({
      route: "create",
      body: {
        name: "Extrato",
        content: {
          sheetOrder: ["sheet-1"],
          sheets: {
            "sheet-1": {
              name: catalogEn["spreadsheets.firstSheet"],
              cellData: {
                "0": { "0": { v: "Item", t: 1 }, "1": { v: "Valor", t: 1 } },
                "1": { "0": { v: "Aluguel", t: 1 }, "1": { v: 1500, t: 2 } },
              },
            },
          },
        },
      },
    });
  });

  it("says that a file of another kind is not a spreadsheet", async () => {
    const sent: Sent[] = [];
    await renderApp("/spreadsheets", { fetch: api(sent) });
    await screen.findByRole("rowheader", { name: "Orçamento" });

    await userEvent.upload(
      screen.getByLabelText(catalogEn["spreadsheets.import.choose"]),
      new File(["%PDF"], "statement.pdf"),
      { applyAccept: false },
    );

    // A toast writes its words once on screen and once for a screen reader.
    expect(
      await screen.findAllByText(catalogEn["spreadsheets.import.unsupported"]),
    ).not.toHaveLength(0);
    expect(sent).toEqual([]);
  });

  it("gives a reader the list without the writes", async () => {
    await renderApp("/spreadsheets", {
      fetch: api([], undefined, "read"),
    });

    await screen.findByRole("rowheader", { name: "Orçamento" });

    expect(
      screen.queryByRole("button", {
        name: catalogEn["spreadsheets.new"],
      }),
    ).toBeNull();
    expect(
      screen.queryByRole("button", {
        name: catalogEn["spreadsheets.actions"].replace("{name}", "Orçamento"),
      }),
    ).toBeNull();
  });
});
