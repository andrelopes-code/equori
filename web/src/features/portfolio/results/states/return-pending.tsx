import styles from "@/features/portfolio/results/return-block/return-block.module.css";
import { SeriesRow } from "@/features/portfolio/results/return-block/series-row";
import { FactList } from "@/features/portfolio/results/shared/fact-list";
import { FactRow } from "@/features/portfolio/results/shared/fact-row";
import { PendingPlot } from "@/features/portfolio/results/states/pending-plot";
import { PendingSection } from "@/features/portfolio/results/states/pending-section";
import { PendingValue } from "@/features/portfolio/results/states/pending-value";
import { useT } from "@/i18n/i18n-provider";

// PR11: the return block while the period is pending: the portfolio row is known, the indexes
// come with the response.
export function ReturnPending() {
  const t = useT();

  return (
    <PendingSection
      title={t("portfolio.results.return")}
      description={<PendingValue ch={30} />}
    >
      <div className={styles.hero}>
        <div className={styles.heroSide}>
          <div className={styles.verdict}>
            <p className={styles.verdictLabel}>
              {t("portfolio.results.return.label")}
            </p>

            <p className={styles.verdictValue}>
              <PendingValue ch={7} />
            </p>

            <p className={styles.verdictText}>
              <PendingValue ch={26} />
            </p>
          </div>

          <ul
            className={styles.seriesList}
            aria-label={t("portfolio.results.series")}
          >
            <SeriesRow
              name={t("portfolio.results.series.portfolio")}
              value={<PendingValue ch={6} />}
              slot={1}
              on
            />
          </ul>

          <FactList>
            <FactRow label={t("portfolio.results.fact.annual")}>
              <PendingValue ch={9} />
            </FactRow>

            <FactRow label={t("portfolio.results.fact.real")}>
              <PendingValue ch={11} />
            </FactRow>

            <FactRow label={t("portfolio.results.fact.volatility")}>
              <PendingValue ch={9} />
            </FactRow>

            <FactRow label={t("portfolio.results.fact.fall")}>
              <PendingValue ch={18} />
            </FactRow>
          </FactList>
        </div>

        <div className={styles.heroPlot}>
          <PendingPlot size="lg" />
        </div>
      </div>
    </PendingSection>
  );
}
