import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SyncStatus } from "@/features/connections";
import { fakeApi, json, problem } from "@/testing/fake-api";
import { renderWithProviders } from "@/testing/render-app";

function connection(
  id: string,
  lastSyncedAt?: string,
  item: { last_item_update_at?: string; next_item_update_at?: string } = {},
) {
  return {
    ...item,
    id,
    integration_id: "00000000-0000-0000-0000-000000000001",
    external_id: `item-${id}`,
    name: `Bank ${id}`,
    provider_status: "UPDATED",
    created_at: "2026-10-01T10:00:00Z",
    accounts: [],
    ...(lastSyncedAt === undefined ? {} : { last_synced_at: lastSyncedAt }),
  };
}

function renderStatus(
  response: Response,
  accounts: Response = json(200, { items: [] }),
) {
  const fetch = fakeApi({
    "GET /api/v1/connections": () => response,
    "GET /api/v1/accounts": () => accounts,
  });
  return renderWithProviders(<SyncStatus />, { fetch, today: "2026-10-16" });
}

// Times are local, so the test pins the zone.
describe("SyncStatus", () => {
  beforeEach(() => {
    vi.stubEnv("TZ", "UTC");
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("shows the time of the latest sync of the day", async () => {
    renderStatus(
      json(200, {
        items: [
          connection("1", "2026-10-16T08:05:00Z"),
          connection("2", "2026-10-16T09:37:00Z"),
        ],
      }),
    );
    expect(
      await screen.findByText("Open Finance updated at 09:37"),
    ).toBeInTheDocument();
  });

  it("shows the date of a sync before today", async () => {
    renderStatus(
      json(200, { items: [connection("1", "2026-10-14T21:00:00Z")] }),
    );
    expect(
      await screen.findByText("Open Finance updated at Oct 14"),
    ).toBeInTheDocument();
  });

  // A95: the panel tells when each bank's data was fetched by the aggregator, when the app
  // read it and when the aggregator fetches it next.
  it("opens the update times of each connection", async () => {
    renderStatus(
      json(200, {
        items: [
          connection("1", "2026-10-16T09:37:00Z", {
            last_item_update_at: "2026-10-16T09:20:00Z",
            next_item_update_at: "2026-10-17T11:07:00Z",
          }),
          connection("2", "2026-10-15T08:05:00Z"),
        ],
      }),
    );
    await userEvent.click(
      await screen.findByRole("button", {
        name: "Open Finance updated at 09:37",
      }),
    );
    const panel = await screen.findByRole("dialog", { name: "Open Finance" });
    const first = within(panel).getByRole("region", { name: "Bank 1" });
    expect(
      within(first).getByText("Bank data from").nextSibling,
    ).toHaveTextContent("09:20");
    expect(
      within(first).getByText("Read by the app").nextSibling,
    ).toHaveTextContent("09:37");
    expect(
      within(first).getByText("Next bank fetch").nextSibling,
    ).toHaveTextContent("Oct 17, 11:07");
    const second = within(panel).getByRole("region", { name: "Bank 2" });
    expect(
      within(second).getByText("Read by the app").nextSibling,
    ).toHaveTextContent("Oct 15, 08:05");
    expect(
      within(second).getByText("Next bank fetch").nextSibling,
    ).toHaveTextContent("Not reported");
  });

  // A connection is titled by the ledger accounts it feeds: a Meu Pluggy item reports the
  // connector's name, not the bank's.
  it("titles a connection by its mapped accounts", async () => {
    const mapped = (id: string, accountID: string) => ({
      id,
      type: "BANK",
      subtype: "CHECKING_ACCOUNT",
      name: `External ${id}`,
      currency: "BRL",
      state: "mapped",
      account_id: accountID,
      sync_from: "2026-07-01",
    });
    const account = (id: string, name: string) => ({
      id,
      name,
      class: "asset",
      currency: "BRL",
      opened_on: "2026-06-01",
      yield_mode: "none",
    });
    renderStatus(
      json(200, {
        items: [
          {
            ...connection("1", "2026-10-16T09:37:00Z"),
            name: "MeuPluggy",
            accounts: [mapped("x1", "a1"), mapped("x2", "a2")],
          },
        ],
      }),
      json(200, {
        items: [account("a1", "Nubank"), account("a2", "Nubank Gold")],
      }),
    );
    await userEvent.click(
      await screen.findByRole("button", {
        name: "Open Finance updated at 09:37",
      }),
    );
    const panel = await screen.findByRole("dialog", { name: "Open Finance" });
    expect(
      await within(panel).findByRole("region", { name: "Nubank, Nubank Gold" }),
    ).toBeInTheDocument();
  });

  it("renders nothing without a synced connection", async () => {
    const { container } = renderStatus(
      json(200, { items: [connection("1"), connection("2")] }),
    );
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(container).toBeEmptyDOMElement();
  });

  it("renders nothing when the list fails", async () => {
    const { container } = renderStatus(problem(409, "integration_unavailable"));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(container).toBeEmptyDOMElement();
  });
});
