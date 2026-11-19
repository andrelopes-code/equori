import {
  Section,
  SectionBody,
  SectionHeader,
  SectionHeading,
  SectionTitle,
} from "@slotted/react/section";

import { BreakEvenList } from "@/features/calculators/indexer-comparison/break-even-list";
import type { BreakEvenItem } from "@/features/calculators/indexer-comparison/break-even-items";
import type { ComparisonRow } from "@/features/calculators/indexer-comparison/compare";
import { ComparisonNotes } from "@/features/calculators/indexer-comparison/comparison-notes";
import { ComparisonTable } from "@/features/calculators/indexer-comparison/comparison-table";
import type { Security } from "@/features/calculators/indexer-comparison/security";
import { useT } from "@/i18n/i18n-provider";

interface IndexerComparisonEvidenceProps {
  securities: readonly Security[];
  rows: readonly (ComparisonRow | null)[];
  items: readonly BreakEvenItem[];
  // The position of the reference security.
  reference: number;
  currency: string;
  scale: number;
}

export function IndexerComparisonEvidence({
  securities,
  rows,
  items,
  reference,
  currency,
  scale,
}: IndexerComparisonEvidenceProps) {
  const t = useT();

  return (
    <>
      <Section size="lg">
        <SectionHeader>
          <SectionTitle>
            <SectionHeading>
              {t("calc.indexerComparison.table.title")}
            </SectionHeading>
          </SectionTitle>
        </SectionHeader>

        <SectionBody>
          <ComparisonTable
            securities={securities}
            rows={rows}
            currency={currency}
            scale={scale}
          />
        </SectionBody>
      </Section>

      <BreakEvenList
        items={items}
        securities={securities}
        reference={reference}
      />

      <ComparisonNotes />
    </>
  );
}
