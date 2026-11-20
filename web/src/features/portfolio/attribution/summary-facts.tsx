import type { AttributionTally } from "@/features/portfolio/attribution/attribution-rows";
import { SummaryFact } from "@/features/portfolio/attribution/summary-fact";
import {
  signTone,
  type SummaryFigures,
} from "@/features/portfolio/attribution/summary-figures";
import styles from "@/features/portfolio/attribution/year-summary.module.css";
import { indexName } from "@/features/calculators";
import { formatBasisPoints, formatDayMonthNumeric } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { useMoneyFormat } from "@/privacy/use-money-format";

interface SummaryFactsProps {
  figures: SummaryFigures;
  gains: AttributionTally;
  losses: AttributionTally;
  currency: string;
  scale: number;
}

// What the lines mean: the money above or below the CDI, the return above inflation, and how many
// holdings gained and lost, each value in the tone of its sign. A figure the year lacks is left out.
export function SummaryFacts({
  figures,
  gains,
  losses,
  currency,
  scale,
}: SummaryFactsProps) {
  const t = useT();
  const [tag] = useAppLocale();
  const fmt = useMoneyFormat();

  const { rateDiff, real } = figures;
  const windowOf = (until: string | undefined) =>
    until === undefined
      ? ""
      : t("portfolio.attribution.window", {
          day: formatDayMonthNumeric(until, tag),
        });
  const money = (amount: number) => fmt.signed({ amount, currency }, scale);

  return (
    <div className={styles.facts}>
      {rateDiff !== undefined && (
        <SummaryFact
          label={t("portfolio.attribution.fact.rate", {
            index: indexName(rateDiff.index),
            window: windowOf(rateDiff.until),
          })}
          value={money(rateDiff.amount)}
          tone={signTone(rateDiff.amount)}
        />
      )}

      {real !== undefined && (
        <SummaryFact
          label={t("portfolio.attribution.fact.real", {
            window: windowOf(real.until),
          })}
          value={formatBasisPoints(real.bp, tag)}
          tone={signTone(real.bp)}
        />
      )}

      {gains.count > 0 && (
        <SummaryFact
          label={t(
            gains.count === 1
              ? "portfolio.attribution.fact.gains.one"
              : "portfolio.attribution.fact.gains.other",
            { count: String(gains.count) },
          )}
          value={money(gains.sum)}
          tone="success"
        />
      )}

      {losses.count > 0 && (
        <SummaryFact
          label={t(
            losses.count === 1
              ? "portfolio.attribution.fact.losses.one"
              : "portfolio.attribution.fact.losses.other",
            { count: String(losses.count) },
          )}
          value={money(losses.sum)}
          tone="danger"
        />
      )}
    </div>
  );
}
