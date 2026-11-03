import { Text } from "@slotted/react/typography";

import type { components } from "@/api/schema.gen";
import { actionTitle } from "@/features/assistant/proposal-card-state";
import { useT } from "@/i18n/i18n-provider";

type Proposal = components["schemas"]["AssistantProposal"];

interface ProposalWaitingProps {
  proposal: Proposal;
  // The proposals of the answer, where `waiting_for` finds the cards this one waits for.
  siblings: readonly Proposal[];
}

// Families read: typography. What a waiting write does, and the cards it waits for.
export function ProposalWaiting({ proposal, siblings }: ProposalWaitingProps) {
  const t = useT();
  const actions = proposal.waiting_for
    .map((id) => siblings.find((p) => p.id === id))
    .filter((p) => p !== undefined)
    .map((p) => actionTitle(p.preview.action, t))
    .join(", ");

  return (
    <div>
      {proposal.summary !== undefined && (
        <Text size="sm">{proposal.summary}</Text>
      )}
      <Text size="sm" tone="muted">
        {t("assistant.proposal.waiting", { actions })}
      </Text>
    </div>
  );
}
