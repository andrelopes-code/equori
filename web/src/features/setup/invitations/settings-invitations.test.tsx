import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { catalogPtBR as pt } from "@/i18n/catalog.pt-BR";
import { fakeApi, json, problem } from "@/testing/fake-api";
import { renderApp } from "@/testing/render-app";

interface Sent {
  route: string;
  body: unknown;
}

interface Opts {
  role?: "owner" | "write" | "read";
  create?: Response;
  asked?: { invitations: number };
}

const invitation = {
  id: "6f1c2a8e-0000-4000-8000-000000000001",
  email: "caio@example.com",
  role: "read",
  created_at: "2026-10-30T12:00:00Z",
  expires_at: "2026-11-06T12:00:00Z",
};

describe("invitations settings", () => {
  it("lists a pending invitation and revokes it without confirmation (HA25)", async () => {
    const sent: Sent[] = [];
    await renderApp("/settings?section=members", { fetch: api(sent) });
    const item = (await screen.findByText("caio@example.com")).closest("li");
    if (item === null) throw new Error("no row around caio@example.com");

    await userEvent.click(
      within(item).getByRole("button", { name: pt["invitations.revoke"] }),
    );

    await waitFor(() => {
      expect(sent).toEqual([{ route: `DELETE ${invitation.id}`, body: null }]);
    });
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("creates an invitation and shows its link once (HA25)", async () => {
    const sent: Sent[] = [];
    await renderApp("/settings?section=members", { fetch: api(sent) });
    await userEvent.click(
      await screen.findByRole("button", { name: pt["invitations.create"] }),
    );
    const dialog = within(await screen.findByRole("dialog"));
    await userEvent.type(
      dialog.getByRole("textbox", {
        name: new RegExp(pt["invitations.email"]),
      }),
      "caio@example.com",
    );
    await userEvent.click(
      dialog.getByRole("radio", { name: new RegExp(pt["members.role.write"]) }),
    );
    await userEvent.click(
      dialog.getByRole("button", { name: pt["invitations.create"] }),
    );

    expect(
      await screen.findByDisplayValue(
        `${window.location.origin}/invite#token=tok_abc`,
      ),
    ).toBeVisible();
    expect(sent).toEqual([
      {
        route: "POST",
        body: { email: "caio@example.com", role: "write" },
      },
    ]);
  });

  it("shows the problem of a refused invitation (HA25)", async () => {
    await renderApp("/settings?section=members", {
      fetch: api([], { create: problem(409, "already_member") }),
    });
    await userEvent.click(
      await screen.findByRole("button", { name: pt["invitations.create"] }),
    );
    const dialog = within(await screen.findByRole("dialog"));
    await userEvent.type(
      dialog.getByRole("textbox", {
        name: new RegExp(pt["invitations.email"]),
      }),
      "bia@example.com",
    );
    await userEvent.click(
      dialog.getByRole("button", { name: pt["invitations.create"] }),
    );

    expect(await dialog.findByText(pt["problem.already_member"])).toBeVisible();
  });

  it("hides the invitations from a writer and does not ask for them (HA25)", async () => {
    const asked = { invitations: 0 };
    await renderApp("/settings?section=members", {
      fetch: api([], { role: "write", asked }),
    });
    await screen.findByText("ana@example.com");

    expect(
      screen.queryByRole("heading", { name: pt["invitations.title"] }),
    ).toBeNull();
    expect(asked.invitations).toBe(0);
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
    "GET /api/v1/books/current/members": () =>
      json(200, {
        items: [
          {
            member_id: 1,
            email: "ana@example.com",
            role: "owner",
            created_at: "2026-10-01T12:00:00Z",
          },
        ],
      }),
    "GET /api/v1/books/current/invitations": () => {
      if (opts.asked !== undefined) opts.asked.invitations += 1;
      return json(200, { items: [invitation] });
    },
    "POST /api/v1/books/current/invitations": async (req) => {
      sent.push({ route: "POST", body: await req.json() });
      return (
        opts.create ??
        json(201, { ...invitation, role: "write", token: "tok_abc" })
      );
    },
    [`DELETE /api/v1/books/current/invitations/${invitation.id}`]: () => {
      sent.push({ route: `DELETE ${invitation.id}`, body: null });
      return new Response(null, { status: 204 });
    },
  });
}
