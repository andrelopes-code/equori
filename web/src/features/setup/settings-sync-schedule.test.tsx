import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { SettingsSyncSchedule } from "@/features/setup/settings-sync-schedule";
import { fakeApi, json } from "@/testing/fake-api";
import { renderWithProviders } from "@/testing/render-app";

function api(role: string, bodies: unknown[] = []) {
  return fakeApi({
    "GET /api/v1/me": () =>
      json(200, { id: 1, email: "a@b.c", role, language: "en", region: "BR" }),
    "GET /api/v1/ingestion/sync-schedule": () => json(200, { minutes: 60 }),
    "PUT /api/v1/ingestion/sync-schedule": async (req: Request) => {
      const body: unknown = await req.json();
      bodies.push(body);
      return json(200, body);
    },
  });
}

describe("SettingsSyncSchedule", () => {
  it("lets an admin choose the interval", async () => {
    const bodies: unknown[] = [];
    renderWithProviders(<SettingsSyncSchedule />, {
      fetch: api("admin", bodies),
    });

    const field = await screen.findByRole("combobox", {
      name: "Check for new data",
    });
    await waitFor(() => {
      expect(field).toHaveTextContent("1 hour");
    });
    await userEvent.click(field);
    await userEvent.click(
      await screen.findByRole("option", { name: "15 minutes" }),
    );

    await waitFor(() => {
      expect(bodies).toEqual([{ minutes: 15 }]);
    });
  });

  it("shows a member the interval without a way to change it", async () => {
    renderWithProviders(<SettingsSyncSchedule />, { fetch: api("member") });

    const field = await screen.findByRole("combobox", {
      name: "Check for new data",
    });
    await waitFor(() => {
      expect(field).toHaveTextContent("1 hour");
    });

    expect(field).toHaveAttribute("aria-readonly", "true");
  });
});
