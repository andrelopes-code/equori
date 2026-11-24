import type { components } from "@/api/schema.gen";
import type { BlockFigures } from "@/features/portfolio/results/return-block/block-figures";
import { toBasisPoints } from "@/features/portfolio/results/return-block/block-figures";
import { FactList } from "@/features/portfolio/results/shared/fact-list";
import { FactRow } from "@/features/portfolio/results/shared/fact-row";
import { Toned } from "@/features/portfolio/results/shared/toned";
import {
  formatBasisPoints,
  formatReferenceMonth,
  formatReferenceMonthCompact,
  formatSignedBasisPoints,
} from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";

type ReturnSeries = components["schemas"]["ReturnSeries"];

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
              month: formatReferenceMonth(real.until.slice(0, 7), tag),
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
        <FactRow label={t("portfolio.results.fact.fall")}>
          <Toned value={fall.value}>
            {t("portfolio.results.fact.fall.value", {
              rate: signed(fall.value),
              from: formatReferenceMonthCompact(fall.from.slice(0, 7), tag),
              to: formatReferenceMonthCompact(fall.to.slice(0, 7), tag),
            })}
          </Toned>
        </FactRow>
      )}
    </FactList>
  );
}
