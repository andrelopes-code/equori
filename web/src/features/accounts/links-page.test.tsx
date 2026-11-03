import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { catalogEn } from "@/i18n/catalog.en";
import { formatDate } from "@/i18n/format";
import {
  accountFixtures,
  accountRoutes,
  connectionFixture,
  checkingID,
  connectionID,
  externalReservedID,
  reserveID,
} from "@/testing/account-api";
import { fakeApi, json, problem } from "@/testing/fake-api";
import { renderApp } from "@/testing/render-app";

type Route = (req: Request) => Response | Promise<Response>;

function api(
  log: { route: string; body?: unknown }[],
  overrides: Record<string, Route> = {},
) {
  return fakeApi(
    accountRoutes({
      [`PUT /api/v1/connections/${connectionID}/accounts/${externalReservedID}`]:
        async (req) => {
          log.push({ route: "map reserved", body: await req.json() });
          return json(200, {});
        },
      ...overrides,
    }),
  );
}

const syncRuns = {
  items: [
    {
      sync_id: "f1000000-0000-4000-8000-000000000001",
      started_at: "2026-10-17T07:00:00Z",
      batches: [
        {
          id: "e1000000-0000-4000-8000-000000000002",
          account_id: checkingID,
          source: "aggregator",
          counts: {
            received: 2,
            ignored: 0,
            matched: 0,
            created: 1,
            needs_review: 0,
            discarded: 0,
            updated: 0,
            withdrawn: 1,
            re_identified: 0,
          },
          balance: {},
          started_at: "2026-10-17T07:00:00Z",
        },
      ],
      records: [
        {
          id: "r1",
          date: "2026-10-16",
          description: "Uber",
          state: "withdrawn",
          decision: "withdrawn",
          amount: { amount: -4500, currency: "BRL" },
        },
        {
          id: "r2",
          date: "2026-10-16",
          description: "Padaria",
          state: "created",
          amount: { amount: -1200, currency: "BRL" },
        },
      ],
    },
  ],
};

function words(key: keyof typeof catalogEn, values: Record<string, string>) {
  return Object.entries(values).reduce<string>(
    (text, [k, v]) => text.replace(`{${k}}`, v),
    catalogEn[key],
  );
}

async function row(name: string) {
  const table = await screen.findByRole("table", {
    name: connectionFixture.name,
  });
  return within(table).findByRole("row", { name: new RegExp(name) });
}

