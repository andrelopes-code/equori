import styles from "@/features/portfolio/projection/journey-block/journey-block.module.css";
import type { JourneyFigures } from "@/features/portfolio/projection/journey-block/journey-figures";
import { useJourneyMoney } from "@/features/portfolio/projection/journey-block/use-journey-money";
import { formatBasisPoints } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";

interface JourneyPathProps {
  figures: JourneyFigures;
  currency: string;
  scale: number;
}

// PX6: today's value over the amount needed, as a bar with its two ends; income mode only.
export function JourneyPath({ figures, currency, scale }: JourneyPathProps) {
  const t = useT();
  const [tag] = useAppLocale();
  const money = useJourneyMoney(currency, scale);

  if (figures.way === null || figures.needed === null) return null;

  const share = t("portfolio.projection.journey.path.value", {
    share: formatBasisPoints(Math.round(figures.way * 10000), tag),
  });

  return (
    <div className={styles.pathBlock}>
      <div className={styles.pathHead}>
        <span className={styles.planFactLabel}>
          {t("portfolio.projection.journey.path.label")}
        </span>
        <span className={styles.pathValue}>{share}</span>
      </div>

      <div className={styles.pathBar} role="img" aria-label={share}>
        <span
          className={styles.pathFill}
          style={{ inlineSize: `${String(Math.min(figures.way, 1) * 100)}%` }}
        />
      </div>

      <div className={styles.pathEnds}>
        <span>
          {t("portfolio.projection.journey.path.today", {
            amount: money.exact(figures.today),
          })}
        </span>
        <span>
          {figures.started
            ? t("portfolio.projection.journey.path.needed.today", {
                amount: money.compact(figures.needed),
              })
            : t("portfolio.projection.journey.path.needed", {
                amount: money.compact(figures.needed),
                age: figures.withdrawalAge,
              })}
        </span>
      </div>
    </div>
  );
}
