import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";

import { catalogEn } from "@/i18n/catalog.en";
import { fakeApi, json } from "@/testing/fake-api";
import { renderApp } from "@/testing/render-app";
import { sharedRoutes } from "@/testing/transaction-api";

interface Sent {
  route: string;
  body: unknown;
}

function api(sent: Sent[], uses = 2) {
  const record =
    (route: string, status: number, answer?: unknown) =>
    async (req: Request) => {
      const text = await req.text();
      sent.push({ route, body: text === "" ? null : JSON.parse(text) });
      return answer === undefined
        ? new Response(null, { status })
        : json(status, answer);
    };
  return fakeApi({
    ...sharedRoutes,
    // A region other than BR and a base currency other than BRL.
    "GET /api/v1/me": () =>
      json(200, {
        id: 1,
        email: "a@b.c",
        role: "admin",
        language: "en",
        region: "DE",
      }),
    "GET /api/v1/settings": () => json(200, { base_currency: "EUR" }),
    "GET /api/v1/tags": () =>
      json(200, { items: ["lisbon", "travel", "trip"] }),
    "GET /api/v1/tags/trip": () =>
      json(200, { name: "trip", transactions: uses }),
    "PATCH /api/v1/tags/trip": record("rename", 200, {
      name: "porto",
      transactions: uses,
    }),
    "POST /api/v1/tags/trip/merge": record("merge trip", 200, {
      name: "travel",
      transactions: 3,
    }),
    "DELETE /api/v1/tags/trip": record("delete", 204),
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

describe("TagsPage", () => {
  it("lists the tags and searches them", async () => {
    await renderApp("/categories/tags", { fetch: api([]) });
    await screen.findByRole("rowheader", { name: "trip" });
    await userEvent.type(
      screen.getByRole("searchbox", { name: catalogEn["tags.search"] }),
      "tr",
    );
    await waitFor(() => {
      expect(screen.queryByRole("rowheader", { name: "lisbon" })).toBeNull();
    });
    expect(
      screen.getByRole("rowheader", { name: "travel" }),
    ).toBeInTheDocument();
  });

  it("renames a tag in its cell", async () => {
    const sent: Sent[] = [];
    await renderApp("/categories/tags", { fetch: api(sent) });
    const cell = await screen.findByRole("rowheader", { name: "trip" });
    await userEvent.dblClick(cell);
    const editor = within(cell).getByRole("textbox");
    await userEvent.clear(editor);
    await userEvent.type(editor, "porto{Enter}");
    await waitFor(() => {
      expect(sent).toEqual([{ route: "rename", body: { name: "porto" } }]);
    });
  });

  it("merges the selected tags into the one the reader keeps", async () => {
    const sent: Sent[] = [];
    await renderApp("/categories/tags", { fetch: api(sent) });
    await userEvent.click(
      await screen.findByRole("checkbox", { name: "Select travel" }),
    );
    await userEvent.click(
      screen.getByRole("checkbox", { name: "Select trip" }),
    );
    await userEvent.click(
      screen.getByRole("button", { name: catalogEn["tags.merge"] }),
    );
    const dialog = await screen.findByRole("alertdialog");
    expect(within(dialog).getByRole("radio", { name: "travel" })).toBeChecked();
    await userEvent.click(
      within(dialog).getByRole("button", { name: catalogEn["tags.merge"] }),
    );
    await waitFor(() => {
      expect(sent).toEqual([{ route: "merge trip", body: { into: "travel" } }]);
    });
  });

  // Language en, region DE: the count takes the en-DE number format.
  it("states how many transactions lose the tag before deleting it", async () => {
    const sent: Sent[] = [];
    await renderApp("/categories/tags", { fetch: api(sent, 1234) });
    await userEvent.click(
      await screen.findByRole("button", { name: "Actions for trip" }),
    );
    await userEvent.click(
      await screen.findByRole("menuitem", { name: catalogEn["tags.delete"] }),
    );
    const dialog = await screen.findByRole("alertdialog");
    const count = new Intl.NumberFormat("en-DE").format(1234);
    expect(
      await within(dialog).findByText(
        `${count} transactions lose the tag trip. This cannot be undone.`,
      ),
    ).toBeInTheDocument();
    await userEvent.click(
      within(dialog).getByRole("button", { name: catalogEn["tags.delete"] }),
    );
    await waitFor(() => {
      expect(sent).toEqual([{ route: "delete", body: null }]);
    });
    expect(rowOf("travel")).toBeInTheDocument();
  });
});
