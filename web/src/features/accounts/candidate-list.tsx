import { Stack } from "@slotted/react/stack";
import { Heading, Text } from "@slotted/react/typography";

import type { components } from "@/api/schema.gen";
import { CandidateCard } from "@/features/accounts/candidate-card";
import { linkScore, reviewScore } from "@/features/accounts/candidate-score";
import { useT } from "@/i18n/i18n-provider";

type ExternalRecord = components["schemas"]["ExternalRecord"];

interface CandidateListProps {
  record: ExternalRecord;
  scale: (code: string) => number;
  pending: string | null;
  onMatch: (transactionId: string) => void;
}

// The transactions a line may confirm, best first, with the bands that decide an automatic match.
export function CandidateList({
  record,
  scale,
  pending,
  onMatch,
}: CandidateListProps) {
  const t = useT();
  const candidates = record.scored_candidates ?? [];

  return (
    <Stack gap={3}>
      <Heading level={3} size="sm">
        {t("batch.candidates", { count: candidates.length })}
      </Heading>
      <Text size="sm" tone="muted">
        {t("batch.bands", { link: linkScore, review: reviewScore })}
      </Text>
      {candidates.map((candidate) => (
        <CandidateCard
          key={candidate.transaction_id}
          candidate={candidate}
          accountId={record.account_id}
          scale={scale}
          busy={pending === candidate.transaction_id}
          onMatch={() => {
            onMatch(candidate.transaction_id);
          }}
        />
      ))}
    </Stack>
  );
}
