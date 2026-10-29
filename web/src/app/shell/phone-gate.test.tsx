import { screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import { newRouter } from "@/app/router";
import { destinations } from "@/app/shell/destinations";
import { catalogEn } from "@/i18n/catalog.en";
import { writeLocale } from "@/i18n/locale";
import { fakeApi, json } from "@/testing/fake-api";
import { renderApp } from "@/testing/render-app";

// ADR 027, S3, as the router writes each path.
const phoneRoutes = [
  "/",
  "/accounts/",
  "/accounts/$id",
  "/cards",
  "/cards/$accountId",
  "/cards/$accountId/statements/$statementId",
  "/transactions",
  "/transactions/new",
  "/transactions/capture",
  "/transactions/queue",
  "/transactions/$id",
  "/transactions/$id/correct",
  "/settings",
  "/settings/appearance",
  "/help",
  "/help/$page",
];

const desktopRoutes = [
  "/planning",
  "/categories",
  "/accounts/new",
  "/accounts/11111111-1111-4111-8111-111111111111/import",
  "/accounts/institutions",
  "/goals",
  "/portfolio",
  "/reports",
];

describe("PhoneGate (ADR 027, S4)", () => {
  beforeEach(() => {
    localStorage.clear();
    writeLocale({ language: "en", region: "US" });
  });

  it("marks the routes of S3 as phone routes, and no other", () => {
    const marked = Object.values(newRouter().routesById)
      .filter((route) => route.options.staticData?.phone === true)
      .map((route) => route.fullPath);

    expect(marked.sort()).toEqual([...phoneRoutes].sort());
  });

  it.each(["/", "/transactions/capture"])(
    "serves %s on the phone",
    async (path) => {
      await renderApp(path, { width: 390, fetch: newFetch() });

      expect(screen.queryByText(catalogEn["phone.wide.title"])).toBeNull();
    },
  );

  it.each(desktopRoutes)(
    "renders the notice for %s on the phone",
    async (path) => {
      await renderApp(path, { width: 390, fetch: newFetch() });

      expect(screen.getByText(catalogEn["phone.wide.title"])).toBeVisible();
      expect(
        screen.getByRole("link", { name: catalogEn["phone.wide.overview"] }),
      ).toHaveAttribute("href", "/");
    },
  );

  // S6: the dock and More list a destination exactly when its route is served on the phone.
  it.each(destinations.map((d) => [d.to, d.phone] as const))(
    "lists %s on the phone as its route allows",
    (to, phone) => {
      // The last match is the one PhoneGate reads.
      const leaf = newRouter().matchRoutes(to).at(-1);

      expect(phone !== "none").toBe(leaf?.staticData.phone === true);
    },
  );

  it.each(desktopRoutes)("serves %s from 600 px", async (path) => {
    await renderApp(path, { width: 600, fetch: newFetch() });

    expect(screen.queryByText(catalogEn["phone.wide.title"])).toBeNull();
  });
});

function newFetch() {
  return fakeApi({
    "GET /api/v1/me": () =>
      json(200, { id: "user-1", email: "owner@example.com" }),
  });
}
