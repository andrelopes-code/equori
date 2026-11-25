import styles from "@/features/portfolio/projection/journey-block/journey-block.module.css";
import type { JourneyFigures } from "@/features/portfolio/projection/journey-block/journey-figures";
import { useJourneyMoney } from "@/features/portfolio/projection/journey-block/use-journey-money";
import { numberFormatter } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { Toned } from "@/ui/money/toned";

interface JourneyVerdictProps {
  figures: JourneyFigures;
  currency: string;
  scale: number;
}

// PX6: whether the plan sustains the income, the value at the withdrawal age and its share of the
// amount needed; in rate mode only the value.
export function JourneyVerdict({
  figures,
  currency,
  scale,
}: JourneyVerdictProps) {
  const t = useT();
  const [tag] = useAppLocale();
  const money = useJourneyMoney(currency, scale);

  const percent = numberFormatter(tag, {
    style: "percent",
    maximumFractionDigits: 0,
  });
  const sustains = figures.sustains === true;
  const income = figures.sustains === null ? 0 : (figures.income ?? 0);
  const tone = sustains ? 1 : -1;
  const vars = {
    income: money.exact(income),
    end: figures.endAge ?? 0,
    last: figures.lastAge,
  };

  return (
    <div className={styles.verdict}>
      <p className={styles.verdictLabel}>
        {t("portfolio.projection.journey.verdict.label")}
      </p>

      {figures.sustains !== null && (
        <p className={styles.verdictLead}>
          <Toned value={tone}>
            {sustains
              ? t("portfolio.projection.journey.verdict.sustains")
              : t("portfolio.projection.journey.verdict.fails")}
          </Toned>
        </p>
      )}

      <p className={styles.verdictText}>
        {t("portfolio.projection.journey.verdict.reach", {
          age: figures.withdrawalAge,
        })}
        <strong>{money.compact(figures.atWithdrawal)}</strong>
        {figures.sustains === null &&
          t("portfolio.projection.journey.verdict.todayEnd")}
        {figures.sustains !== null && (
          <>
            {t("portfolio.projection.journey.verdict.today")}
            <Toned value={tone}>
              {t("portfolio.projection.journey.verdict.share", {
                share: percent.format(figures.covered ?? 0),
              })}
            </Toned>
            {sustains
              ? t("portfolio.projection.journey.verdict.forIncome", vars)
              : t("portfolio.projection.journey.verdict.lasts", vars)}
          </>
        )}
      </p>
    </div>
  );
}
