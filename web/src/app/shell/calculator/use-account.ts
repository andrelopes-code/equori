import { useLayoutEffect, useMemo, useState } from "react";
import type { ChangeEvent, KeyboardEvent, RefObject } from "react";

import {
  change,
  normalize,
  numberText,
  parenthesis,
  read,
  render,
  separatorsOf,
} from "@/app/shell/calculator/account-text";
import type {
  Account,
  Drawn,
  Separators,
} from "@/app/shell/calculator/account-text";
import { evaluate } from "@/app/shell/calculator/evaluate";
import type { Outcome } from "@/app/shell/calculator/evaluate";
import { decimalText } from "@/app/shell/calculator/rational";
import { useAppLocale } from "@/i18n/i18n-provider";
import { copyText } from "@/ui/runtime/copy-text";

// A key of the window: a character of the logical form, or a command.
export type KeyAction =
  { write: string } | { command: "clear" | "erase" | "parentheses" | "commit" };

export interface AccountControl {
  drawn: Drawn;
  outcome: Outcome;
  separators: Separators;
  // The result as the screen writes it; empty when the result is not a number.
  result: string;
  copied: boolean;
  handleChange: (event: ChangeEvent<HTMLInputElement>) => void;
  handleKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void;
  press: (action: KeyAction) => void;
  copy: () => void;
}

const EMPTY: Account = { logical: "", caret: 0 };

// The account of the calculator: what the field holds, its result and the commands of the keys.
export function useAccount(
  field: RefObject<HTMLInputElement | null>,
): AccountControl {
  const [tag] = useAppLocale();
  const [account, setAccount] = useState(EMPTY);
  // Counts the edits, so the caret is placed again when an edit leaves the same text.
  const [edits, setEdits] = useState(0);
  const [copiedPlain, setCopiedPlain] = useState<string | null>(null);

  const separators = useMemo(() => separatorsOf(tag), [tag]);
  const drawn = render(account.logical, account.caret, separators);
  const outcome = useMemo(() => evaluate(account.logical), [account.logical]);
  const plain = outcome.kind === "value" ? decimalText(outcome.value) : null;
  const result = plain === null ? "" : numberText(plain, separators, true);

  // The field is controlled: without this the browser leaves the caret at the end of the text.
  useLayoutEffect(() => {
    field.current?.setSelectionRange(drawn.caret, drawn.caret);
  }, [field, drawn.caret, drawn.text, edits]);

  function update(next: Account) {
    setAccount(next);
    setEdits((count) => count + 1);
  }

  // The selection of the field, as two carets of the logical form.
  function selection(): [number, number] {
    const input = field.current;
    if (input === null) return [account.caret, account.caret];

    const at = (caret: number | null) =>
      read(input.value, caret ?? input.value.length, separators).caret;

    return [at(input.selectionStart), at(input.selectionEnd)];
  }

  function write(text: string) {
    const [start, end] = selection();
    const logical =
      account.logical.slice(0, start) + text + account.logical.slice(end);

    update(normalize(logical, start + text.length));
  }

  function erase() {
    const [start, end] = selection();
    const from = start === end ? Math.max(0, start - 1) : start;

    update(
      normalize(
        account.logical.slice(0, from) + account.logical.slice(end),
        from,
      ),
    );
  }

  // K13: the result becomes the account the next key continues.
  function commit() {
    if (plain !== null) update({ logical: plain, caret: plain.length });
  }

  function press(action: KeyAction) {
    if ("write" in action) {
      write(action.write);

      return;
    }

    if (action.command === "clear") update(EMPTY);
    if (action.command === "erase") erase();
    if (action.command === "commit") commit();
    if (action.command === "parentheses") {
      write(parenthesis(account.logical, selection()[0]));
    }
  }

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const native = event.nativeEvent as Partial<InputEvent>;

    update(
      change(
        account.logical,
        input.value,
        input.selectionStart ?? input.value.length,
        native.inputType ?? "",
        native.data ?? null,
        separators,
      ),
    );
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== "Enter" && event.key !== "=") return;

    event.preventDefault();
    commit();
  }

  // K23: what another program reads has no grouping separator.
  function copy() {
    const input = field.current;
    if (plain === null || input?.parentElement == null) return;

    void copyText(
      numberText(plain, separators, false),
      input.parentElement,
    ).then(() => {
      setCopiedPlain(plain);
    });
  }

  return {
    drawn,
    outcome,
    separators,
    result,
    copied: plain !== null && copiedPlain === plain,
    handleChange,
    handleKeyDown,
    press,
    copy,
  };
}
