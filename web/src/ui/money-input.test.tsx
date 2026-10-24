import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { fakeApi } from "@/testing/fake-api";
import { hideAmounts } from "@/testing/privacy";
import { renderWithProviders } from "@/testing/render-app";
import { MoneyInput } from "@/ui/money-input";

describe("MoneyInput", () => {
  // Owner review 2026-10-21: a press on the panel's empty space left the amount without focus.
  it("takes focus from a press anywhere on its panel, with the caret after the digits", async () => {
    const typed: number[] = [];
    renderWithProviders(
      <MoneyInput
        value={12345}
        currency="BRL"
        scale={2}
        sign="expense"
        onChange={(minor) => typed.push(minor)}
      />,
      { fetch: fakeApi({}) },
    );
    const input = screen.getByRole("textbox");
    const panel = input.closest("label");
    if (panel === null) throw new Error("the amount has no panel");
    await userEvent.click(panel);
    expect(input).toHaveFocus();
    await userEvent.keyboard("6");
    expect(typed.at(-1)).toBe(123456);
  });

  // Privacy hides what is shown, not what the person is typing: a hidden field cannot be edited.
  it("keeps the typed amount readable while the amounts are hidden", () => {
    localStorage.clear();
    hideAmounts();
    renderWithProviders(
      <MoneyInput
        value={12345}
        currency="BRL"
        scale={2}
        sign="expense"
        onChange={() => undefined}
      />,
      { fetch: fakeApi({}) },
    );
    expect(screen.getByRole("textbox")).toHaveValue("123.45");
  });

  // Smoke of trade entry: a quantity of a security drew its code before and after the digits.
  it("names an instrument that is not a currency once", () => {
    const { container } = renderWithProviders(
      <MoneyInput
        value={150}
        currency="MXRF11"
        scale={0}
        sign="neutral"
        onChange={() => undefined}
      />,
      { fetch: fakeApi({}) },
    );
    expect(container.textContent.match(/MXRF11/g)).toHaveLength(1);
  });
});
