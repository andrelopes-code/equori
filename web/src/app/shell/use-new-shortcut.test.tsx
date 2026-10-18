import { fireEvent, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { fakeApi } from "@/testing/fake-api";
import { renderApp } from "@/testing/render-app";
import { checkingID, sharedRoutes } from "@/testing/transaction-api";

function press(target: Element, init: KeyboardEventInit = {}) {
  fireEvent.keyDown(target, { key: "n", bubbles: true, ...init });
}

// Ledger sheet decision L7.
describe("N shortcut", () => {
  it("opens the new transaction form", async () => {
    const { router } = await renderApp("/", { fetch: fakeApi(sharedRoutes) });
    press(document.body);
    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/transactions/new");
    });
  });

  it("accepts the capital letter", async () => {
    const { router } = await renderApp("/", { fetch: fakeApi(sharedRoutes) });
    press(document.body, { key: "N", shiftKey: true });
    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/transactions/new");
    });
  });

  it("preselects the open account", async () => {
    const { router } = await renderApp(`/accounts/${checkingID}`, {
      fetch: fakeApi(sharedRoutes),
    });
    // The account list answers first; the top bar's New link shows it has.
    await waitFor(() => {
      expect(
        document.querySelector(`a[href$="account_id=${checkingID}"]`),
      ).not.toBeNull();
    });
    press(document.body);
    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/transactions/new");
    });
    expect(router.state.location.search).toEqual({ account_id: checkingID });
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
    expect(router.state.location.pathname).toBe("/");
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
      expect(router.state.location.pathname).toBe("/");
    },
  );

  it("ignores the key while a dialog is open", async () => {
    const { router } = await renderApp("/", { fetch: fakeApi(sharedRoutes) });
    const dialog = document.createElement("div");
    dialog.setAttribute("role", "dialog");
    document.body.append(dialog);
    press(document.body);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(router.state.location.pathname).toBe("/");
    dialog.remove();
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
