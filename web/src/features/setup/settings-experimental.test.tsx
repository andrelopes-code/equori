import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";

import { catalogPtBR } from "@/i18n/catalog.pt-BR";
import { writeLocale } from "@/i18n/locale";
import { fakeApi, json } from "@/testing/fake-api";
import { renderApp } from "@/testing/render-app";
import { sharedRoutes } from "@/testing/transaction-api";

const html = document.documentElement;
const label = catalogPtBR["settings.experimental.glass"];

beforeEach(() => {
  localStorage.clear();
  writeLocale({ language: "pt", region: "BR" });
  html.setAttribute("data-slotted-theme", "equori");
});

const fetch = () =>
  fakeApi({
    ...sharedRoutes,
    "GET /api/v1/me": () =>
      json(200, {
        id: 1,
        email: "a@b.c",
        role: "admin",
        language: "pt",
        region: "BR",
      }),
  });

describe("experimental glass style", () => {
  it("is off until the reader turns it on", async () => {
    await renderApp("/settings", { fetch: fetch() });
    expect(
      await screen.findByRole("switch", { name: label }),
    ).not.toBeChecked();
    expect(localStorage.getItem("equori.visual")).toBeNull();
    expect(html).toHaveAttribute("data-slotted-theme", "equori");
  });

  it("is kept in this browser and switches the theme when turned on", async () => {
    await renderApp("/settings", { fetch: fetch() });
    await userEvent.click(await screen.findByRole("switch", { name: label }));
    expect(screen.getByRole("switch", { name: label })).toBeChecked();
    expect(localStorage.getItem("equori.visual")).toBe("glass");
    await waitFor(() => {
      expect(html).toHaveAttribute("data-slotted-theme", "equori-glass");
    });
  });

  it("returns to the standard theme when turned off", async () => {
    localStorage.setItem("equori.visual", "glass");
    await renderApp("/settings", { fetch: fetch() });
    const toggle = await screen.findByRole("switch", { name: label });
    expect(toggle).toBeChecked();
    await userEvent.click(toggle);
    expect(localStorage.getItem("equori.visual")).toBe("standard");
    await waitFor(() => {
      expect(html).toHaveAttribute("data-slotted-theme", "equori");
    });
  });
});
