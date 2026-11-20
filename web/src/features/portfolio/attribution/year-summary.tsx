import { Text } from "@slotted/react/typography";

import type { components } from "@/api/schema.gen";
import type { AttributionTally } from "@/features/portfolio/attribution/attribution-rows";
import { SummaryFacts } from "@/features/portfolio/attribution/summary-facts";
import { summaryFigures } from "@/features/portfolio/attribution/summary-figures";
import { SummaryLine } from "@/features/portfolio/attribution/summary-line";
import styles from "@/features/portfolio/attribution/year-summary.module.css";
import { useT } from "@/i18n/i18n-provider";

type AttributionYear = components["schemas"]["AttributionYear"];

interface YearSummaryProps {
  year: AttributionYear;
  period: string;
  gains: AttributionTally;
  losses: AttributionTally;
  currency: string;
  scale: number;
}

// build-own-element: the year beside the same money at the CDI and the IPCA, as bars on one axis
// with the rate and the money of each, then the figures that compare them (AT8, AT10 to AT12).
export function YearSummary({
  year,
  period,
  gains,
  losses,
  currency,
  scale,
}: YearSummaryProps) {
  const t = useT();

  const figures = summaryFigures(year);
  const compared = figures.lines.length > 1;

  return (
    <div className={styles.summary}>
      <Text size="sm" weight="semibold">
        {t("portfolio.attribution.summary.title", { period })}
      </Text>

      <div className={styles.lines}>
        {figures.lines.map((line) => (
          <SummaryLine
            key={line.kind}
            line={line}
            low={figures.low}
            high={figures.high}
            currency={currency}
            scale={scale}
          />
        ))}
      </div>

      {compared && (
        <Text size="xs" tone="muted">
          {t("portfolio.attribution.summary.note")}
        </Text>
      )}

      <SummaryFacts
        figures={figures}
        gains={gains}
        losses={losses}
        currency={currency}
        scale={scale}
      />
    </div>
  );
}
