import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { fakeApi, json } from "@/testing/fake-api";
import { renderApp } from "@/testing/render-app";

// A change of route never starts a view transition: the browser freezes the page and drops input
// until the new page renders.
describe("page navigation", () => {
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

  it("does not start a view transition on a change of destination", async () => {
    const { router } = await renderApp("/accounts", { fetch: api() });

    await router.navigate({ to: "/reports" });

    expect(router.state.location.pathname).toBe("/reports");
    expect(start).not.toHaveBeenCalled();
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
