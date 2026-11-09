import { usePrivacy } from "@/privacy/privacy-provider";
import { type AmountToneMode, useAmountToneMode } from "@/theme/amounts";

// A flow is money moving (an entry, an expense); a result is a gain or a loss.
export type AmountKind = "flow" | "result";

export type AmountDirection = "in" | "out" | "none";

export type AmountTextTone = "success" | "danger" | "inherit";

export function useAmountTone(): (
  kind: AmountKind,
  direction: AmountDirection,
) => AmountTextTone {
  const [mode] = useAmountToneMode();
  const { hidden } = usePrivacy();

  return (kind, direction) => amountTone(kind, direction, mode, hidden);
}

export function amountTone(
  kind: AmountKind,
  direction: AmountDirection,
  mode: AmountToneMode,
  hidden: boolean,
): AmountTextTone {
  if (mode === "sign" || hidden) return "inherit";
  if (direction === "in") return "success";
  if (direction === "out" && kind === "result") return "danger";

  return "inherit";
}

export function directionOf(amount: number): AmountDirection {
  if (amount > 0) return "in";
  if (amount < 0) return "out";

  return "none";
}
