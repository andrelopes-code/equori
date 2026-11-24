import { FactRow } from "@/features/portfolio/results/shared/fact-row";
import { MonthHead } from "@/features/portfolio/results/months-block/month-head";
import styles from "@/features/portfolio/results/months-block/months-block.module.css";
import { MonthsPendingRow } from "@/features/portfolio/results/states/months-pending-row";
import { PendingSection } from "@/features/portfolio/results/states/pending-section";
import { PendingValue } from "@/features/portfolio/results/states/pending-value";
import { useT } from "@/i18n/i18n-provider";

const facts = [
  ["portfolio.results.months.best", 14],
  ["portfolio.results.months.worst", 14],
  ["portfolio.results.months.positive", 8],
  ["portfolio.results.months.negative", 8],
] as const;

const years = [0, 1, 2, 3, 4, 5];

// PR11: the figures of the months block as placeholders, and the table with six slow years.
export function MonthsPending() {
  const t = useT();

  return (
    <PendingSection
      title={t("portfolio.results.months")}
      description={t("portfolio.results.months.description")}
    >
      <dl className={styles.factStrip}>
        {facts.map(([label, ch]) => (
          <FactRow key={label} label={t(label)}>
            <PendingValue ch={ch} />
          </FactRow>
        ))}
      </dl>

      <div className={styles.monthScroll}>
        <table className={styles.monthTable}>
          <caption className={styles.srOnly}>
            {t("portfolio.results.months.caption")}
          </caption>

          <MonthHead />

          <tbody>
            {years.map((year) => (
              <MonthsPendingRow key={year} />
            ))}
          </tbody>
        </table>
      </div>
    </PendingSection>
  );
}
