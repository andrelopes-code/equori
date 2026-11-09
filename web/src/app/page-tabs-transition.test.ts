import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { catalogPtBR } from "@/i18n/catalog.pt-BR";
import { accountsPtBR } from "@/i18n/catalog-accounts.pt-BR";
import { fakeApi, json } from "@/testing/fake-api";
import { renderApp } from "@/testing/render-app";

// A tab that changes the route keeps the page in place: only a change of destination cross-fades.
describe("page transition between tabs", () => {
  const start = vi.fn(
    (arg: ViewTransitionUpdateCallback | StartViewTransitionOptions) => {
      const update = typeof arg === "function" ? arg : arg.update;

      return { updateCallbackDone: Promise.resolve(update?.()) };
    },
  );

  beforeEach(() => {
    start.mockClear();
    Object.assign(document, { startViewTransition: start });
  });

  afterEach(() => {
    Reflect.deleteProperty(document, "startViewTransition");
  });

  it("cross-fades a change of destination", async () => {
    const { router } = await renderApp("/accounts", { fetch: api() });
    start.mockClear();

    await router.navigate({ to: "/reports" });

    expect(start).toHaveBeenCalledTimes(1);
  });

  it.each([
    [
      "/accounts",
      accountsPtBR["accounts.tab.institutions"],
      "/accounts/institutions",
    ],
    ["/categories", catalogPtBR["categories.tab.rules"], "/categories/rules"],
  ])(
    "does not cross-fade the tab change from %s to %s",
    async (from, tab, to) => {
      const { router } = await renderApp(from, { fetch: api() });
      start.mockClear();

      await userEvent.click(await screen.findByRole("tab", { name: tab }));

      await waitFor(() => {
        expect(router.state.location.pathname).toBe(to);
      });
      expect(start).not.toHaveBeenCalled();
    },
  );
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
