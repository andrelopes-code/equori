import { errorText } from "@/api/problem";
import type { components } from "@/api/schema.gen";
import { proposalCardState } from "@/features/assistant/proposal/proposal-card-state";
import type { TFunction } from "@/i18n/i18n-provider";

type Proposal = components["schemas"]["AssistantProposal"];

export type UndoState =
  | { kind: "none" }
  | { kind: "done" }
  | { kind: "ready"; failure: string | undefined };

// The undo control of an executed proposal (answer views design V19): done once an executed undo
// reversed it, here or before; ready while its write has an inverse, with the reason the last
// attempt failed; none otherwise.
export function undoState(
  proposal: Proposal,
  answer: Proposal | undefined,
  error: unknown,
  t: TFunction,
): UndoState {
  if (proposal.undone_by !== undefined || answer?.status === "executed") {
    return { kind: "done" };
  }

  if (proposal.undoable !== true) return { kind: "none" };

  if (error !== null && error !== undefined) {
    return { kind: "ready", failure: failed(errorText(error, t), t) };
  }

  if (answer?.status === "failed") {
    const state = proposalCardState({
      shown: answer,
      passed: false,
      busy: false,
      error: null,
      t,
    });

    return { kind: "ready", failure: failed(state.outcome, t) };
  }

  return { kind: "ready", failure: undefined };
}

// failed writes why an undo did not run, after the words that say it did not.
function failed(reason: string | undefined, t: TFunction): string {
  return `${t("assistant.undo.failed")} ${reason ?? ""}`.trim();
}
