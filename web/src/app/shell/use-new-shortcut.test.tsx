import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { catalogEn } from "@/i18n/catalog.en";
import { fakeApi } from "@/testing/fake-api";
import { renderApp } from "@/testing/render-app";
import { checkingID, sharedRoutes } from "@/testing/transaction-api";

function press(target: Element, init: KeyboardEventInit = {}) {
  fireEvent.keyDown(target, { key: "n", bubbles: true, ...init });
}

// Ledger sheet decision L7; complete frontend F2.
describe("N shortcut", () => {
  const closed = () =>
    screen.queryByRole("dialog", { name: catalogEn["entry.title"] }) === null;
  const entry = () =>
    screen.findByRole("dialog", { name: catalogEn["entry.title"] });

  it("opens the quick entry", async () => {
    await renderApp("/", { fetch: fakeApi(sharedRoutes) });
    press(document.body);
    expect(await entry()).toBeInTheDocument();
  });

  it("accepts the capital letter", async () => {
    await renderApp("/", { fetch: fakeApi(sharedRoutes) });
    press(document.body, { key: "N", shiftKey: true });
    expect(await entry()).toBeInTheDocument();
  });

  it("posts to the open account unless the text names another", async () => {
    await renderApp(`/accounts/${checkingID}`, {
      fetch: fakeApi(sharedRoutes),
    });
    await screen.findAllByText("Itau");
    press(document.body);
    const dialog = await entry();
    fireEvent.change(
      within(dialog).getByRole("textbox", { name: catalogEn["entry.field"] }),
      { target: { value: "lunch 42" } },
    );
    const account = within(dialog).getByText(catalogEn["entry.account"], {
      selector: "dt",
    });
    await waitFor(() => {
      expect(account.nextElementSibling).toHaveTextContent("Itau");
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
    await renderApp("/", { fetch: fakeApi(sharedRoutes) });
    const field = make();
    document.body.append(field);
    press(field);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(closed()).toBe(true);
    field.remove();
  });

  it.each([{ ctrlKey: true }, { metaKey: true }, { altKey: true }])(
    "ignores the key with a modifier %j",
    async (modifier) => {
      await renderApp("/", {
        fetch: fakeApi(sharedRoutes),
      });
      press(document.body, modifier);
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(closed()).toBe(true);
    },
  );

  it("ignores the key while a dialog is open", async () => {
    await renderApp("/", { fetch: fakeApi(sharedRoutes) });
    const dialog = document.createElement("div");
    dialog.setAttribute("role", "dialog");
    document.body.append(dialog);
    press(document.body);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(closed()).toBe(true);
    dialog.remove();
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
