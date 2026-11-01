import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { SettingsBooksName } from "@/features/setup/settings-books-name";
import { fakeApi, json } from "@/testing/fake-api";
import { renderWithProviders } from "@/testing/render-app";

const books = {
  name: "Cassa",
  region: "BR",
  time_zone: null,
  default_time_zone: "America/Sao_Paulo",
};

function api(bodies: unknown[]) {
  return fakeApi({
    "GET /api/v1/me": () =>
      json(200, { id: 1, email: "a@b.c", language: "en", region: "BR" }),
    "GET /api/v1/books/current": () => json(200, books),
    "PATCH /api/v1/books/current": async (req: Request) => {
      bodies.push(await req.json());
      return json(200, books);
    },
  });
}

describe("SettingsBooksName", () => {
  it("sends the corrected name with the region and the time zone", async () => {
    const bodies: unknown[] = [];
    renderWithProviders(<SettingsBooksName />, { fetch: api(bodies) });

    const field = await screen.findByRole("textbox", { name: "Name" });
    expect(field).toHaveValue("Cassa");
    await userEvent.clear(field);
    await userEvent.type(field, "Casa");
    await userEvent.tab();

    await waitFor(() => {
      expect(bodies).toEqual([{ name: "Casa", region: "BR", time_zone: null }]);
    });
  });

  it("sends nothing when the name is unchanged or empty", async () => {
    const bodies: unknown[] = [];
    renderWithProviders(<SettingsBooksName />, { fetch: api(bodies) });

    const field = await screen.findByRole("textbox", { name: "Name" });
    await userEvent.click(field);
    await userEvent.tab();
    await userEvent.clear(field);
    await userEvent.tab();

    expect(bodies).toEqual([]);
    expect(field).toHaveValue("Cassa");
  });
});
