import { toBasisPoints } from "@/features/portfolio/results/return-block/block-figures";
import { FactRow } from "@/features/portfolio/results/shared/fact-row";
import { Toned } from "@/features/portfolio/results/shared/toned";
import type { MonthFigures } from "@/features/portfolio/results/months-block/month-figures";
import styles from "@/features/portfolio/results/months-block/months-block.module.css";
import {
  formatReferenceMonthCompact,
  formatSignedBasisPoints,
} from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";

interface MonthFactsProps {
  figures: MonthFigures;
}

const separator = " · ";

// PR8: the best and the worst month with their date, and the months on each side of zero.
export function MonthFacts({ figures }: MonthFactsProps) {
  const t = useT();
  const [tag] = useAppLocale();

  const { best, worst } = figures;
  const count = (value: number) =>
    t("portfolio.results.windows.count", {
      count: value,
      total: figures.total,
    });

  return (
    <dl className={styles.factStrip}>
      <FactRow label={t("portfolio.results.months.best")}>
        <Toned value={best.value}>
          {formatSignedBasisPoints(toBasisPoints(best.value), tag)}
        </Toned>
        {separator}
        {formatReferenceMonthCompact(best.month, tag)}
      </FactRow>

      <FactRow label={t("portfolio.results.months.worst")}>
        <Toned value={worst.value}>
          {formatSignedBasisPoints(toBasisPoints(worst.value), tag)}
        </Toned>
        {separator}
        {formatReferenceMonthCompact(worst.month, tag)}
      </FactRow>

      <FactRow label={t("portfolio.results.months.positive")}>
        <Toned value={figures.positive}>{count(figures.positive)}</Toned>
      </FactRow>

      <FactRow label={t("portfolio.results.months.negative")}>
        <Toned value={-figures.negative}>{count(figures.negative)}</Toned>
      </FactRow>
    </dl>
  );
}
