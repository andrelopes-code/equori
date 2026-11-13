import {
  Section,
  SectionBody,
  SectionDescription,
  SectionHeader,
  SectionHeading,
  SectionTitle,
} from "@slotted/react/section";
import { Stack } from "@slotted/react/stack";

import type { components } from "@/api/schema.gen";
import { CandidateCard } from "@/features/accounts/candidates/candidate-card";
import {
  linkScore,
  reviewScore,
} from "@/features/accounts/candidates/candidate-score";
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
    <Section size="sm" level="3">
      <SectionHeader>
        <SectionTitle>
          <SectionHeading>
            {t("batch.candidates", { count: candidates.length })}
          </SectionHeading>
          <SectionDescription>
            {t("batch.bands", { link: linkScore, review: reviewScore })}
          </SectionDescription>
        </SectionTitle>
      </SectionHeader>

      <SectionBody>
        <Stack gap={3}>
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
      </SectionBody>
    </Section>
  );
}
