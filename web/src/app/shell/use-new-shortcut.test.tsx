import { fireEvent, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { AppRouter } from "@/app/router";
import { fakeApi } from "@/testing/fake-api";
import { renderApp } from "@/testing/render-app";
import { sharedRoutes } from "@/testing/transaction-api";

function press(target: Element, init: KeyboardEventInit = {}) {
  fireEvent.keyDown(target, { key: "n", bubbles: true, ...init });
}

// N opens the admin page until the quick
// entry is rebuilt.
describe("N shortcut", () => {
  const opened = (router: AppRouter) =>
    router.state.location.pathname === "/admin";
  const closed = (router: AppRouter) =>
    router.state.location.pathname !== "/admin";

  it("opens the admin page", async () => {
    const { router } = await renderApp("/", { fetch: fakeApi(sharedRoutes) });
    press(document.body);
    await waitFor(() => {
      expect(opened(router)).toBe(true);
    });
  });

  it("accepts the capital letter", async () => {
    const { router } = await renderApp("/", { fetch: fakeApi(sharedRoutes) });
    press(document.body, { key: "N", shiftKey: true });
    await waitFor(() => {
      expect(opened(router)).toBe(true);
    });
  });

  it.each([
    ["input", () => document.createElement("input")],
    ["textarea", () => document.createElement("textarea")],
    ["select", () => document.createElement("select")],
    [
      "contenteditable",
      () => {
        const node = document.createElement("div");
        node.setAttribute("contenteditable", "true");
        return node;
      },
    ],
  ])("ignores the key typed in a %s", async (_name, make) => {
    const { router } = await renderApp("/", { fetch: fakeApi(sharedRoutes) });
    const field = make();
    document.body.append(field);
    press(field);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(closed(router)).toBe(true);
    field.remove();
  });

  it.each([{ ctrlKey: true }, { metaKey: true }, { altKey: true }])(
    "ignores the key with a modifier %j",
    async (modifier) => {
      const { router } = await renderApp("/", {
        fetch: fakeApi(sharedRoutes),
      });
      press(document.body, modifier);
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(closed(router)).toBe(true);
    },
  );

  it("ignores the key while a dialog is open", async () => {
    const { router } = await renderApp("/", { fetch: fakeApi(sharedRoutes) });
    const dialog = document.createElement("div");
    dialog.setAttribute("role", "dialog");
    document.body.append(dialog);
    press(document.body);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(closed(router)).toBe(true);
    dialog.remove();
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
