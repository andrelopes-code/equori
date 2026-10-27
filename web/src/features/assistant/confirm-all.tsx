import { Button } from "@slotted/react/button";
import { useState } from "react";

import type { components } from "@/api/schema.gen";
import { useConfirmProposal } from "@/features/assistant/api";
import { useT } from "@/i18n/i18n-provider";

type Proposal = components["schemas"]["AssistantProposal"];

export interface Decision {
  proposal?: Proposal;
  error?: unknown;
}

// Families read: button. Confirms the still pending proposals of one answer in order and stops at
// the first one that does not execute; each card shows its own outcome (P17). The cards stay locked
// while it runs, so no single confirm interleaves with it.
export function ConfirmAll({
  proposals,
  onDecided,
  onRunning,
}: {
  proposals: readonly Proposal[];
  onDecided: (id: string, decision: Decision) => void;
  onRunning: (running: boolean) => void;
}) {
  const t = useT();
  const confirm = useConfirmProposal();
  const [ran, setRan] = useState(false);
  if (ran || proposals.length < 2) return null;
  const run = async () => {
    for (const p of proposals) {
      // A card the timer expired is not sent; the server would refuse it.
      if (Date.parse(p.expires_at) <= Date.now()) continue;
      try {
        const result = await confirm.mutateAsync(p.id);
        onDecided(p.id, { proposal: result });
        if (result.status !== "executed") return;
      } catch (error) {
        onDecided(p.id, { error });
        return;
      }
    }
  };
  return (
    <div>
      <Button
        size="sm"
        variant="outline"
        onClick={() => {
          setRan(true);
          onRunning(true);
          void run().finally(() => {
            onRunning(false);
          });
        }}
      >
        {t("assistant.proposal.confirm_all")}
      </Button>
    </div>
  );
}
