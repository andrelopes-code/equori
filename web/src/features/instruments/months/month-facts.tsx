import { MonthFact } from "@/features/instruments/months/month-fact";
import styles from "@/features/instruments/months/months.module.css";
import { formatMonthSlashYear, formatSignedBasisPoints } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { MASK } from "@/privacy/mask";
import { useMoneyFormat } from "@/privacy/use-money-format";
import { Toned } from "@/ui/money/toned";
import type { MonthFigures, MonthReturn } from "@/ui/month-heat/month-figures";

interface MonthFactsProps {
  figures: MonthFigures;
}

const separator = " · ";

// IM5: the best and the worst month with their date, and the months that rose and fell.
export function MonthFacts({ figures }: MonthFactsProps) {
  const t = useT();
  const [locale] = useAppLocale();
  const { hidden } = useMoneyFormat();

  const { best, worst } = figures;
  const outOf = t("instrument.months.of", { total: figures.total });

  function changeText({ value }: MonthReturn) {
    return hidden
      ? MASK
      : formatSignedBasisPoints(Math.round(value * 10000), locale);
  }

  return (
    <dl className={styles.factStrip}>
      <MonthFact label={t("instrument.months.best")}>
        <Toned value={best.value}>{changeText(best)}</Toned>
        {separator}
        {formatMonthSlashYear(best.month, locale)}
      </MonthFact>

      <MonthFact label={t("instrument.months.worst")}>
        <Toned value={worst.value}>{changeText(worst)}</Toned>
        {separator}
        {formatMonthSlashYear(worst.month, locale)}
      </MonthFact>

      <MonthFact label={t("instrument.months.up")}>
        <Toned value={figures.positive}>{figures.positive}</Toned> {outOf}
      </MonthFact>

      <MonthFact label={t("instrument.months.down")}>
        <Toned value={-figures.negative}>{figures.negative}</Toned> {outOf}
      </MonthFact>
    </dl>
  );
}
