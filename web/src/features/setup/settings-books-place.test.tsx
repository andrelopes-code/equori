import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { SettingsBooksPlace } from "@/features/setup/settings-books-place";
import { fakeApi, json, problem } from "@/testing/fake-api";
import { renderWithProviders } from "@/testing/render-app";

const books = {
  region: "BR",
  time_zone: null,
  default_time_zone: "America/Sao_Paulo",
};

function api(
  bodies: unknown[],
  patch: () => Response = () => json(200, books),
) {
  return fakeApi({
    "GET /api/v1/me": () =>
      json(200, { id: 1, email: "a@b.c", language: "en", region: "BR" }),
    "GET /api/v1/books/current": () => json(200, books),
    "PATCH /api/v1/books/current": async (req: Request) => {
      bodies.push(await req.json());
      return patch();
    },
  });
}

describe("SettingsBooksPlace", () => {
  it("shows the region default as the time zone", async () => {
    renderWithProviders(<SettingsBooksPlace />, { fetch: api([]) });

    expect(
      await screen.findByRole("combobox", { name: "Time zone" }),
    ).toHaveTextContent("Region default (America/Sao_Paulo)");
  });

  it("sends the chosen time zone with the region", async () => {
    const bodies: unknown[] = [];
    renderWithProviders(<SettingsBooksPlace />, { fetch: api(bodies) });

    await userEvent.click(
      await screen.findByRole("combobox", { name: "Time zone" }),
    );
    await userEvent.click(
      await screen.findByRole("option", { name: "Asia/Tokyo" }),
    );

    await waitFor(() => {
      expect(bodies).toEqual([{ region: "BR", time_zone: "Asia/Tokyo" }]);
    });
  });

  it("shows the refusal of the time zone under the field", async () => {
    renderWithProviders(<SettingsBooksPlace />, {
      fetch: api([], () => problem(422, "time_zone_invalid")),
    });

    await userEvent.click(
      await screen.findByRole("combobox", { name: "Time zone" }),
    );
    await userEvent.click(
      await screen.findByRole("option", { name: "Asia/Tokyo" }),
    );

    expect(
      await screen.findByText("The time zone is not an IANA time zone name."),
    ).toBeVisible();
  });
});
