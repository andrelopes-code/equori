import { fireEvent, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";

import { catalogPtBR } from "@/i18n/catalog.pt-BR";
import { fakeApi, json } from "@/testing/fake-api";
import { renderApp } from "@/testing/render-app";
import { resetAppearance } from "@/theme/appearance";
import { exportTheme } from "@/theme/theme-file";
import { curatedThemes } from "@/theme/themes";

describe("appearance studio", () => {
  beforeEach(() => {
    localStorage.clear();
    resetAppearance();
  });

  it("applies a curated theme and marks it as the current one", async () => {
    await renderApp("/settings?section=appearance", { fetch: api() });
    const gallery = await screen.findByRole("radiogroup", {
      name: catalogPtBR["settings.theme.gallery"],
    });

    await userEvent.click(
      within(gallery).getByRole("radio", { name: catalogPtBR["theme.ocean"] }),
    );

    expect(document.documentElement).toHaveAttribute(
      "data-slotted-corners",
      "round",
    );
    expect(
      document.documentElement.style.getPropertyValue("--slotted-seed-success"),
    ).toBe("#14b8a6");
    expect(
      within(gallery).getByRole("radio", { name: catalogPtBR["theme.ocean"] }),
    ).toBeChecked();
  });

  it("draws each theme card in the theme's own corners and seeds", async () => {
    await renderApp("/settings?section=appearance", { fetch: api() });
    const gallery = await screen.findByRole("radiogroup", {
      name: catalogPtBR["settings.theme.gallery"],
    });

    const terminal = within(gallery)
      .getByRole("radio", { name: catalogPtBR["theme.terminal"] })
      .closest("label")
      ?.querySelector<HTMLElement>("[data-slotted-seeds]");

    expect(terminal).toHaveAttribute("data-slotted-corners", "square");
    expect(terminal?.style.getPropertyValue("--slotted-seed-accent")).toBe(
      "#f59e0b",
    );
    expect(terminal).toHaveAttribute("data-equori-depth", "oled");
  });

  it("reads a changed value as custom and saves it as a theme", async () => {
    await renderApp("/settings?section=appearance", { fetch: api() });
    const tones = await screen.findByRole("radiogroup", {
      name: catalogPtBR["settings.tone"],
    });

    await userEvent.click(
      within(tones).getByRole("radio", { name: catalogPtBR["tone.sage"] }),
    );

    expect(
      screen.getByText(catalogPtBR["settings.theme.customHint"]),
    ).toBeInTheDocument();

    await userEvent.click(
      screen.getByRole("button", { name: catalogPtBR["settings.theme.save"] }),
    );
    const dialog = await screen.findByRole("dialog");
    await userEvent.type(
      within(dialog).getByRole("textbox", {
        name: catalogPtBR["settings.theme.name"],
      }),
      "Sálvia",
    );
    await userEvent.click(
      within(dialog).getByRole("button", {
        name: catalogPtBR["settings.theme.save"],
      }),
    );

    const gallery = screen.getByRole("radiogroup", {
      name: catalogPtBR["settings.theme.gallery"],
    });
    expect(
      within(gallery).getByRole("radio", { name: "Sálvia" }),
    ).toBeChecked();
    expect(localStorage.getItem("equori.themes")).toContain('"Sálvia"');
  });

  it("imports a theme file and applies it", async () => {
    await renderApp("/settings?section=appearance", { fetch: api() });

    await userEvent.click(
      await screen.findByRole("button", {
        name: catalogPtBR["settings.theme.import"],
      }),
    );
    const dialog = await screen.findByRole("dialog");
    fireEvent.change(
      within(dialog).getByRole("textbox", {
        name: catalogPtBR["settings.theme.importText"],
      }),
      {
        target: {
          value: exportTheme("Mine", {
            ...curatedThemes.dusk,
            corners: "square",
          }),
        },
      },
    );
    await userEvent.click(
      within(dialog).getByRole("button", {
        name: catalogPtBR["settings.theme.import"],
      }),
    );

    expect(document.documentElement).toHaveAttribute(
      "data-slotted-corners",
      "square",
    );
    expect(screen.getByRole("radio", { name: "Mine" })).toBeChecked();
  });

  it("refuses a file that is not a theme", async () => {
    await renderApp("/settings?section=appearance", { fetch: api() });

    await userEvent.click(
      await screen.findByRole("button", {
        name: catalogPtBR["settings.theme.import"],
      }),
    );
    const dialog = await screen.findByRole("dialog");
    fireEvent.change(
      within(dialog).getByRole("textbox", {
        name: catalogPtBR["settings.theme.importText"],
      }),
      { target: { value: '{"format":"other"}' } },
    );
    await userEvent.click(
      within(dialog).getByRole("button", {
        name: catalogPtBR["settings.theme.import"],
      }),
    );

    expect(
      within(dialog).getByText(catalogPtBR["settings.theme.importInvalid"]),
    ).toBeInTheDocument();
    expect(localStorage.getItem("equori.themes")).toBeNull();
  });
});

function api() {
  return fakeApi({
    "GET /api/v1/me": () =>
      json(200, {
        id: 1,
        email: "a@b.c",
        role: "admin",
        language: "pt",
        region: "BR",
      }),
    "GET /api/v1/settings": () => json(200, { base_currency: "BRL" }),
    "GET /api/v1/instruments": () =>
      json(200, { items: [{ code: "BRL", scale: 2 }] }),
  });
}
