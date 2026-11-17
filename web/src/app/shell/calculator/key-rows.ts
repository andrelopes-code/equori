import type { KeyAction } from "@/app/shell/calculator/use-account";
import type { MessageKey } from "@/i18n/catalog.en";

export interface CalculatorKey {
  id: string;
  // The text of the key; absent when the key draws an icon or the separator of the tag.
  legend?: string;
  // The accessible name, where the legend is not one.
  name?: MessageKey;
  kind?: "sign" | "clear" | "equals";
  action: KeyAction;
}

const digit = (value: string): CalculatorKey => ({
  id: value,
  legend: value,
  action: { write: value },
});

const sign = (id: string, legend: string, write: string): CalculatorKey => ({
  id,
  legend,
  kind: "sign",
  action: { write },
});

// The keys in reading order, four per row.
export const keyRows: readonly CalculatorKey[] = [
  {
    id: "clear",
    legend: "C",
    name: "calculator.clear",
    kind: "clear",
    action: { command: "clear" },
  },
  {
    id: "parentheses",
    legend: "( )",
    name: "calculator.parentheses",
    kind: "sign",
    action: { command: "parentheses" },
  },
  sign("percent", "%", "%"),
  sign("divide", "÷", "/"),
  digit("7"),
  digit("8"),
  digit("9"),
  sign("multiply", "×", "*"),
  digit("4"),
  digit("5"),
  digit("6"),
  sign("subtract", "−", "-"),
  digit("1"),
  digit("2"),
  digit("3"),
  sign("add", "+", "+"),
  digit("0"),
  { id: "decimal", action: { write: "." } },
  {
    id: "erase",
    name: "calculator.erase",
    kind: "clear",
    action: { command: "erase" },
  },
  { id: "equals", legend: "=", kind: "equals", action: { command: "commit" } },
];
