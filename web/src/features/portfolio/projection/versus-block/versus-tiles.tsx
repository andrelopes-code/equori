import { useJourneyMoney } from "@/features/portfolio/projection/journey-block/use-journey-money";
import type { VersusFigures } from "@/features/portfolio/projection/model/versus-figures";
import styles from "@/features/portfolio/projection/versus-block/versus-block.module.css";
import { WindowTile } from "@/features/portfolio/results/windows-block/window-tile";
import { formatBasisPoints, formatSignedBasisPoints } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { Toned } from "@/ui/money/toned";

interface VersusTilesProps {
  figures: VersusFigures;
  // The contribution in force this month, in minor units.
  planned: number;
  // The realized real return a year of the whole history, null under 12 months.
  annualReal: number | null;
  expectedBp: number;
  currency: string;
  scale: number;
}

// PX7: the difference today, the months above the plan, the average recorded contribution against
// the planned one and the realized real return against the expected one.
export function VersusTiles({
  figures,
  planned,
  annualReal,
  expectedBp,
  currency,
  scale,
}: VersusTilesProps) {
  const t = useT();
  const [tag] = useAppLocale();
  const money = useJourneyMoney(currency, scale);

  const share = Math.round(figures.differenceShare * 10000);
  const above = (figures.monthsAbove / figures.months) * 100;
  const average =
    figures.averageContribution === null
      ? null
      : Math.round(figures.averageContribution);
  const realBp = annualReal === null ? 0 : Math.round(annualReal * 10000);

  return (
    <dl className={styles.tileRow}>
      <WindowTile
        label={t("portfolio.projection.versus.today")}
        value={
          <Toned value={figures.difference}>
            {money.signed(figures.difference)}
          </Toned>
        }
        note={formatSignedBasisPoints(share, tag)}
      />

      <WindowTile
        label={t("portfolio.projection.versus.months")}
        value={t("portfolio.projection.versus.months.value", {
          above: figures.monthsAbove,
          total: figures.months,
        })}
        note={
          <span className={styles.shareBar} aria-hidden="true">
            <span
              className={styles.shareFill}
              style={{ inlineSize: `${String(above)}%` }}
            />
          </span>
        }
      />

      <WindowTile
        label={t("portfolio.projection.versus.contribution")}
        value={
          average === null ? (
            t("portfolio.projection.versus.contribution.none")
          ) : (
            <Toned value={average - planned}>{money.exact(average)}</Toned>
          )
        }
        note={t("portfolio.projection.versus.contribution.plan", {
          amount: money.exact(planned),
        })}
      />

      <WindowTile
        label={t("portfolio.projection.versus.return")}
        value={
          annualReal === null ? (
            t("portfolio.projection.versus.return.short")
          ) : (
            <Toned value={realBp - expectedBp}>
              {t("portfolio.projection.versus.return.value", {
                rate: formatBasisPoints(realBp, tag),
              })}
            </Toned>
          )
        }
        note={t("portfolio.projection.versus.return.plan", {
          rate: formatBasisPoints(expectedBp, tag),
        })}
      />
    </dl>
  );
}
