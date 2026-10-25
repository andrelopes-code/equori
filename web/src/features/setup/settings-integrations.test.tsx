import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { catalogEn as en } from "@/i18n/catalog.en";
import { catalogPtBR as pt } from "@/i18n/catalog.pt-BR";
import { fakeApi, json, problem } from "@/testing/fake-api";
import { renderApp } from "@/testing/render-app";

interface Sent {
  route: string;
  body: unknown;
}

const pluggy = {
  id: "i1",
  aggregator: "pluggy",
  name: "Personal",
  updated_at: "2026-10-10T12:00:00Z",
};
const aggregators = [
  {
    id: "pluggy",
    name: "Pluggy",
    connect_method: "reference",
    credential_fields: [
      { name: "client_id", secret: false },
      { name: "client_secret", secret: true },
    ],
  },
];
const connection = (id: string, name: string, integration: string) => ({
  id,
  integration_id: integration,
  external_id: `ext-${id}`,
  state: "ok",
  name,
  provider_status: "UPDATED",
  created_at: "2026-10-01T00:00:00Z",
  accounts: [],
});

interface Answers {
  create?: () => Response;
  rotate?: () => Response;
  remove?: () => Response;
  locale?: { language: string; region: string; currency: string };
}

function api(sent: Sent[], answers: Answers = {}) {
  const record =
    (route: string, answer: () => Response) => async (req: Request) => {
      sent.push({ route, body: await req.json().catch(() => null) });
      return answer();
    };
  return fakeApi({
    "GET /api/v1/me": () =>
      json(200, {
        id: 1,
        email: "a@b.c",
        role: "admin",
        language: answers.locale?.language ?? "pt",
        region: answers.locale?.region ?? "BR",
      }),
    "GET /api/v1/settings": () =>
      json(200, { base_currency: answers.locale?.currency ?? "BRL" }),
    "GET /api/v1/transactions": () => json(200, { items: [] }),
    "GET /api/v1/instruments": () => json(200, { items: [] }),
    "GET /api/v1/aggregators": () => json(200, { items: aggregators }),
    "GET /api/v1/integrations": () => json(200, { items: [pluggy] }),
    "GET /api/v1/connections": () =>
      json(200, {
        items: [
          connection("c1", "Itaú", "i1"),
          connection("c2", "Nubank", "i1"),
          connection("c3", "Other", "i2"),
        ],
      }),
    "POST /api/v1/integrations": record(
      "POST",
      answers.create ?? (() => json(201, { ...pluggy, id: "i9" })),
    ),
    "PUT /api/v1/integrations/i1/credentials": record(
      "PUT",
      answers.rotate ?? (() => json(200, pluggy)),
    ),
    "DELETE /api/v1/integrations/i1": record(
      "DELETE",
      answers.remove ?? (() => new Response(null, { status: 204 })),
    ),
  });
}

// A required field's label carries a marker after its text.
function field(dialog: HTMLElement, label: string) {
  return within(dialog).getByLabelText(new RegExp(`^${label}`));
}

async function section(title: string) {
  const heading = await screen.findByRole("heading", { name: title });
  const root = heading.closest("section");
  if (root === null) throw new Error("no section around the heading");
  return within(root);
}

