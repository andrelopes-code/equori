import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { guardTouchContextMenu } from "@/app/touch-context-menu";

function longPress(target: Element, pointerType: string | undefined): boolean {
  const event = new MouseEvent("contextmenu", {
    bubbles: true,
    cancelable: true,
  });
  if (pointerType !== undefined) {
    Object.defineProperty(event, "pointerType", { value: pointerType });
  }
  target.dispatchEvent(event);
  return event.defaultPrevented;
}

function pick(selector: string): Element {
  const element = document.querySelector(selector);
  if (element === null) throw new Error(`missing ${selector}`);
  return element;
}

describe("guardTouchContextMenu", () => {
  let dispose: () => void;

  beforeEach(() => {
    document.body.innerHTML = `
      <a href="/accounts"><span id="link-label">Accounts</span></a>
      <button id="button">Save</button>
      <div role="tab" id="tab">Overview</div>
      <img id="image" alt="" src="/icon.svg">
      <p id="text">Groceries</p>
      <input id="field">
      <textarea id="note"></textarea>
      <div contenteditable="true" id="editable">draft</div>`;
    dispose = guardTouchContextMenu(document);
  });

  afterEach(() => {
    dispose();
    vi.unstubAllGlobals();
  });

  it.each(["#link-label", "#button", "#tab", "#image"])(
    "suppresses the browser menu on a touch long press over %s",
    (selector) => {
      expect(longPress(pick(selector), "touch")).toBe(true);
    },
  );

  it.each(["#text", "#field", "#note", "#editable"])(
    "keeps the browser menu on a touch long press over %s",
    (selector) => {
      expect(longPress(pick(selector), "touch")).toBe(false);
    },
  );

  it("keeps the browser menu on a mouse right click over a link", () => {
    expect(longPress(pick("#link-label"), "mouse")).toBe(false);
  });

  it.each([
    { coarse: true, prevented: true },
    { coarse: false, prevented: false },
  ])(
    "falls back to the coarse pointer media query ($coarse) without a pointer type",
    ({ coarse, prevented }) => {
      vi.stubGlobal(
        "matchMedia",
        vi.fn((query: string) => ({
          matches: coarse && query === "(pointer: coarse)",
        })),
      );
      expect(longPress(pick("#button"), undefined)).toBe(prevented);
    },
  );

  it("stops suppressing after the guard is disposed", () => {
    dispose();
    expect(longPress(pick("#button"), "touch")).toBe(false);
  });
});
