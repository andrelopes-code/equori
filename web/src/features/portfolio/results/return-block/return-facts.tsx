import type { components } from "@/api/schema.gen";
import type { BlockFigures } from "@/features/portfolio/results/return-block/block-figures";
import { toBasisPoints } from "@/features/portfolio/results/return-block/block-figures";
import { FactList } from "@/features/portfolio/results/shared/fact-list";
import { FactRow } from "@/features/portfolio/results/shared/fact-row";
import styles from "@/features/portfolio/results/shared/shared.module.css";
import {
  formatBasisPoints,
  formatMonthSlashYear,
  formatSignedBasisPoints,
} from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { Toned } from "@/ui/money/toned";

type ReturnSeries = components["schemas"]["ReturnSeries"];

const separator = " · ";

interface ReturnFactsProps {
  series: ReturnSeries;
  figures: BlockFigures;
}

// PR4, PR6: the annual rate, the real return, the volatility and the largest fall; the rates that
// need 12 whole months read "under 12 months" with fewer.
export function ReturnFacts({ series, figures }: ReturnFactsProps) {
  const t = useT();
  const [tag] = useAppLocale();

  const signed = (fraction: number) =>
    formatSignedBasisPoints(toBasisPoints(fraction), tag);
  const { annual, real, fall } = figures;
  const realKey =
    real?.until === series.to
      ? "portfolio.results.fact.real.value"
      : "portfolio.results.fact.real.until";

  return (
    <FactList>
      <FactRow label={t("portfolio.results.fact.annual")}>
        {annual === null && t("portfolio.results.fact.short")}
        {annual !== null && (
          <Toned value={annual}>
            {t("portfolio.results.fact.annual.value", { rate: signed(annual) })}
          </Toned>
        )}
      </FactRow>

      {real !== null && (
        <FactRow label={t("portfolio.results.fact.real")}>
          <Toned value={real.value}>
            {t(realKey, {
              rate: signed(real.value),
              month: formatMonthSlashYear(real.until.slice(0, 7), tag),
            })}
          </Toned>
        </FactRow>
      )}

      <FactRow label={t("portfolio.results.fact.volatility")}>
        {figures.volatility === null && t("portfolio.results.fact.short")}
        {figures.volatility !== null &&
          t("portfolio.results.fact.annual.value", {
            rate: formatBasisPoints(toBasisPoints(figures.volatility), tag),
          })}
      </FactRow>

      {fall !== null && (
        <FactRow
          label={t("portfolio.results.fact.fall")}
          mark={<span className={styles.fallMark} aria-hidden="true" />}
        >
          <Toned value={fall.value}>{signed(fall.value)}</Toned>
          {separator}
          {t("portfolio.results.fact.fall.dates", {
            from: formatMonthSlashYear(fall.from.slice(0, 7), tag),
            to: formatMonthSlashYear(fall.to.slice(0, 7), tag),
          })}
        </FactRow>
      )}
    </FactList>
  );
}
