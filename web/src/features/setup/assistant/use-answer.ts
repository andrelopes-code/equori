import type { ModelUse, UsageRow } from "@/features/setup/api";
import { usageStatus } from "@/features/setup/usage/usage-rows";

type Target = ModelUse["targets"][number];
type Capability = ModelUse["needs"][number];

export type TargetState = "answering" | "lacking" | "resting" | "waiting";

export type UseNote =
  | { kind: "lacks"; model: string; missing: Capability[] }
  | { kind: "paused"; model: string; until: string }
  | { kind: "reached"; model: string }
  | { kind: "custom" }
  | { kind: "default" };

// The target that answers a use now: the first one that offers every capability the use needs
// and is neither over a declared limit nor cooling down (spec A3).
export function answering(
  use: ModelUse,
  rows: readonly UsageRow[],
  now: Date,
): Target | undefined {
  return use.targets.find(
    (target) =>
      missing(use, target).length === 0 && resting(target, rows, now) === null,
  );
}

export function targetState(
  use: ModelUse,
  target: Target,
  rows: readonly UsageRow[],
  now: Date,
): TargetState {
  if (missing(use, target).length > 0) return "lacking";

  if (resting(target, rows, now) !== null) return "resting";

  return answering(use, rows, now) === target ? "answering" : "waiting";
}

// The one condition a use states beside its name (spec A6).
export function useNote(
  use: ModelUse,
  rows: readonly UsageRow[],
  now: Date,
): UseNote {
  const lacking = use.targets.find((target) => missing(use, target).length > 0);
  if (lacking !== undefined)
    return {
      kind: "lacks",
      model: lacking.model,
      missing: missing(use, lacking),
    };

  for (const target of use.targets) {
    const rest = resting(target, rows, now);
    if (rest === null) continue;

    return rest.until === undefined
      ? { kind: "reached", model: target.model }
      : { kind: "paused", model: target.model, until: rest.until };
  }

  return { kind: use.default ? "default" : "custom" };
}

export function missing(use: ModelUse, target: Target): Capability[] {
  return use.needs.filter((need) => !target.capabilities.includes(need));
}

// A target rests while its usage row is over a declared limit or cooling down; a cooling row
// carries the time it answers again.
export function resting(
  target: Target,
  rows: readonly UsageRow[],
  now: Date,
): { until?: string } | null {
  const row = rows.find(
    (r) => r.provider_id === target.provider_id && r.model === target.model,
  );
  if (row === undefined) return null;

  const status = usageStatus(row, now);
  if (status === "cooling" && row.cooling_until !== undefined)
    return { until: row.cooling_until };

  return status === "reached" ? {} : null;
}
