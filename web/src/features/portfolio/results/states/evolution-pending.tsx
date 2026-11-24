import styles from "@/features/portfolio/results/evolution-block/evolution-block.module.css";
import { EvolutionKey } from "@/features/portfolio/results/evolution-block/evolution-key";
import { FactRow } from "@/features/portfolio/results/shared/fact-row";
import { PendingPlot } from "@/features/portfolio/results/states/pending-plot";
import { PendingSection } from "@/features/portfolio/results/states/pending-section";
import { PendingValue } from "@/features/portfolio/results/states/pending-value";
import { useT } from "@/i18n/i18n-provider";

const bridge = [
  "portfolio.results.evolution.opening",
  "portfolio.results.evolution.net",
  "portfolio.results.evolution.return",
  "portfolio.results.evolution.closing",
  "portfolio.results.evolution.irr",
] as const;

// PR11: the evolution block while the history is pending: the key, the plot and the bridge labels.
export function EvolutionPending() {
  const t = useT();

  return (
    <PendingSection
      title={t("portfolio.results.evolution")}
      description={t("portfolio.results.evolution.description")}
    >
      <div className={[styles.hero, styles.heroEnd].join(" ")}>
        <div className={styles.heroPlot}>
          <EvolutionKey />

          <PendingPlot size="md" />
        </div>

        <div className={styles.heroSide}>
          <dl className={styles.bridge}>
            {bridge.map((label) => (
              <FactRow key={label} label={t(label)}>
                <PendingValue ch={11} />
              </FactRow>
            ))}
          </dl>
        </div>
      </div>
    </PendingSection>
  );
}
