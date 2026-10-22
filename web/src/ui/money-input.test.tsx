import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { fakeApi } from "@/testing/fake-api";
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
});
