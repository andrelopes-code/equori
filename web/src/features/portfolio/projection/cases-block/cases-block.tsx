import {
  Section,
  SectionBody,
  SectionDescription,
  SectionHeader,
  SectionHeading,
  SectionTitle,
} from "@slotted/react/section";
import { useMemo } from "react";

import type { components } from "@/api/schema.gen";
import { CaseTable } from "@/features/portfolio/projection/cases-block/case-table";
import { caseRows } from "@/features/portfolio/projection/cases-block/case-rows";
import { journeyFigures } from "@/features/portfolio/projection/journey-block/journey-figures";
import type { ProjectionDraft } from "@/features/portfolio/projection/model/plan-fields";
import { useScale } from "@/features/setup";
import { useT } from "@/i18n/i18n-provider";
import { useToday } from "@/i18n/today";

interface CasesBlockProps {
  draft: ProjectionDraft;
  history: components["schemas"]["ReturnSeries"];
  birthDate: string;
  baseline: components["schemas"]["ProjectionBaseline"] | undefined;
}

// PX16: the typed cases beside the plan, one line each; nothing without a typed case.
export function CasesBlock({
  draft,
  history,
  birthDate,
  baseline,
}: CasesBlockProps) {
  const t = useT();
  const today = useToday();
  const scale = useScale();

  const figures = useMemo(
    () => journeyFigures({ draft, history, birthDate, today, baseline }),
    [draft, history, birthDate, today, baseline],
  );
  const title = t("portfolio.projection.cases");

  if (figures.cases.length === 0) return null;

  return (
    <Section size="lg" ground="surface" heading="title" aria-label={title}>
      <SectionHeader>
        <SectionTitle>
          <SectionHeading>{title}</SectionHeading>

          <SectionDescription>
            {t("portfolio.projection.cases.description")}
          </SectionDescription>
        </SectionTitle>
      </SectionHeader>

      <SectionBody>
        <CaseTable
          rows={caseRows(figures, draft.realReturnBp)}
          withdrawalAge={figures.withdrawalAge}
          lastAge={figures.lastAge}
          income={figures.income !== null}
          currency={draft.currency}
          scale={scale?.(draft.currency) ?? 0}
        />
      </SectionBody>
    </Section>
  );
}
