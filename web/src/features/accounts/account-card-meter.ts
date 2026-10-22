import type { AccountCardKind } from "@/features/accounts/account-card-kind";
import type { MessageKey } from "@/i18n/catalog.en";

export type AccountCardMeterState = "normal" | "alert" | "over" | "reached";

export interface AccountCardMeter {
  pct: number;
  // Segments of 5% painted in the state's colour, at most 20.
  filled: number;
  // The first segment of the risk zone; its empty segments are tinted.
  riskFrom: number | undefined;
  state: AccountCardMeterState;
  leftKey: MessageKey;
  // Minor units, never negative: the text of leftKey says on which side of the total it is.
  leftAmount: number;
  rightKey: MessageKey;
}

const segments = 20;

// The alert threshold of each kind, in percent; savings has none.
const alertAt: Record<AccountCardKind, number | undefined> = {
  credit: 80,
  checking: 90,
  savings: undefined,
};

export function accountCardMeter(
  kind: AccountCardKind,
  used: number,
  total: number,
): AccountCardMeter | undefined {
  if (total <= 0) return undefined;
  const pct = Math.max(0, Math.round((used * 100) / total));
  const filled = Math.min(segments, Math.round(pct / 5));
  const alert = alertAt[kind];
  const rest = total - used;
  if (kind === "savings") {
    const reached = pct >= 100;
    return {
      pct,
      filled,
      riskFrom: undefined,
      state: reached ? "reached" : "normal",
      leftKey: "accountCard.meter.savings.goal",
      leftAmount: total,
      rightKey: reached
        ? "accountCard.meter.savings.reached"
        : "accountCard.meter.savings.pct",
    };
  }
  const state =
    pct >= 100
      ? "over"
      : alert !== undefined && pct >= alert
        ? "alert"
        : "normal";
  const credit = kind === "credit";
  return {
    pct,
    filled,
    riskFrom: alert === undefined ? undefined : alert / 5,
    state,
    leftKey: credit
      ? rest < 0
        ? "accountCard.meter.credit.over"
        : "accountCard.meter.credit.free"
      : rest < 0
        ? "accountCard.meter.checking.over"
        : "accountCard.meter.checking.left",
    leftAmount: Math.abs(rest),
    rightKey: credit
      ? "accountCard.meter.credit.pct"
      : "accountCard.meter.checking.pct",
  };
}
