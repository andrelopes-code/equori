import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it } from "vitest";

import { fakeApi } from "@/testing/fake-api";
import { hideAmounts } from "@/testing/privacy";
import { renderWithProviders } from "@/testing/render-app";
import { MoneyInput } from "@/ui/money/money-input";

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

  // Each case edits an amount where the caret stands ("|"); the text keeps the caret there.
  it.each([
    ["a digit typed in the middle", "1|,000.00", "5", "15|,000.00", 1_500_000],
    ["two digits typed in a row", "1|,000.00", "56", "156|,000.00", 15_600_000],
    ["the first digit erased", "1|0,000.00", "{Backspace}", "|0,000.00", 0],
    [
      "the first digit exchanged",
      "1|0,000.00",
      "{Backspace}2",
      "2|0,000.00",
      2_000_000,
    ],
    [
      "a digit before the separator erased",
      "12,|345.67",
      "{Backspace}",
      "1|,345.67",
      134_567,
    ],
    [
      "a digit after the separator deleted",
      "12|,345.67",
      "{Delete}",
      "1,2|45.67",
      124_567,
    ],
    ["a digit typed at the end", "12.34|", "5", "123.45|", 12_345],
    ["a digit erased at the end", "12.34|", "{Backspace}", "1.23|", 123],
    [
      "a digit typed after the first is erased",
      "1|0.00",
      "{Backspace}{End}5",
      "0.05|",
      5,
    ],
  ])("keeps the caret: %s", async (_, from, keys, to, minor) => {
    const typed: number[] = [];
    const input = renderEntry(from.replace("|", ""), typed);

    await userEvent.click(input);
    input.setSelectionRange(from.indexOf("|"), from.indexOf("|"));
    await userEvent.keyboard(keys);

    expect(withCaret(input)).toBe(to);
    expect(typed.at(-1)).toBe(minor);
  });

  it("drops the zeros left of the amount once the field loses focus", async () => {
    const input = renderEntry("10,000.00", []);

    await userEvent.click(input);
    input.setSelectionRange(1, 1);
    await userEvent.keyboard("{Backspace}");
    expect(input).toHaveValue("0,000.00");

    await userEvent.tab();
    expect(input).toHaveValue("0.00");
  });

  it.each([
    ["10,000.00", "1|0,000.00"],
    ["0.00", "0.00|"],
  ])("puts the caret of a press on %s at %s", async (from, to) => {
    const input = renderEntry(from, []);

    await userEvent.pointer({ keys: "[MouseLeft]", target: input, offset: 1 });
    await new Promise(requestAnimationFrame);

    expect(withCaret(input)).toBe(to);
  });

  it("replaces a selected part of the amount", async () => {
    const input = renderEntry("10,000.00", []);

    await userEvent.click(input);
    input.setSelectionRange(0, 2);
    await userEvent.keyboard("25");

    expect(withCaret(input)).toBe("25|,000.00");
  });
});

function renderEntry(text: string, typed: number[]): HTMLInputElement {
  function Entry() {
    const [value, setValue] = useState(Number(text.replace(/\D/g, "")));

    return (
      <MoneyInput
        size="field"
        aria-label="Amount"
        value={value}
        currency="BRL"
        scale={2}
        sign="neutral"
        onChange={(minor) => {
          typed.push(minor);
          setValue(minor);
        }}
      />
    );
  }

  renderWithProviders(<Entry />, { fetch: fakeApi({}) });

  return screen.getByRole<HTMLInputElement>("textbox");
}

function withCaret(input: HTMLInputElement): string {
  const caret = input.selectionStart ?? 0;

  return `${input.value.slice(0, caret)}|${input.value.slice(caret)}`;
}
