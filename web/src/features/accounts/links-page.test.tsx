import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { catalogEn } from "@/i18n/catalog.en";
import {
  accountFixtures,
  accountRoutes,
  connectionFixture,
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
          problem(502, "provider_unauthorized"),
      }),
    });
    await userEvent.click(
      await screen.findByRole("button", {
        name: words("links.syncOf", { name: connectionFixture.name }),
      }),
    );
    expect(
      await screen.findByText(catalogEn["problem.provider_unauthorized"]),
    ).toBeInTheDocument();
  });
});
