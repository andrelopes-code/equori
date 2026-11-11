import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";

import { BookColourSection } from "@/features/setup/colours/book-colour-section";
import { settingsEn } from "@/i18n/catalog-settings.en";
import { fakeApi, json } from "@/testing/fake-api";
import { renderWithProviders } from "@/testing/render-app";

describe("BookColourSection", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("draws nothing for a member of one book", async () => {
    let asked = false;
    const fetch = fakeApi({
      "GET /api/v1/me/books": () => {
        asked = true;
        return json(200, {
          items: [{ id: 7, name: "Casa", role: "write", active: true }],
        });
      },
    });
    renderWithProviders(<BookColourSection />, { fetch });

    await waitFor(() => {
      expect(asked).toBe(true);
    });

    expect(screen.queryByRole("radiogroup", { name: "Casa" })).toBeNull();
    expect(screen.queryByText(settingsEn["studio.bookColour"])).toBeNull();
  });

  it("stores and clears the accent of one book", async () => {
    renderWithProviders(<BookColourSection />, {
      fetch: booksApi([
        { id: 7, name: "Casa", role: "write", active: true },
        { id: 9, name: "Empresa", role: "write", active: false },
      ]),
    });
    expect(
      await screen.findByRole("radiogroup", { name: "Casa" }),
    ).toBeInTheDocument();
    const group = screen.getByRole("radiogroup", { name: "Empresa" });

    await userEvent.click(
      within(group).getByRole("radio", { name: "Emerald" }),
    );

    expect(localStorage.getItem("equori.bookAccents")).toBe('{"9":"emerald"}');

    await userEvent.click(
      within(group).getByRole("radio", {
        name: settingsEn["studio.bookColour.theme"],
      }),
    );

    expect(localStorage.getItem("equori.bookAccents")).toBe("{}");
  });
});

function booksApi(items: unknown[]) {
  return fakeApi({ "GET /api/v1/me/books": () => json(200, { items }) });
}
