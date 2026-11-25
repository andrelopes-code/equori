import {
  Section,
  SectionBody,
  SectionDescription,
  SectionHeader,
  SectionHeading,
  SectionTitle,
} from "@slotted/react/section";
import { useMemo, useState } from "react";

import type { components } from "@/api/schema.gen";
import { journeyFigures } from "@/features/portfolio/projection/journey-block/journey-figures";
import type { ProjectionDraft } from "@/features/portfolio/projection/model/plan-fields";
import { YearTable } from "@/features/portfolio/projection/years-block/year-table";
import { yearTableRows } from "@/features/portfolio/projection/years-block/year-table-rows";
import styles from "@/features/portfolio/projection/years-block/years-block.module.css";
import { YearsMore } from "@/features/portfolio/projection/years-block/years-more";
import { useScale } from "@/features/setup";
import { useT } from "@/i18n/i18n-provider";
import { useToday } from "@/i18n/today";

// PX10: twelve rows at rest.
const restRows = 12;

interface YearsBlockProps {
  draft: ProjectionDraft;
  history: components["schemas"]["ReturnSeries"];
  birthDate: string;
  baseline: components["schemas"]["ProjectionBaseline"] | undefined;
}

// PX10: the projection of the draft per calendar year, in today's money.
export function YearsBlock({
  draft,
  history,
  birthDate,
  baseline,
}: YearsBlockProps) {
  const t = useT();
  const today = useToday();
  const scale = useScale();

  const [open, setOpen] = useState(false);

  const digits = scale?.(draft.currency) ?? 0;
  const rows = useMemo(() => {
    const { rows: projection } = journeyFigures({
      draft,
      history,
      birthDate,
      today,
      baseline,
    });

    return yearTableRows(projection, birthDate, history);
  }, [draft, history, birthDate, today, baseline]);
  const shown = open ? rows : rows.slice(0, restRows);
  const title = t("portfolio.projection.years");

  function handleToggle() {
    setOpen((value) => !value);
  }

  return (
    <Section size="lg" ground="surface" heading="title" aria-label={title}>
      <SectionHeader>
        <SectionTitle>
          <SectionHeading>{title}</SectionHeading>

          <SectionDescription>
            {t("portfolio.projection.years.description")}
          </SectionDescription>
        </SectionTitle>
      </SectionHeader>

      <SectionBody>
        <div
          className={open ? styles.yearScroll : undefined}
          role={open ? "group" : undefined}
          aria-label={open ? title : undefined}
          tabIndex={open ? 0 : undefined}
        >
          <YearTable rows={shown} currency={draft.currency} scale={digits} />
        </div>

        {rows.length > restRows && (
          <YearsMore count={rows.length} open={open} onToggle={handleToggle} />
        )}
      </SectionBody>
    </Section>
  );
}
