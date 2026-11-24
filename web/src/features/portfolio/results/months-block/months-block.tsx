import {
  Section,
  SectionActions,
  SectionBody,
  SectionDescription,
  SectionHeader,
  SectionHeading,
  SectionTitle,
} from "@slotted/react/section";
import { useState } from "react";

import type { components } from "@/api/schema.gen";
import { indexName } from "@/features/calculators";
import { monthReturns } from "@/features/portfolio/results/model/month-returns";
import { compareMonths } from "@/features/portfolio/results/months-block/month-comparison";
import { MonthFacts } from "@/features/portfolio/results/months-block/month-facts";
import { monthFigures } from "@/features/portfolio/results/months-block/month-figures";
import { MonthTable } from "@/features/portfolio/results/months-block/month-table";
import { useT } from "@/i18n/i18n-provider";
import { ChoiceSelect } from "@/ui/form-fields/choice-select";

type ReturnSeries = components["schemas"]["ReturnSeries"];

interface MonthsBlockProps {
  // The history read: the whole history by month, whatever the period.
  history: ReturnSeries | undefined;
}

const noComparison = "none";

// PR8: the return of each month by year, and the same table as points above an index.
export function MonthsBlock({ history }: MonthsBlockProps) {
  const t = useT();

  const [compare, setCompare] = useState(noComparison);

  if (history === undefined) return null;

  const months = monthReturns(history.points);
  const figures = monthFigures(months);
  if (figures === null) return null;

  const against = history.indexes.find((i) => i.index === compare);
  const rows = compareMonths(
    months,
    against === undefined ? null : monthReturns(against.points),
  );
  const choices = [
    { value: noComparison, label: t("portfolio.results.months.compare.none") },
    ...history.indexes.map((i) => ({
      value: i.index,
      label: indexName(i.index),
    })),
  ];

  function handleCompare(next: string | string[] | null) {
    if (typeof next === "string") setCompare(next);
  }

  return (
    <Section
      size="lg"
      ground="surface"
      heading="title"
      aria-label={t("portfolio.results.months")}
    >
      <SectionHeader>
        <SectionTitle>
          <SectionHeading>{t("portfolio.results.months")}</SectionHeading>
          <SectionDescription>
            {t("portfolio.results.months.description")}
          </SectionDescription>
        </SectionTitle>

        {history.indexes.length > 0 && (
          <SectionActions>
            <ChoiceSelect
              label={t("portfolio.results.months.compare")}
              choices={choices}
              multiple={false}
              value={compare}
              onChange={handleCompare}
            />
          </SectionActions>
        )}
      </SectionHeader>

      <SectionBody>
        <MonthFacts figures={figures} />

        <MonthTable rows={rows} />
      </SectionBody>
    </Section>
  );
}
