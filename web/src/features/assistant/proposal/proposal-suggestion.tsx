import { Text } from "@slotted/react/typography";

import { useT } from "@/i18n/i18n-provider";

interface ProposalSuggestionProps {
  reason: string | undefined;
}

// Families read: typography. The label of a write the assistant added on its own, and why.
export function ProposalSuggestion({ reason }: ProposalSuggestionProps) {
  const t = useT();

  return (
    <div>
      <Text size="sm" weight="semibold">
        {t("assistant.proposal.suggested")}
      </Text>
      {reason !== undefined && (
        <Text size="sm" tone="muted">
          {reason}
        </Text>
      )}
    </div>
  );
}
