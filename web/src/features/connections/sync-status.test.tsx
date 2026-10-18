import { screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SyncStatus } from "@/features/connections";
import { fakeApi, json, problem } from "@/testing/fake-api";
import { renderWithProviders } from "@/testing/render-app";

function connection(id: string, lastSyncedAt?: string) {
  return {
    id,
    integration_id: "00000000-0000-0000-0000-000000000001",
    item_id: `item-${id}`,
    name: `Bank ${id}`,
    provider_status: "UPDATED",
    created_at: "2026-10-01T10:00:00Z",
    accounts: [],
    ...(lastSyncedAt === undefined ? {} : { last_synced_at: lastSyncedAt }),
  };
}

function renderStatus(response: Response) {
  const fetch = fakeApi({ "GET /api/v1/connections": () => response });
  return renderWithProviders(<SyncStatus />, { fetch, today: "2026-10-16" });
}

// Ledger sheet decision L6. Times are local, so the test pins the zone.
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