describe("integrations settings", () => {
  it("lists each integration with its aggregator, update and number of connections", async () => {
    await renderApp("/settings", { fetch: api([]) });
    const view = await section(pt["settings.integrations.title"]);
    const row = (await view.findByText("Personal")).closest("li");
    if (row === null) throw new Error("no row");
    expect(within(row).getByText(/Pluggy/)).toBeVisible();
    expect(
      within(row).getByText(
        new RegExp(
          pt["settings.integrations.connections"].replace("{count}", "2"),
        ),
      ),
    ).toBeVisible();
    expect(within(row).getByText(/credenciais.*10\/10\/2026/i)).toBeVisible();
  });

  it("builds the credential fields from the aggregator and sends them without showing them again", async () => {
    const sent: Sent[] = [];
    await renderApp("/settings", { fetch: api(sent) });
    const view = await section(pt["settings.integrations.title"]);
    await userEvent.click(
      await view.findByRole("button", {
        name: pt["settings.integrations.add"],
      }),
    );
    const dialog = await screen.findByRole("dialog");
    await userEvent.type(
      field(dialog, pt["settings.integrations.name"]),
      "Home",
    );
    const id = field(dialog, "client_id");
    const secret = field(dialog, "client_secret");
    expect(id).toHaveAttribute("type", "text");
    expect(secret).toHaveAttribute("type", "password");
    await userEvent.type(id, "abc");
    await userEvent.type(secret, "shh");
    await userEvent.click(
      within(dialog).getByRole("button", {
        name: pt["settings.integrations.create"],
      }),
    );
    await waitFor(() => {
      expect(sent).toEqual([
        {
          route: "POST",
          body: {
            aggregator: "pluggy",
            name: "Home",
            credentials: { client_id: "abc", client_secret: "shh" },
          },
        },
      ]);
    });
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull();
    });
    expect(document.body.textContent).not.toContain("shh");
  });

  it.each([
    ["aggregator_unauthorized", 422],
    ["aggregator_unavailable", 502],
    ["integration_unavailable", 409],
  ] as const)("keeps the dialog open on %s", async (code, status) => {
    await renderApp("/settings", {
      fetch: api([], { create: () => problem(status, code) }),
    });
    const view = await section(pt["settings.integrations.title"]);
    await userEvent.click(
      await view.findByRole("button", {
        name: pt["settings.integrations.add"],
      }),
    );
    const dialog = await screen.findByRole("dialog");
    await userEvent.type(
      field(dialog, pt["settings.integrations.name"]),
      "Home",
    );
    await userEvent.type(field(dialog, "client_id"), "abc");
    await userEvent.type(field(dialog, "client_secret"), "shh");
    await userEvent.click(
      within(dialog).getByRole("button", {
        name: pt["settings.integrations.create"],
      }),
    );
    expect(
      await within(dialog).findByText(pt[`problem.${code}`]),
    ).toBeVisible();
  });

  it("rotates the credentials and shows the refusal of the aggregator", async () => {
    const sent: Sent[] = [];
    let refuse = true;
    await renderApp("/settings", {
      fetch: api(sent, {
        rotate: () =>
          refuse ? problem(422, "aggregator_unauthorized") : json(200, pluggy),
      }),
    });
    const view = await section(pt["settings.integrations.title"]);
    await userEvent.click(
      await view.findByRole("button", {
        name: pt["settings.integrations.rotate"],
      }),
    );
    const dialog = await screen.findByRole("dialog");
    expect(field(dialog, "client_secret")).toHaveValue("");
    await userEvent.type(field(dialog, "client_id"), "new");
    await userEvent.type(field(dialog, "client_secret"), "fresh");
    await userEvent.click(
      within(dialog).getByRole("button", { name: pt["detail.save"] }),
    );
    expect(
      await within(dialog).findByText(pt["problem.aggregator_unauthorized"]),
    ).toBeVisible();
    refuse = false;
    await userEvent.click(
      within(dialog).getByRole("button", { name: pt["detail.save"] }),
    );
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull();
    });
    expect(sent.map((s) => s.body)).toEqual([
      { client_id: "new", client_secret: "fresh" },
      { client_id: "new", client_secret: "fresh" },
    ]);
  });

  it("names the connections that block a delete", async () => {
    await renderApp("/settings", {
      fetch: api([], { remove: () => problem(409, "integration_in_use") }),
    });
    const view = await section(pt["settings.integrations.title"]);
    await userEvent.click(
      await view.findByRole("button", {
        name: pt["settings.integrations.delete"],
      }),
    );
    const dialog = await screen.findByRole("dialog");
    await userEvent.click(
      within(dialog).getByRole("button", {
        name: pt["settings.integrations.delete"],
      }),
    );
    expect(
      await within(dialog).findByText(pt["problem.integration_in_use"]),
    ).toBeVisible();
    expect(within(dialog).getByText("Itaú")).toBeVisible();
    expect(within(dialog).getByText("Nubank")).toBeVisible();
    expect(within(dialog).queryByText("Other")).toBeNull();
  });

  it("deletes an integration and words the section in English for another region", async () => {
    const sent: Sent[] = [];
    await renderApp("/settings", {
      fetch: api(sent, {
        locale: { language: "en", region: "DE", currency: "EUR" },
      }),
    });
    const view = await section(en["settings.integrations.title"]);
    await userEvent.click(
      await view.findByRole("button", {
        name: en["settings.integrations.delete"],
      }),
    );
    const dialog = await screen.findByRole("dialog");
    await userEvent.click(
      within(dialog).getByRole("button", {
        name: en["settings.integrations.delete"],
      }),
    );
    await waitFor(() => {
      expect(sent).toEqual([{ route: "DELETE", body: null }]);
    });
  });
});
