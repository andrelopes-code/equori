import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { SettingsBirthDate } from "@/features/setup/account/settings-birth-date";
import { fakeApi, json } from "@/testing/fake-api";
import { renderWithProviders } from "@/testing/render-app";

describe("SettingsBirthDate", () => {
  it("PJ6: writes the birth date chosen to the profile", async () => {
    const bodies: unknown[] = [];
    renderWithProviders(<SettingsBirthDate />, { fetch: api(bodies) });
    await screen.findByText("Birth date");
    const [month = document.body, day = document.body, year = document.body] =
      screen.getAllByRole("spinbutton");

    await userEvent.type(month, "03");
    await userEvent.type(day, "10");
    await userEvent.type(year, "1994");

    await waitFor(() => {
      expect(bodies).toEqual([{ birth_date: "1994-03-10" }]);
    });
  });
});

function api(bodies: unknown[]) {
  const me = { id: 1, email: "a@b.c", language: "en", region: "BR" };

  return fakeApi({
    "GET /api/v1/me": () => json(200, me),
    "PATCH /api/v1/me": async (req: Request) => {
      const body = (await req.json()) as Record<string, unknown>;
      bodies.push(body);

      return json(200, { ...me, ...body });
    },
  });
}
