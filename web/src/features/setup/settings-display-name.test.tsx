import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { SettingsDisplayName } from "@/features/setup/settings-display-name";
import { fakeApi, json } from "@/testing/fake-api";
import { renderWithProviders } from "@/testing/render-app";

function api(me: Record<string, unknown>, bodies: unknown[]) {
  return fakeApi({
    "GET /api/v1/me": () =>
      json(200, { id: 1, email: "a@b.c", language: "en", region: "BR", ...me }),
    "PATCH /api/v1/me": async (req: Request) => {
      const body = (await req.json()) as Record<string, unknown>;
      bodies.push(body);
      return json(200, {
        id: 1,
        email: "a@b.c",
        language: "en",
        region: "BR",
        ...body,
      });
    },
  });
}

describe("SettingsDisplayName", () => {
  it("sends the trimmed name when the field loses focus", async () => {
    const bodies: unknown[] = [];
    renderWithProviders(<SettingsDisplayName />, { fetch: api({}, bodies) });

    const field = await screen.findByRole("textbox", { name: "Display name" });
    expect(field).toHaveValue("");
    await userEvent.type(field, "  Ann Lee  ");
    await userEvent.tab();

    await waitFor(() => {
      expect(bodies).toEqual([{ display_name: "Ann Lee" }]);
    });
  });

  it("sends an empty name to clear a stored one", async () => {
    const bodies: unknown[] = [];
    renderWithProviders(<SettingsDisplayName />, {
      fetch: api({ display_name: "Ann" }, bodies),
    });

    const field = await screen.findByRole("textbox", { name: "Display name" });
    expect(field).toHaveValue("Ann");
    await userEvent.clear(field);
    await userEvent.tab();

    await waitFor(() => {
      expect(bodies).toEqual([{ display_name: "" }]);
    });
  });

  it("sends nothing when the name is unchanged", async () => {
    const bodies: unknown[] = [];
    renderWithProviders(<SettingsDisplayName />, {
      fetch: api({ display_name: "Ann" }, bodies),
    });

    const field = await screen.findByRole("textbox", { name: "Display name" });
    await userEvent.click(field);
    await userEvent.tab();

    expect(bodies).toEqual([]);
  });
});
