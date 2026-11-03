import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { reloadHome } from "@/features/session";
import { catalogPtBR as pt } from "@/i18n/catalog.pt-BR";
import { fakeApi, json, problem } from "@/testing/fake-api";
import { renderApp } from "@/testing/render-app";

vi.mock("@/features/session/reload-home", () => ({ reloadHome: vi.fn() }));

interface Sent {
  route: string;
  body: unknown;
}

interface Opts {
  role?: "owner" | "write" | "read";
  patch?: Response;
  leave?: Response;
}

const members = [
  {
    member_id: 1,
    email: "ana@example.com",
    role: "owner",
    created_at: "2026-10-01T12:00:00Z",
  },
  {
    member_id: 2,
    email: "bia@example.com",
    role: "write",
    created_at: "2026-10-20T12:00:00Z",
  },
];

beforeEach(() => {
  vi.mocked(reloadHome).mockClear();
});

describe("members settings", () => {
  it("changes the role of a member and removes a member as owner (HA52)", async () => {
    const sent: Sent[] = [];
    await renderApp("/settings?section=members", { fetch: api(sent) });
    const ana = await row("ana@example.com");
    expect(ana.getByText(pt["members.you"])).toBeVisible();
    expect(
      ana.queryByRole("button", { name: pt["members.remove"] }),
    ).toBeNull();

    const bia = await row("bia@example.com");
    await userEvent.click(
      bia.getByRole("combobox", { name: pt["members.role"] }),
    );
    await userEvent.click(
      await screen.findByRole("option", { name: pt["members.role.read"] }),
    );
    await waitFor(() => {
      expect(sent).toEqual([{ route: "PATCH 2", body: { role: "read" } }]);
    });

    await userEvent.click(
      bia.getByRole("button", { name: pt["members.remove"] }),
    );
    const dialog = within(await screen.findByRole("alertdialog"));
    expect(
      dialog.getByText(
        pt["members.removeTitle"].replace("{email}", "bia@example.com"),
      ),
    ).toBeVisible();
    await userEvent.click(
      dialog.getByRole("button", { name: pt["members.remove"] }),
    );
    await waitFor(() => {
      expect(sent.at(-1)).toEqual({ route: "DELETE 2", body: null });
    });
  });

  it("shows the problem of a refused role change (HA21)", async () => {
    const sent: Sent[] = [];
    await renderApp("/settings?section=members", {
      fetch: api(sent, { patch: problem(409, "last_owner") }),
    });
    const ana = await row("ana@example.com");
    await userEvent.click(
      ana.getByRole("combobox", { name: pt["members.role"] }),
    );
    await userEvent.click(
      await screen.findByRole("option", { name: pt["members.role.read"] }),
    );
    expect(await screen.findByText(pt["problem.last_owner"])).toBeVisible();
  });

  it("offers a writer only to leave the book (HA52)", async () => {
    await renderApp("/settings?section=members", {
      fetch: api([], { role: "write" }),
    });
    const bia = await row("bia@example.com");
    expect(
      screen.queryByRole("combobox", { name: pt["members.role"] }),
    ).toBeNull();
    expect(
      bia.queryByRole("button", { name: pt["members.remove"] }),
    ).toBeNull();
    expect(
      screen.getByRole("button", { name: pt["members.leave"] }),
    ).toBeVisible();
  });

  it("leaves the book and reloads the home page (HA20)", async () => {
    const sent: Sent[] = [];
    await renderApp("/settings?section=members", {
      fetch: api(sent, { role: "write" }),
    });
    await userEvent.click(
      await screen.findByRole("button", { name: pt["members.leave"] }),
    );
    const dialog = within(await screen.findByRole("alertdialog"));
    expect(dialog.getByText(pt["members.leaveTitle"])).toBeVisible();
    await userEvent.click(
      dialog.getByRole("button", { name: pt["members.leave"] }),
    );
    await waitFor(() => {
      expect(reloadHome).toHaveBeenCalledTimes(1);
    });
    expect(sent).toEqual([{ route: "DELETE membership", body: null }]);
  });

  it("keeps the dialog and does not reload when leaving is refused (HA21)", async () => {
    await renderApp("/settings?section=members", {
      fetch: api([], { leave: problem(409, "last_owner") }),
    });
    await userEvent.click(
      await screen.findByRole("button", { name: pt["members.leave"] }),
    );
    const dialog = within(await screen.findByRole("alertdialog"));
    await userEvent.click(
      dialog.getByRole("button", { name: pt["members.leave"] }),
    );
    expect(await dialog.findByText(pt["problem.last_owner"])).toBeVisible();
    expect(reloadHome).not.toHaveBeenCalled();
  });

  it("lists the pane in the group of books (HA52)", async () => {
    await renderApp("/settings?section=members", { fetch: api([]) });
    const contents = await screen.findByRole("navigation", {
      name: pt["settings.contents"],
    });
    const link = within(contents).getByRole("link", {
      name: pt["settings.members.title"],
    });

    expect(link.closest("ul")?.previousElementSibling?.textContent).toBe(
      pt["settings.group.books"],
    );
  });
});

function api(sent: Sent[], opts: Opts = {}) {
  return fakeApi({
    "GET /api/v1/me": () =>
      json(200, {
        id: 1,
        email: "ana@example.com",
        role: "admin",
        language: "pt",
        region: "BR",
        books_id: 4,
        book_role: opts.role ?? "owner",
      }),
    "GET /api/v1/me/books": () => json(200, { items: [] }),
    "GET /api/v1/settings": () => json(200, { base_currency: "BRL" }),
    "GET /api/v1/transactions": () => json(200, { items: [] }),
    "GET /api/v1/instruments": () => json(200, { items: [] }),
    "GET /api/v1/books/current/members": () => json(200, { items: members }),
    "PATCH /api/v1/books/current/members/2": async (req) => {
      sent.push({ route: "PATCH 2", body: await req.json() });
      return new Response(null, { status: 204 });
    },
    "PATCH /api/v1/books/current/members/1": async (req) => {
      sent.push({ route: "PATCH 1", body: await req.json() });
      return opts.patch ?? new Response(null, { status: 204 });
    },
    "DELETE /api/v1/books/current/members/2": () => {
      sent.push({ route: "DELETE 2", body: null });
      return new Response(null, { status: 204 });
    },
    "DELETE /api/v1/books/current/membership": () => {
      sent.push({ route: "DELETE membership", body: null });
      return opts.leave ?? new Response(null, { status: 204 });
    },
  });
}

async function row(email: string) {
  const item = (await screen.findByText(email)).closest("li");
  if (item === null) throw new Error(`no row around ${email}`);
  return within(item);
}
