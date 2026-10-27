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

// Families read: button. Confirms the pending proposals of one answer in order and stops at the
// first failure; each card shows its own outcome (P17).
export function ConfirmAll({
  proposals,
  onDecided,
}: {
  proposals: readonly Proposal[];
  onDecided: (id: string, decision: Decision) => void;
}) {
  const t = useT();
  const confirm = useConfirmProposal();
  const [ran, setRan] = useState(false);
  if (ran || proposals.length < 2) return null;
  return (
    <div>
      <Button
        size="sm"
        variant="outline"
        onClick={() => {
          setRan(true);
          void (async () => {
            for (const p of proposals) {
              try {
                onDecided(p.id, { proposal: await confirm.mutateAsync(p.id) });
              } catch (error) {
                onDecided(p.id, { error });
                return;
              }
            }
          })();
        }}
      >
        {t("assistant.proposal.confirm_all")}
      </Button>
    </div>
  );
}