describe("Account links", () => {
  it("lists each external account with what it feeds", async () => {
    await renderApp("/accounts/links", { fetch: api([]) });
    const linked = await row("Conta Corrente");
    expect(
      within(linked).getByText(
        words("links.state.mapped", { account: "Nubank" }),
      ),
    ).toBeInTheDocument();
    const pending = await row("Caixinha Viagem");
    expect(
      within(pending).getByText(catalogEn["links.state.pending"]),
    ).toBeInTheDocument();
  });

  it("links an external account to a compatible account from a start date", async () => {
    const log: { route: string; body?: unknown }[] = [];
    await renderApp("/accounts/links", { fetch: api(log) });
    await userEvent.click(
      within(await row("Caixinha Viagem")).getByRole("button", {
        name: catalogEn["links.link"],
      }),
    );
    const drawer = await screen.findByRole("dialog");
    await userEvent.click(
      within(drawer).getByRole("radio", { name: /Reserva de emergência/ }),
    );
    await userEvent.click(
      within(drawer).getByRole("button", { name: catalogEn["links.confirm"] }),
    );
    await waitFor(() => {
      expect(log).toEqual([
        {
          route: "map reserved",
          body: { account_id: reserveID, sync_from: "2026-09-01" },
        },
      ]);
    });
  });

  it("marks the start date of the link as required", async () => {
    await renderApp("/accounts/links", { fetch: api([]) });
    await userEvent.click(
      within(await row("Caixinha Viagem")).getByRole("button", {
        name: catalogEn["links.link"],
      }),
    );

    const drawer = within(await screen.findByRole("dialog"));
    expect(drawer.getByText(catalogEn["sync.from"])).toBeVisible();
    expect(drawer.queryByText(/optional/i)).toBeNull();
  });

  it("offers only a new account when nothing compatible exists", async () => {
    await renderApp("/accounts/links", {
      fetch: api([], {
        "GET /api/v1/accounts": () =>
          json(200, {
            items: accountFixtures.filter(
              (a) => !("kind" in a) || a.kind !== "reserve",
            ),
          }),
      }),
    });
    await userEvent.click(
      within(await row("Caixinha Viagem")).getByRole("button", {
        name: catalogEn["links.link"],
      }),
    );
    const drawer = await screen.findByRole("dialog");
    expect(within(drawer).queryByRole("radio")).not.toBeInTheDocument();
    expect(
      within(drawer).getByText(catalogEn["links.noCandidate"]),
    ).toBeInTheDocument();
    expect(
      within(drawer).getByRole("button", {
        name: catalogEn["links.createAccount"],
      }),
    ).toBeInTheDocument();
  });

  it("creates an account with the external account's kind and name", async () => {
    const { router } = await renderApp("/accounts/links", {
      fetch: api([], {
        "GET /api/v1/accounts": () =>
          json(200, {
            items: accountFixtures.filter(
              (a) => !("kind" in a) || a.kind !== "reserve",
            ),
          }),
      }),
    });
    await userEvent.click(
      within(await row("Caixinha Viagem")).getByRole("button", {
        name: catalogEn["links.link"],
      }),
    );
    await userEvent.click(
      within(await screen.findByRole("dialog")).getByRole("button", {
        name: catalogEn["links.createAccount"],
      }),
    );
    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/accounts/new");
    });
    expect(router.state.location.search).toMatchObject({
      kind: "reserve",
      name: "Caixinha Viagem",
      return: "links",
      external: externalReservedID,
      connection: connectionID,
    });
  });

  it("opens the link again with the account just created", async () => {
    await renderApp(
      `/accounts/links?account=${reserveID}&external=${externalReservedID}&connection=${connectionID}`,
      { fetch: api([]) },
    );
    const drawer = await screen.findByRole("dialog");
    expect(
      within(drawer).getByRole("radio", { name: /Reserva de emergência/ }),
    ).toBeChecked();
  });

  it("leaves an external account out of the syncs", async () => {
    const log: { route: string; body?: unknown }[] = [];
    await renderApp("/accounts/links", { fetch: api(log) });
    await userEvent.click(
      within(await row("Caixinha Viagem")).getByRole("button", {
        name: catalogEn["links.ignore"],
      }),
    );
    await waitFor(() => {
      expect(log).toEqual([{ route: "map reserved", body: { ignored: true } }]);
    });
  });

  it("states a refusal of the provider on its connection", async () => {
    await renderApp("/accounts/links", {
      fetch: api([], {
        [`POST /api/v1/connections/${connectionID}/sync`]: () =>
          problem(502, "aggregator_unauthorized"),
      }),
    });
    await userEvent.click(
      await screen.findByRole("button", {
        name: words("links.syncOf", { name: connectionFixture.name }),
      }),
    );
    expect(
      await screen.findByText(catalogEn["problem.aggregator_unauthorized"]),
    ).toBeInTheDocument();
  });
  it("states the connection with its provider, bank update, sync and each account's dates", async () => {
    await renderApp("/accounts/links", { fetch: api([]) });
    const detail = await screen.findByRole("region", {
      name: connectionFixture.name,
    });
    expect(
      within(detail).getByText(catalogEn["links.connectionState.ok"]),
    ).toBeVisible();
    expect(
      within(detail).getByText(catalogEn["sync.provider.UPDATED"]),
    ).toBeVisible();
    for (const term of [
      "sync.bankData",
      "sync.appRead",
      "sync.nextFetch",
    ] as const) {
      expect(within(detail).getByText(catalogEn[term])).toBeVisible();
    }
    const linked = await row("Conta Corrente");
    expect(
      within(linked).getByText(formatDate("2026-09-01", "en")),
    ).toBeVisible();
    expect(
      within(linked).getByText(formatDate("2026-10-17", "en")),
    ).toBeVisible();
    const pending = await row("Caixinha Viagem");
    expect(within(pending).getAllByText(catalogEn["sync.never"])).toHaveLength(
      2,
    );
  });

  it("asks the owner to act at the aggregator when the connection needs the owner", async () => {
    await renderApp("/accounts/links", {
      fetch: api([], {
        "GET /api/v1/connections": () =>
          json(200, {
            items: [
              {
                ...connectionFixture,
                state: "needs_owner",
                provider_status: "WAITING_USER_INPUT",
              },
            ],
          }),
      }),
    });
    expect(
      await screen.findByText(catalogEn["links.connectionState.needs_owner"]),
    ).toBeVisible();
    expect(
      await screen.findByText(catalogEn["links.needsOwner"]),
    ).toBeVisible();
  });

  // The portal is the aggregator's to name: the catalog holds no aggregator's site, so an
  // aggregator without one reads with a neutral phrase.
  it.each([
    ["Acme Hub", "Waiting for you in Acme Hub"],
    [undefined, "Waiting for you in the connection's site"],
  ])("sends the owner to the portal %s", async (portal, text) => {
    await renderApp("/accounts/links", {
      fetch: api([], {
        "GET /api/v1/connections": () =>
          json(200, {
            items: [
              {
                ...connectionFixture,
                state: "needs_owner",
                provider_status: "WAITING_USER_INPUT",
                portal,
              },
            ],
          }),
      }),
    });

    expect(await screen.findByText(text)).toBeVisible();
  });

  it("links each batch a sync produced to its import page", async () => {
    const batch = {
      id: "e1000000-0000-4000-8000-000000000001",
      account_id: checkingID,
      source: "aggregator",
      counts: {},
      balance: {},
      started_at: "2026-10-17T07:00:00Z",
    };
    await renderApp("/accounts/links", {
      fetch: api([], {
        [`POST /api/v1/connections/${connectionID}/sync`]: () =>
          json(200, { connection: connectionFixture, batches: [batch] }),
      }),
    });
    await userEvent.click(
      await screen.findByRole("button", {
        name: words("links.syncOf", { name: connectionFixture.name }),
      }),
    );
    const link = await screen.findByRole("link", {
      name: words("links.batch", { account: "Nubank" }),
    });
    expect(link).toHaveAttribute(
      "href",
      `/accounts/${checkingID}/imports/${batch.id}`,
    );
  });

  it("lists the recent syncs of a connection and undoes a decision", async () => {
    const log: { route: string }[] = [];
    await renderApp("/accounts/links", {
      fetch: api(log, {
        [`GET /api/v1/connections/${connectionID}/syncs`]: () =>
          json(200, syncRuns),
        "POST /api/v1/external-records/r1/undo": () => {
          log.push({ route: "undo r1" });
          return json(200, {
            ...syncRuns.items[0]?.records[0],
            state: "created",
          });
        },
      }),
    });

    expect(
      screen.queryByRole("table", { name: /Lines of the sync of/ }),
    ).toBeNull();
    await userEvent.click(
      await screen.findByRole("button", { name: /Recent syncs/ }),
    );
    const syncs = await screen.findByRole("table", { name: "Recent syncs" });
    const row = within(syncs).getByRole("row", { name: /Nubank/ });
    expect(within(row).getByText("Created: 1")).toBeVisible();
    expect(within(row).getByText("Withdrawn: 1")).toBeVisible();
    expect(screen.queryByRole("button", { name: "Undo Padaria" })).toBeNull();
    const table = await screen.findByRole("table", {
      name: /Lines of the sync of/,
    });
    expect(
      within(table).getByRole("cell", { name: "Withdrawn" }),
    ).toBeVisible();
    expect(within(table).getByRole("cell", { name: "Created" })).toBeVisible();

    await userEvent.click(screen.getByRole("button", { name: "Undo Uber" }));

    await waitFor(() => {
      expect(log).toEqual([{ route: "undo r1" }]);
    });
  });

  it("says why a decision cannot be undone", async () => {
    await renderApp("/accounts/links", {
      fetch: api([], {
        [`GET /api/v1/connections/${connectionID}/syncs`]: () =>
          json(200, syncRuns),
        "POST /api/v1/external-records/r1/undo": () =>
          problem(409, "no_decision"),
      }),
    });

    await userEvent.click(
      await screen.findByRole("button", { name: /Recent syncs/ }),
    );
    await userEvent.click(
      await screen.findByRole("button", { name: "Undo Uber" }),
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      catalogEn["problem.no_decision"],
    );
  });

  it("deletes a connection after saying what stays", async () => {
    const log: { route: string; body?: unknown }[] = [];
    await renderApp("/accounts/links", {
      fetch: api(log, {
        "GET /api/v1/me": () =>
          json(200, {
            id: 1,
            email: "a@b.c",
            role: "admin",
            language: "en",
            region: "DE",
          }),
        "GET /api/v1/settings": () => json(200, { base_currency: "EUR" }),
        [`DELETE /api/v1/connections/${connectionID}`]: () => {
          log.push({ route: "delete" });
          return new Response(null, { status: 204 });
        },
      }),
    });
    await userEvent.click(
      await screen.findByRole("button", {
        name: words("links.deleteOf", { name: connectionFixture.name }),
      }),
    );
    const dialog = await screen.findByRole("dialog");
    expect(
      within(dialog).getByText(catalogEn["links.deleteHint"]),
    ).toBeVisible();
    await userEvent.click(
      within(dialog).getByRole("button", {
        name: catalogEn["links.deleteConfirm"],
      }),
    );
    await waitFor(() => {
      expect(log).toEqual([{ route: "delete" }]);
    });
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull();
    });
  });
});
