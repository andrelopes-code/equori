import { screen, waitFor, within } from "@testing-library/react";
import type { BoundFunctions, queries } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { reloadHome } from "@/features/session";
import { NewBooksDialog } from "@/features/setup/new-books-dialog";
import { catalogPtBR as pt } from "@/i18n/catalog.pt-BR";
import { fakeApi, json, problem } from "@/testing/fake-api";
import { renderWithProviders } from "@/testing/render-app";

vi.mock("@/features/session/reload-home", () => ({ reloadHome: vi.fn() }));

interface Sent {
  route: string;
  body: unknown;
}

function api(
  sent: Sent[],
  opts: { create?: Response; switch?: Response } = {},
) {
  return fakeApi({
    "GET /api/v1/me": () =>
      json(200, {
        id: 1,
        email: "ana@example.com",
        role: "admin",
        language: "pt",
        region: "BR",
        books_id: 4,
        book_role: "owner",
      }),
    "POST /api/v1/books": async (req) => {
      sent.push({ route: "POST", body: await req.json() });
      return (
        opts.create ??
        json(201, { id: 12, name: "Casal", role: "owner", active: false })
      );
    },
    "PUT /api/v1/session/books": async (req) => {
      sent.push({ route: "PUT", body: await req.json() });
      return opts.switch ?? new Response(null, { status: 204 });
    },
  });
}

async function openDialog(sent: Sent[], opts = {}) {
  renderWithProviders(<NewBooksDialog onClose={vi.fn()} />, {
    fetch: api(sent, opts),
  });
  const dialog = within(await screen.findByRole("dialog"));
  await screen.findByRole("combobox", { name: pt["settings.region"] });
  return dialog;
}

async function fillAndSubmit(dialog: BoundFunctions<typeof queries>) {
  await userEvent.type(
    dialog.getByLabelText(new RegExp(`^${pt["books.name"]}`)),
    "Casal",
  );
  await userEvent.click(
    dialog.getByRole("button", { name: pt["books.create"] }),
  );
}

describe("new book dialog", () => {
  beforeEach(() => {
    vi.mocked(reloadHome).mockClear();
  });

  it("disables the submit button while the name is blank", async () => {
    const dialog = await openDialog([]);

    expect(
      dialog.getByRole("button", { name: pt["books.create"] }),
    ).toBeDisabled();
  });

  it("creates the book, switches to it and reloads", async () => {
    const sent: Sent[] = [];
    const dialog = await openDialog(sent);

    await fillAndSubmit(dialog);

    await waitFor(() => {
      expect(reloadHome).toHaveBeenCalledTimes(1);
    });
    expect(sent).toEqual([
      { route: "POST", body: { name: "Casal", region: "BR" } },
      { route: "PUT", body: { books_id: 12 } },
    ]);
  });

  it("shows the field error of a rejected creation and does not switch", async () => {
    const sent: Sent[] = [];
    const dialog = await openDialog(sent, {
      create: problem(422, "validation_failed", {
        errors: [{ field: "name", message: "too long" }],
      }),
    });

    await fillAndSubmit(dialog);

    expect(await dialog.findByText("too long")).toBeVisible();
    expect(sent.map((s) => s.route)).toEqual(["POST"]);
    expect(reloadHome).not.toHaveBeenCalled();
  });

  it("shows the problem text of a refused switch and does not reload", async () => {
    const sent: Sent[] = [];
    const dialog = await openDialog(sent, {
      switch: problem(404, "books_not_found"),
    });

    await fillAndSubmit(dialog);

    expect(
      await dialog.findByText(pt["problem.books_not_found"]),
    ).toBeVisible();
    expect(reloadHome).not.toHaveBeenCalled();
  });
});
