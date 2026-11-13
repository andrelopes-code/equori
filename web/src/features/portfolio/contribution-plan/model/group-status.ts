import { shareText } from "@/features/portfolio/contribution-plan/model/share-text";
import type { TFunction } from "@/i18n/i18n-provider";

export type GroupStatus = "below" | "above" | "at" | "noIdeal";

interface StatusTextInput {
  // Basis points.
  today: number;
  ideal: number | undefined;
  // A member states its shares inside its group.
  member: boolean;
  t: TFunction;
  tag: string;
}

// Half a percentage point, in basis points: closer than this to the ideal is at the ideal.
const atIdealBp = 50;

export function groupStatus(
  today: number,
  ideal: number | undefined,
): GroupStatus {
  if (ideal === undefined) return "noIdeal";
  if (Math.abs(today - ideal) < atIdealBp) return "at";

  return today < ideal ? "below" : "above";
}

// The status of an entry in words (spec, Screen, Portfolio against the ideal).
export function statusText(input: StatusTextInput): string {
  const { today, ideal, member, t, tag } = input;
  const status = groupStatus(today, ideal);
  const vars = {
    today: shareText(today / 10000, tag),
    ideal: shareText((ideal ?? 0) / 10000, tag),
  };

  if (status === "noIdeal") return t("contributionPlan.statusNoIdeal", vars);

  const key = {
    below: "contributionPlan.statusBelow",
    above: "contributionPlan.statusAbove",
    at: "contributionPlan.statusAt",
  } as const;

  return member ? t(`${key[status]}Member`, vars) : t(key[status], vars);
}
