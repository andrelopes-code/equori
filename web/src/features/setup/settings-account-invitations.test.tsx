import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { catalogPtBR as pt } from "@/i18n/catalog.pt-BR";
import { fakeApi, json, problem } from "@/testing/fake-api";
import { renderApp } from "@/testing/render-app";

const created = {
  email: "irma@example.com",
  region: "BR",
  base_currency: "BRL",
  expires_at: "2026-11-08T12:00:00Z",
  token: "tok_irma",
};

function api(role: "admin" | "member", sent: unknown[], answer?: Response) {
  return fakeApi({
    "GET /api/v1/me": () =>
      json(200, {
        id: 1,
        email: "ana@example.com",
        role,
        language: "pt",
        region: "BR",
        books_id: 4,
        book_role: "owner",
      }),
    "GET /api/v1/me/books": () => json(200, { items: [] }),
    "GET /api/v1/settings": () => json(200, { base_currency: "BRL" }),
    "GET /api/v1/transactions": () => json(200, { items: [] }),
    "GET /api/v1/instruments": () => json(200, { items: [] }),
    "GET /api/v1/books/current/members": () => json(200, { items: [] }),
    "GET /api/v1/books/current/invitations": () => json(200, { items: [] }),
    "POST /api/v1/account-invitations": async (req) => {
      sent.push(await req.json());
      return answer ?? json(201, created);
    },
  });
}

describe("account invitations in the members settings", () => {
  it("creates an account for an email and shows its link once", async () => {
    const sent: unknown[] = [];
    await renderApp("/settings?section=members", { fetch: api("admin", sent) });
    const actor = userEvent.setup();

    await actor.click(
      await screen.findByRole("button", { name: pt["accounts.invite.create"] }),
    );
    const dialog = within(await screen.findByRole("dialog"));
    await actor.type(
      dialog.getByLabelText(pt["invitations.email"], { exact: false }),
      "irma@example.com",
    );
    await actor.click(
      dialog.getByRole("button", { name: pt["accounts.invite.create"] }),
    );

    expect(
      await dialog.findByText(
        `${window.location.origin}/invite#token=tok_irma`,
      ),
    ).toBeVisible();
    expect(sent).toEqual([{ email: "irma@example.com", region: "BR" }]);
  });

  it("shows the problem of the server when the email has a member", async () => {
    const sent: unknown[] = [];
    const taken = problem(409, "email_taken");
    await renderApp("/settings?section=members", {
      fetch: api("admin", sent, taken),
    });
    const actor = userEvent.setup();

    await actor.click(
      await screen.findByRole("button", { name: pt["accounts.invite.create"] }),
    );
    const dialog = within(await screen.findByRole("dialog"));
    await actor.type(
      dialog.getByLabelText(pt["invitations.email"], { exact: false }),
      "irma@example.com",
    );
    await actor.click(
      dialog.getByRole("button", { name: pt["accounts.invite.create"] }),
    );

    expect(await dialog.findByText(pt["problem.email_taken"])).toBeVisible();
  });

  it("offers nothing to a member without the admin role", async () => {
    await renderApp("/settings?section=members", { fetch: api("member", []) });

    await screen.findByText(pt["invitations.title"]);

    expect(
      screen.queryByRole("button", { name: pt["accounts.invite.create"] }),
    ).toBeNull();
  });
});
