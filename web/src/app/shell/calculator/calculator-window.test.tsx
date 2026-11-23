import { fireEvent, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CalculatorWindow } from "@/app/shell/calculator/calculator-window";
import { catalogEn } from "@/i18n/catalog.en";
import { fakeApi } from "@/testing/fake-api";
import { renderWithProviders } from "@/testing/render-app";

describe("CalculatorWindow", () => {
  beforeEach(() => {
    localStorage.clear();
    // jsdom lays nothing out: the window measures 0 x 0 and the page needs an area.
    vi.spyOn(document.documentElement, "clientWidth", "get").mockReturnValue(
      1024,
    );
    vi.spyOn(document.documentElement, "clientHeight", "get").mockReturnValue(
      768,
    );
    // The window measures itself at the place its style states, as a browser lays it out.
    vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(
      drawnPlace,
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("draws nothing while closed", () => {
    mount(false);

    expect(screen.queryByRole("region")).toBeNull();
  });

  it("opens with the focus on an empty account and a muted zero (K3, K19)", () => {
    mount();

    expect(account()).toHaveFocus();
    expect(account()).toHaveValue("");
    expect(result()).toHaveTextContent("0");
    expect(result()).toHaveAttribute("data-idle");
  });

  it("writes the result on every key and groups the digits (G2, K11)", async () => {
    const user = userEvent.setup();
    mount();

    await user.keyboard("1200*1.05-300");

    expect(account()).toHaveValue("1,200 × 1.05 − 300");
    expect(result()).toHaveTextContent("960");
    expect(result()).not.toHaveAttribute("data-idle");
  });

  it("replaces the account by its result on Enter and continues from it (K13)", async () => {
    const user = userEvent.setup();
    mount();

    await user.keyboard("10/4{Enter}");

    expect(account()).toHaveValue("2.5");

    await user.keyboard("*2=");

    expect(account()).toHaveValue("5");
  });

  it("writes the keys at the caret and keeps the focus on the account (K21)", async () => {
    const user = userEvent.setup();
    mount();

    for (const name of ["7", "×", "8", "%"]) await user.click(key(name));

    expect(account()).toHaveValue("7 × 8%");
    expect(result()).toHaveTextContent("0.56");
    expect(account()).toHaveFocus();
  });

  it("chooses the parenthesis by the account (K22)", async () => {
    const user = userEvent.setup();
    mount();
    const parentheses = key(catalogEn["calculator.parentheses"]);

    await user.click(parentheses);
    await user.keyboard("1+2");
    await user.click(parentheses);

    expect(account()).toHaveValue("(1 + 2)");
  });

  it("erases the character before the caret and empties the account (K21)", async () => {
    const user = userEvent.setup();
    mount();

    await user.keyboard("12+3");
    await user.click(key(catalogEn["calculator.erase"]));

    expect(account()).toHaveValue("12 + ");

    await user.click(key(catalogEn["calculator.clear"]));

    expect(account()).toHaveValue("");
    expect(result()).toHaveTextContent("0");
  });

  it("removes the operator when the reader erases its space", async () => {
    const user = userEvent.setup();
    mount();

    await user.keyboard("12+{Backspace}");

    expect(account()).toHaveValue("12");
  });

  it("writes a failure in words (K18)", async () => {
    const user = userEvent.setup();
    mount();

    await user.keyboard("450/0");

    expect(result()).toHaveTextContent(catalogEn["calculator.divisionByZero"]);
    expect(result()).toHaveAttribute("data-invalid");
    expect(copy()).toBeNull();
  });

  it("steps the result down above 12 characters (K20)", async () => {
    const user = userEvent.setup();
    mount();

    await user.keyboard("1234567.89*12/7-98765.43");

    expect(result()).toHaveTextContent("2,017,636.66714286");
    expect(result()).toHaveAttribute("data-long");
  });

  it("copies the result without grouping and marks it copied until it changes (K23)", async () => {
    const writeText = vi.fn(() => Promise.resolve());
    vi.stubGlobal("isSecureContext", true);
    const user = userEvent.setup();
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });
    mount();

    await user.keyboard("1200*2");
    await user.click(key(catalogEn["calculator.copy"]));

    expect(writeText).toHaveBeenCalledWith("2400");
    expect(
      await screen.findByRole("button", {
        name: catalogEn["calculator.copied"],
      }),
    ).toBeInTheDocument();

    await user.keyboard("+1");

    expect(key(catalogEn["calculator.copy"])).toBeInTheDocument();
  });

  it("closes on Escape and from its close button (K3)", async () => {
    const user = userEvent.setup();
    const onClose = mount();

    await user.keyboard("{Escape}");
    await user.click(key(catalogEn["calculator.close"]));

    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it("moves with the arrow keys on its grip and remembers the place (K5, K8)", () => {
    mount();
    const grip = key(catalogEn["calculator.move"]);

    fireEvent.keyDown(grip, { key: "ArrowRight" });
    fireEvent.keyDown(grip, { key: "ArrowDown", shiftKey: true });

    expect(localStorage.getItem("equori.calculator")).toBe('{"x":16,"y":64}');
  });

  it("opens at the place it was left (K5)", () => {
    localStorage.setItem("equori.calculator", '{"x":40,"y":50}');

    mount();

    fireEvent.keyDown(key(catalogEn["calculator.move"]), { key: "ArrowRight" });

    expect(localStorage.getItem("equori.calculator")).toBe('{"x":56,"y":50}');
  });
});

function mount(open = true) {
  const onClose = vi.fn();

  renderWithProviders(<CalculatorWindow open={open} onClose={onClose} />, {
    fetch: fakeApi({}),
  });

  return onClose;
}

function drawnPlace(this: Element) {
  const style = this instanceof HTMLElement ? this.style : undefined;
  const x = parseFloat(style?.getPropertyValue("--_x") ?? "");
  const y = parseFloat(style?.getPropertyValue("--_y") ?? "");

  return new DOMRect(x || 0, y || 0, 0, 0);
}

function account() {
  return screen.getByRole("textbox", { name: catalogEn["calculator.account"] });
}

function result() {
  return screen.getByRole("status", { name: catalogEn["calculator.result"] });
}

function key(name: string) {
  return screen.getByRole("button", { name });
}

function copy() {
  return screen.queryByRole("button", { name: catalogEn["calculator.copy"] });
}
