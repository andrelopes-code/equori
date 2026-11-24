import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { launchPluggy } from "@/features/accounts/connect/pluggy-launcher";
import { catalogEn as en } from "@/i18n/catalog.en";
import {
  accountRoutes,
  connectionFixture,
  connectionID,
  externalReservedID,
} from "@/testing/account-api";
import { fakeApi, json, problem } from "@/testing/fake-api";
import { renderApp } from "@/testing/render-app";

vi.mock("@/features/accounts/connect/pluggy-launcher", () => ({
  launchPluggy: vi.fn(),
}));

type Route = (req: Request) => Response | Promise<Response>;

const integrationID = connectionFixture.integration_id;
const itemID = "item-2";
const integration = {
  id: integrationID,
  aggregator: "pluggy",
  name: "Personal",
  updated_at: "2026-10-10T12:00:00Z",
};

function api(sent: unknown[], overrides: Record<string, Route> = {}) {
  return fakeApi(
    accountRoutes({
      "GET /api/v1/integrations": () => json(200, { items: [integration] }),
      [`POST /api/v1/integrations/${integrationID}/connect-token`]: () =>
        json(200, { token: "token-1" }),
      "POST /api/v1/connections": async (req) => {
        sent.push(await req.json());
        return json(201, connectionFixture);
      },
      ...overrides,
    }),
  );
}

async function open() {
  await userEvent.click(
    await screen.findByRole("button", { name: en["links.connect"] }),
  );
  return within(await screen.findByRole("dialog"));
}

async function connect(name = "Itaú") {
  const dialog = await open();
  await userEvent.type(
    dialog.getByRole("textbox", { name: en["links.connect.bank"] }),
    name,
  );
  await userEvent.click(
    dialog.getByRole("button", { name: en["links.connect.start"] }),
  );
}

describe("Connect a bank", () => {
  beforeEach(() => {
    vi.mocked(launchPluggy).mockReset();
  });

  it("registers the item the aggregator's dialog answers and lists its accounts", async () => {
    const sent: unknown[] = [];
    vi.mocked(launchPluggy).mockResolvedValue(itemID);
    await renderApp("/accounts/links", { fetch: api(sent) });

    await connect();

    const done = within(await screen.findByRole("dialog", { name: /Nubank/ }));
    expect(done.getByText("Caixinha Viagem")).toBeVisible();
    expect(launchPluggy).toHaveBeenCalledWith("token-1", "en");
    expect(sent).toEqual([
      { integration_id: integrationID, external_id: itemID, name: "Itaú" },
    ]);
  });

  it("opens the link of the first account that waits for one", async () => {
    vi.mocked(launchPluggy).mockResolvedValue(itemID);
    const { router } = await renderApp("/accounts/links", { fetch: api([]) });

    await connect();
    await userEvent.click(
      await screen.findByRole("button", { name: en["links.connect.link"] }),
    );

    await waitFor(() => {
      expect(router.state.location.search).toEqual({
        external: externalReservedID,
        connection: connectionID,
      });
    });
  });

  it("registers nothing when the aggregator's dialog closes without a bank", async () => {
    const sent: unknown[] = [];
    vi.mocked(launchPluggy).mockResolvedValue(null);
    await renderApp("/accounts/links", { fetch: api(sent) });

    await connect();

    expect(
      await screen.findByRole("textbox", { name: en["links.connect.bank"] }),
    ).toHaveValue("Itaú");
    expect(sent).toEqual([]);
  });

  it("keeps the item when the registration fails and sends it again", async () => {
    const sent: unknown[] = [];
    let failures = 1;
    vi.mocked(launchPluggy).mockResolvedValue(itemID);
    await renderApp("/accounts/links", {
      fetch: api(sent, {
        "POST /api/v1/connections": async (req) => {
          sent.push(await req.json());
          if (failures > 0) {
            failures -= 1;
            return problem(502, "aggregator_unavailable");
          }
          return json(201, connectionFixture);
        },
      }),
    });

    await connect();
    await userEvent.click(
      await screen.findByRole("button", { name: en["links.connect.retry"] }),
    );

    await screen.findByRole("button", { name: en["links.connect.link"] });
    expect(sent).toHaveLength(2);
    expect(launchPluggy).toHaveBeenCalledTimes(1);
  });

  it("leads to the credentials when there is no integration", async () => {
    await renderApp("/accounts/links", {
      fetch: api([], {
        "GET /api/v1/integrations": () => json(200, { items: [] }),
      }),
    });

    const dialog = await open();

    expect(await dialog.findByText(en["links.connect.setup"])).toBeVisible();
    expect(
      dialog.getByRole("button", { name: en["links.connect.setupAction"] }),
    ).toBeVisible();
  });

  it("offers no start for an aggregator without a dialog of its own", async () => {
    await renderApp("/accounts/links", {
      fetch: api([], {
        "GET /api/v1/integrations": () =>
          json(200, { items: [{ ...integration, aggregator: "other" }] }),
      }),
    });

    const dialog = await open();

    expect(
      await dialog.findByText(en["links.connect.unsupported"]),
    ).toBeVisible();
    expect(
      dialog.queryByRole("button", { name: en["links.connect.start"] }),
    ).toBeNull();
  });
});
