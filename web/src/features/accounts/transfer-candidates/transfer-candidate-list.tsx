import { Stack } from "@slotted/react/stack";

import type { components } from "@/api/schema.gen";
import { TransferCandidateCard } from "@/features/accounts/transfer-candidates/transfer-candidate-card";
import { useT } from "@/i18n/i18n-provider";
import {
  Section,
  SectionBody,
  SectionHeader,
  SectionHeading,
  SectionTitle,
} from "@slotted/react/section";

type ExternalRecord = components["schemas"]["ExternalRecord"];

interface TransferCandidateListProps {
  record: ExternalRecord;
  scale: (code: string) => number;
  pending: string | null;
  onMatch: (transactionId: string) => void;
}

// The transactions of other accounts a line that looks like a transfer may confirm.
export function TransferCandidateList({
  record,
  scale,
  pending,
  onMatch,
}: TransferCandidateListProps) {
  const t = useT();

  return (
    <Section size="lg">
      <SectionHeader>
        <SectionTitle>
          <SectionHeading>
            {t("batch.candidates", { count: record.candidates.length })}
          </SectionHeading>
        </SectionTitle>
      </SectionHeader>

      <SectionBody>
        <Stack gap={3}>
          {record.candidates.map((transactionId) => (
            <TransferCandidateCard
              key={transactionId}
              transactionId={transactionId}
              amount={record.amount}
              scale={scale}
              busy={pending === transactionId}
              onMatch={() => {
                onMatch(transactionId);
              }}
            />
          ))}
        </Stack>
      </SectionBody>
    </Section>
  );
}
