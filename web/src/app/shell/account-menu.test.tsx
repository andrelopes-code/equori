import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { reloadHome } from "@/features/session";
import { writeLocale } from "@/i18n/locale";
import { catalogPtBR as pt } from "@/i18n/catalog.pt-BR";
import { fakeApi, json, problem } from "@/testing/fake-api";
import { renderApp } from "@/testing/render-app";

vi.mock("@/features/session/reload-home", () => ({ reloadHome: vi.fn() }));

const casa = { id: 4, name: "Casa", role: "owner", active: false };
const casal = { id: 12, name: "Casal", role: "write", active: true };

function api(items: unknown[], sent: unknown[], put?: Response) {
  return fakeApi({
    "GET /api/v1/me": () =>
      json(200, {
        id: 1,
        email: "ana@example.com",
        role: "admin",
        language: "pt",
        region: "BR",
        books_id: 12,
        book_role: "write",
      }),
    "GET /api/v1/me/books": () => json(200, { items }),
    "PUT /api/v1/session/books": async (req) => {
      sent.push(await req.json());
      return put ?? new Response(null, { status: 204 });
    },
  });
}

async function openBooks() {
  const user = await openMenu();
  await user.click(
    await screen.findByRole("menuitem", {
      name: new RegExp(pt["books.label"]),
    }),
  );
  return user;
}

async function openMenu() {
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: pt["nav.user"] }));
  await screen.findByRole("menu");
  return user;
}

describe("account menu books", () => {
  beforeEach(() => {
    localStorage.clear();
    writeLocale({ language: "pt", region: "BR" });
    vi.mocked(reloadHome).mockClear();
  });

  it("lists the books, marks the active one and switches to another", async () => {
    const sent: unknown[] = [];
    await renderApp("/help", { fetch: api([casa, casal], sent) });
    const trigger = screen.getByRole("button", { name: pt["nav.user"] });
    await waitFor(() => expect(trigger).toHaveTextContent("Casal"));

    const user = await openMenu();

    expect(screen.queryByRole("menuitemradio", { name: "Casal" })).toBeNull();
    await user.click(
      screen.getByRole("menuitem", { name: new RegExp(pt["books.label"]) }),
    );

    expect(
      await screen.findByRole("menuitemradio", { name: "Casal" }),
    ).toBeChecked();
    expect(
      screen.getByRole("menuitemradio", { name: "Casa" }),
    ).not.toBeChecked();

    await user.click(screen.getByRole("menuitemradio", { name: "Casal" }));
    expect(sent).toEqual([]);

    await user.click(screen.getByRole("menuitemradio", { name: "Casa" }));
    await waitFor(() => {
      expect(reloadHome).toHaveBeenCalledTimes(1);
    });
    expect(sent).toEqual([{ books_id: 4 }]);
  });

  it("offers a new book alone when there is one book", async () => {
    const sent: unknown[] = [];
    await renderApp("/help", {
      fetch: api([{ ...casa, active: true }], sent),
    });
    const trigger = screen.getByRole("button", { name: pt["nav.user"] });
    await waitFor(() => expect(trigger).toBeInTheDocument());
    expect(trigger).not.toHaveTextContent("Casa");

    const user = await openMenu();

    expect(screen.queryByRole("menuitemradio", { name: "Casa" })).toBeNull();
    await user.click(screen.getByRole("menuitem", { name: pt["books.new"] }));
    const dialog = await screen.findByRole("dialog");
    expect(
      within(dialog).getByRole("heading", { name: pt["books.new"] }),
    ).toBeInTheDocument();
  });

  it("creates a book from the books submenu", async () => {
    await renderApp("/help", { fetch: api([casa, casal], []) });
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: pt["nav.user"] }),
      ).toHaveTextContent("Casal"),
    );

    const user = await openBooks();
    await user.click(
      await screen.findByRole("menuitem", { name: pt["books.new"] }),
    );

    const dialog = await screen.findByRole("dialog");
    expect(
      within(dialog).getByRole("heading", { name: pt["books.new"] }),
    ).toBeInTheDocument();
  });

  it("shows the problem of a failed switch", async () => {
    const sent: unknown[] = [];
    await renderApp("/help", {
      fetch: api([casa, casal], sent, problem(404, "books_not_found")),
    });
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: pt["nav.user"] }),
      ).toHaveTextContent("Casal"),
    );

    const user = await openBooks();
    await user.click(
      await screen.findByRole("menuitemradio", { name: "Casa" }),
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      pt["problem.books_not_found"],
    );
    expect(reloadHome).not.toHaveBeenCalled();
  });
});
