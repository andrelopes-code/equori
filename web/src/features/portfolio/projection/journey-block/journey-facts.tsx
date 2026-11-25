import styles from "@/features/portfolio/projection/journey-block/journey-block.module.css";
import type { JourneyFigures } from "@/features/portfolio/projection/journey-block/journey-figures";
import { useJourneyMoney } from "@/features/portfolio/projection/journey-block/use-journey-money";
import { FactRow } from "@/features/portfolio/results/shared/fact-row";
import { formatSignedBasisPoints } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { Toned } from "@/ui/money/toned";

interface JourneyFactsProps {
  figures: JourneyFigures;
  currency: string;
  scale: number;
}

// PX6: today against the plan, the money contributed and the return to the withdrawal age, the
// amount needed and the income the plan sustains.
export function JourneyFacts({ figures, currency, scale }: JourneyFactsProps) {
  const t = useT();
  const [tag] = useAppLocale();
  const money = useJourneyMoney(currency, scale);

  const { versus, income } = figures;
  const age = figures.withdrawalAge;
  const sustained = t("portfolio.projection.journey.facts.perMonth", {
    amount: money.exact(figures.sustained),
  });

  return (
    <dl className={styles.bridge}>
      {versus !== null && (
        <FactRow label={t("portfolio.projection.journey.facts.versus")}>
          <Toned value={versus.difference}>
            {t("portfolio.projection.journey.facts.versusValue", {
              amount: money.signed(versus.difference),
              share: formatSignedBasisPoints(
                Math.round(versus.differenceShare * 10000),
                tag,
              ),
            })}
          </Toned>
        </FactRow>
      )}

      <FactRow
        label={t("portfolio.projection.journey.facts.contributed", { age })}
      >
        {money.exact(figures.contributed)}
      </FactRow>

      <FactRow label={t("portfolio.projection.journey.facts.return", { age })}>
        <Toned value={figures.gain}>{money.signed(figures.gain)}</Toned>
      </FactRow>

      {figures.needed !== null && (
        <FactRow
          label={t("portfolio.projection.journey.facts.needed", { age })}
        >
          {money.exact(figures.needed)}
        </FactRow>
      )}

      <FactRow label={t("portfolio.projection.journey.facts.sustained")}>
        {income === null && sustained}
        {income !== null && (
          <Toned value={figures.sustained - income}>{sustained}</Toned>
        )}
      </FactRow>
    </dl>
  );
}
