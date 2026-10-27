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

const created = {
  id: "t1",
  name: "Claude Code",
  scope: "read",
  created_at: "2026-10-27T12:00:00Z",
  expires_at: "2027-01-25T12:00:00Z",
};
const tokenText = "eqt_ABCDEFGHIJKLMNOPQRSTUVWXYZ234567ABCDEFGHIJKLMNOPQRST";

function api(sent: Sent[], hold?: Promise<void>, failList = false) {
  let items: unknown[] = [];
  return fakeApi({
    "GET /api/v1/me": () =>
      json(200, {
        id: 1,
        email: "a@b.c",
        role: "admin",
        language: "pt",
        region: "BR",
      }),
    "GET /api/v1/settings": () => json(200, { base_currency: "BRL" }),
    "GET /api/v1/transactions": () => json(200, { items: [] }),
    "GET /api/v1/instruments": () => json(200, { items: [] }),
    "GET /api/v1/access-tokens": () =>
      failList ? problem(500, "internal_error") : json(200, { items }),
    "POST /api/v1/access-tokens": async (req) => {
      sent.push({ route: "POST", body: await req.json() });
      await hold;
      items = [created];
      return json(201, { ...created, token: tokenText });
    },
    "DELETE /api/v1/access-tokens/t1": () => {
      sent.push({ route: "DELETE", body: null });
      items = [];
      return new Response(null, { status: 204 });
    },
  });
}

async function section() {
  const heading = await screen.findByRole("heading", {
    name: pt["settings.external_access.title"],
  });
  const root = heading.closest("section");
  if (root === null) throw new Error("no section around the heading");
  return within(root);
}

describe("external access settings", () => {
  it("creates a read token and shows it once with the client setups (3.6)", async () => {
    const sent: Sent[] = [];
    await renderApp("/settings?section=external_access", { fetch: api(sent) });
    const view = await section();
    expect(
      await view.findByText(pt["settings.external_access.empty"]),
    ).toBeVisible();
    await userEvent.click(
      view.getByRole("button", { name: pt["settings.external_access.create"] }),
    );
    const dialog = within(await screen.findByRole("dialog"));
    expect(
      dialog.getByRole("radio", {
        name: pt["settings.external_access.scope.read"],
      }),
    ).toBeChecked();
    expect(
      dialog.getByRole("radio", {
        name: pt["settings.external_access.days"].replace("{count}", "90"),
      }),
    ).toBeChecked();
    await userEvent.type(
      dialog.getByLabelText(
        new RegExp(`^${pt["settings.external_access.name"]}`),
      ),
      "Claude Code",
    );
    await userEvent.click(
      dialog.getByRole("button", {
        name: pt["settings.external_access.create"],
      }),
    );
    await waitFor(() => {
      expect(sent).toEqual([
        {
          route: "POST",
          body: { name: "Claude Code", scope: "read", expires_in_days: 90 },
        },
      ]);
    });
    const endpoint = `${window.location.origin}/mcp`;
    expect(await dialog.findAllByText(new RegExp(tokenText))).not.toHaveLength(
      0,
    );
    expect(
      dialog.getByText(
        new RegExp(`claude mcp add --transport http equori ${endpoint}`),
      ),
    ).toBeInTheDocument();
    expect(dialog.getByText(/bearer_token_env_var/)).toBeInTheDocument();
    expect(dialog.getByText(/"mcpServers"/)).toBeInTheDocument();
    await userEvent.click(
      dialog.getByRole("button", { name: pt["settings.external_access.done"] }),
    );
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull();
    });
    expect(await view.findByText("Claude Code")).toBeVisible();
    expect(screen.queryByText(new RegExp(tokenText))).toBeNull();
  });

  it("deletes a token after a confirmation", async () => {
    const sent: Sent[] = [];
    const fetch = api(sent);
    await renderApp("/settings?section=external_access", { fetch });
    const view = await section();
    await userEvent.click(
      await view.findByRole("button", {
        name: pt["settings.external_access.create"],
      }),
    );
    const dialog = within(await screen.findByRole("dialog"));
    await userEvent.type(
      dialog.getByLabelText(
        new RegExp(`^${pt["settings.external_access.name"]}`),
      ),
      "Claude Code",
    );
    await userEvent.click(
      dialog.getByRole("button", {
        name: pt["settings.external_access.create"],
      }),
    );
    await userEvent.click(
      await dialog.findByRole("button", {
        name: pt["settings.external_access.done"],
      }),
    );
    const row = (await view.findByText("Claude Code")).closest("li");
    if (row === null) throw new Error("no row");
    await userEvent.click(
      within(row).getByRole("button", {
        name: pt["settings.external_access.delete"],
      }),
    );
    const confirm = within(await screen.findByRole("dialog"));
    await userEvent.click(
      confirm.getByRole("button", {
        name: pt["settings.external_access.delete"],
      }),
    );
    await waitFor(() => {
      expect(sent.map((s) => s.route)).toEqual(["POST", "DELETE"]);
    });
  });

  // Review of phase 3: closing during the creation would hide a token that exists.
  it("stays open while the token is being created", async () => {
    let release: () => void = () => undefined;
    const hold = new Promise<void>((resolve) => {
      release = resolve;
    });
    await renderApp("/settings?section=external_access", {
      fetch: api([], hold),
    });
    const view = await section();
    await userEvent.click(
      await view.findByRole("button", {
        name: pt["settings.external_access.create"],
      }),
    );
    const dialog = within(await screen.findByRole("dialog"));
    await userEvent.type(
      dialog.getByLabelText(
        new RegExp(`^${pt["settings.external_access.name"]}`),
      ),
      "Claude Code",
    );
    await userEvent.click(
      dialog.getByRole("button", {
        name: pt["settings.external_access.create"],
      }),
    );
    await userEvent.keyboard("{Escape}");
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(
      dialog.getByRole("button", { name: pt["detail.cancel"] }),
    ).toBeDisabled();
    release();
    expect(
      await dialog.findByText(pt["settings.external_access.tokenTitle"]),
    ).toBeInTheDocument();
  });

  it("shows no empty list when the tokens fail to load", async () => {
    await renderApp("/settings?section=external_access", {
      fetch: api([], undefined, true),
    });
    const view = await section();
    expect(
      await view.findByText(pt["problem.internal_error"]),
    ).toBeInTheDocument();
    expect(view.queryByText(pt["settings.external_access.empty"])).toBeNull();
  });

  it("notes that cloud clients need a public address on a private origin", async () => {
    await renderApp("/settings?section=external_access", { fetch: api([]) });
    const view = await section();
    expect(
      await view.findByText(pt["settings.external_access.reachability"]),
    ).toBeVisible();
  });
});
