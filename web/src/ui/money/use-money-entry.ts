import { useRef, useState } from "react";
import type { ChangeEvent, FocusEvent } from "react";

import { useMoneyFormat } from "@/privacy/use-money-format";
import { caretBefore, minorFromTyped, moneyEdit } from "@/ui/money/money-entry";

// The integer part of a safe integer: fifteen digits stay exact in a double.
const maxDigits = 15;

interface MoneyEntry {
  value: number;
  onChange: (minor: number) => void;
  currency: string;
  scale: number;
}

// The text of a money field and the handlers that edit it: the caret keeps its place among the
// digits, and the zeros an edit leaves on the left stay until the field loses focus.
export function useMoneyEntry({
  value,
  onChange,
  currency,
  scale,
}: MoneyEntry) {
  const fmt = useMoneyFormat();

  const [draft, setDraft] = useState<string | null>(null);
  const pressed = useRef(false);

  const current =
    draft !== null && minorFromTyped(draft, maxDigits) === value
      ? draft
      : String(Math.abs(value));
  const text = write(current);

  function write(digits: string): string {
    const parts = fmt.entry(
      { amount: Number(digits), currency },
      scale,
      Math.max(digits.length - scale, 1),
    );

    return parts.integer + parts.fraction;
  }

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const { inputType } = event.nativeEvent as Partial<InputEvent>;

    const { head, tail } = moneyEdit(
      text,
      input.value,
      input.selectionStart ?? input.value.length,
      inputType?.endsWith("Forward") === true,
      maxDigits,
    );
    const next = write(head + tail);
    const caret = caretBefore(next, tail.length);

    // React moves the caret to the end when it writes a text the input does not hold yet.
    input.value = next;
    input.setSelectionRange(caret, caret);

    setDraft(head + tail);
    onChange(minorFromTyped(head + tail, maxDigits));
  }

  function handleFocus(event: FocusEvent<HTMLInputElement>) {
    // A press on the digits of an amount puts the caret there.
    if (pressed.current && value !== 0) return;

    const input = event.currentTarget;
    requestAnimationFrame(() => {
      input.setSelectionRange(input.value.length, input.value.length);
    });
  }

  function handleBlur() {
    pressed.current = false;
    setDraft(null);
  }

  return {
    text,
    handlers: {
      onChange: handleChange,
      onFocus: handleFocus,
      onBlur: handleBlur,
      onPointerDown: () => {
        pressed.current = true;
      },
    },
  };
}
