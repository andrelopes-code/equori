import { screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { components } from "@/api/schema.gen";
import { ConnectionStateAlert } from "@/features/accounts/connection-state-alert";
import { renderWithProviders } from "@/testing/render-app";

type Connection = components["schemas"]["Connection"];

const base = { portal: "Nubank app" } as Connection;

function show(connection: Partial<Connection>) {
  return renderWithProviders(
    <ConnectionStateAlert connection={{ ...base, ...connection }} />,
    { fetch: vi.fn<typeof fetch>() },
  );
}

describe("ConnectionStateAlert", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("names the hours of a stalled connection and the portal", () => {
    vi.useFakeTimers({ now: new Date("2026-11-12T12:00:00Z") });

    show({
      state: "stalled",
      last_item_update_at: "2026-11-09T11:00:00Z",
      last_synced_at: "2026-11-12T12:00:00Z",
    });

    expect(
      screen.getByText(
        "The bank has sent no new data for 73 hours. Sync again; if it stays this way, check the connection at Nubank app.",
      ),
    ).toBeInTheDocument();
  });

  it("names the date of an expiring consent and the portal", () => {
    show({
      state: "consent_expiring",
      consent_expires_at: "2026-11-25T12:00:00Z",
    });

    expect(
      screen.getByText(
        "The consent of this connection expires on 11/25/2026. Renew it at Nubank app so syncs continue.",
      ),
    ).toBeInTheDocument();
  });

  it("asks the owner to act at the aggregator", () => {
    show({ state: "needs_owner" });

    expect(
      screen.getByText(/waits for an action only the owner can take/),
    ).toBeInTheDocument();
  });

  it("renders nothing for an ok connection", () => {
    const { container } = show({ state: "ok" });

    expect(container).toBeEmptyDOMElement();
  });
});
