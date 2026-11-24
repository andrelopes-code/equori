import styles from "@/features/portfolio/results/evolution-block/evolution-block.module.css";
import type {
  EvolutionFigures,
  IrrRow,
} from "@/features/portfolio/results/evolution-block/evolution-figures";
import { FactRow } from "@/features/portfolio/results/shared/fact-row";
import { formatSignedBasisPoints } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { useMoneyFormat } from "@/privacy/use-money-format";
import { Toned } from "@/ui/money/toned";

interface EvolutionBridgeProps {
  figures: EvolutionFigures;
  currency: string;
  // The digits of the currency.
  scale: number;
  irr: IrrRow | null;
}

// PR9: from the opening value to the closing value, and the annual money-weighted rate.
export function EvolutionBridge({
  figures,
  currency,
  scale,
  irr,
}: EvolutionBridgeProps) {
  const t = useT();
  const [tag] = useAppLocale();
  const fmt = useMoneyFormat();

  const money = (amount: number) => ({ amount, currency });

  return (
    <dl className={styles.bridge}>
      <FactRow label={t("portfolio.results.evolution.opening")}>
        {fmt.money(money(figures.opening), scale)}
      </FactRow>

      <FactRow label={t("portfolio.results.evolution.net")}>
        {fmt.signed(money(figures.net), scale)}
      </FactRow>

      <FactRow label={t("portfolio.results.evolution.return")}>
        <Toned value={figures.gain}>
          {fmt.signed(money(figures.gain), scale)}
        </Toned>
      </FactRow>

      <FactRow label={t("portfolio.results.evolution.closing")}>
        {fmt.money(money(figures.closing), scale)}
      </FactRow>

      {irr !== null && (
        <FactRow label={t("portfolio.results.evolution.irr")}>
          {irr.kind === "short" && t("portfolio.results.fact.short")}
          {irr.kind === "rate" && (
            <Toned value={irr.bp}>
              {t("portfolio.results.fact.annual.value", {
                rate: formatSignedBasisPoints(irr.bp, tag),
              })}
            </Toned>
          )}
        </FactRow>
      )}
    </dl>
  );
}
