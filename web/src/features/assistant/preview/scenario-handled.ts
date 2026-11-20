import { bodyKind } from "@/features/assistant/proposal/bodies/body-kind";
import type { Scenario } from "@/features/assistant/preview/scenario";

// A write scenario has a form of its own when every proposal's action has a body; the flag follows
// the bodies instead of being written by hand.
export function withHandled(scenarios: Scenario[]): Scenario[] {
  return scenarios.map((s) =>
    s.proposals === undefined || s.proposals.length === 0
      ? s
      : {
          ...s,
          handled: s.proposals.every(
            (p) => bodyKind(p.preview.action) !== "fields",
          ),
        },
  );
}
