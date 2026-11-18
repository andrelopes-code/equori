import { useState } from "react";

import type { components } from "@/api/schema.gen";
import {
  useConfirmProposal,
  useRejectProposal,
} from "@/features/assistant/api";
import { receiptAppearance } from "@/features/assistant/proposal/receipt-appearance";
import { defaultMarks } from "@/features/assistant/proposal/sheet-model";
import type { SheetRow } from "@/features/assistant/proposal/sheet-model";
import { restoreAppearance } from "@/theme/appearance";

type Proposal = components["schemas"]["AssistantProposal"];

export interface Decision {
  proposal?: Proposal;
  error?: unknown;
}

export interface SheetDecisions {
  marks: Record<string, boolean>;
  // A confirm or a reject of the sheet is running; the rows take no other decision.
  running: boolean;
  // The proposal whose request is in flight.
  active: string | undefined;
  // The failure of each proposal whose request did not reach the server.
  errors: Record<string, unknown>;
  toggle: (id: string) => void;
  confirm: () => void;
  reject: () => void;
}

// The marks and the two decisions of one sheet. A confirm runs the marked pending proposals in
// order and stops at the first one that does not execute (P17); a reject runs them in order.
export function useSheetDecisions(
  rows: readonly SheetRow[],
  onDecided: (id: string, decision: Decision) => void,
): SheetDecisions {
  const confirmProposal = useConfirmProposal();
  const rejectProposal = useRejectProposal();
  const [toggled, setToggled] = useState<Record<string, boolean>>({});
  const [active, setActive] = useState<string | undefined>();
  const [running, setRunning] = useState(false);
  const [errors, setErrors] = useState<Record<string, unknown>>({});

  const proposals = rows.map((row) => row.proposal);
  const marks = { ...defaultMarks(proposals), ...toggled };

  function toggle(id: string) {
    setToggled((current) => ({ ...current, [id]: marks[id] !== true }));
  }

  function confirm() {
    void decide(confirmProposal.mutateAsync, true);
  }

  function reject() {
    void decide(rejectProposal.mutateAsync, false);
  }

  async function decide(
    act: (id: string) => Promise<Proposal>,
    confirming: boolean,
  ) {
    setRunning(true);
    setErrors({});

    // A marked parent is followed by its dependents; an unmarked one leaves them untouched.
    const targets = rows
      .filter((r) => r.proposal.status === "pending" && marks[r.proposal.id])
      .flatMap((r) =>
        confirming ? [r.proposal, ...r.dependents] : [r.proposal],
      );

    for (const proposal of targets) {
      // A row the timer expired is not sent; the server would refuse it (P15).
      if (confirming && Date.parse(proposal.expires_at) <= Date.now()) continue;

      setActive(proposal.id);

      try {
        const result = await act(proposal.id);
        // The open browser shows the new appearance at once; its next sync sends the same document.
        const appearance = receiptAppearance(result);
        if (appearance) restoreAppearance(appearance);
        onDecided(proposal.id, { proposal: result });
        if (confirming && result.status !== "executed") break;
      } catch (error) {
        setErrors((current) => ({ ...current, [proposal.id]: error }));
        onDecided(proposal.id, { error });
        break;
      }
    }

    setActive(undefined);
    setRunning(false);
  }

  return { marks, running, active, errors, toggle, confirm, reject };
}
