import {
  Section,
  SectionBody,
  SectionDescription,
  SectionHeader,
  SectionHeading,
  SectionTitle,
} from "@slotted/react/section";

import type { components } from "@/api/schema.gen";
import { cutHistory } from "@/features/portfolio/results/evolution-block/evolution-cut";
import { EvolutionBridge } from "@/features/portfolio/results/evolution-block/evolution-bridge";
import styles from "@/features/portfolio/results/evolution-block/evolution-block.module.css";
import {
  evolutionFigures,
  irrRow,
} from "@/features/portfolio/results/evolution-block/evolution-figures";
import { EvolutionKey } from "@/features/portfolio/results/evolution-block/evolution-key";
import { EvolutionPlot } from "@/features/portfolio/results/evolution-block/evolution-plot";
import { evolutionRows } from "@/features/portfolio/results/evolution-block/evolution-rows";
import { FlowStrip } from "@/features/portfolio/results/evolution-block/flow-strip";
import { useEvolutionAxes } from "@/features/portfolio/results/evolution-block/use-evolution-axes";
import { periodDays } from "@/features/portfolio/return/portfolio-period";
import { useScale } from "@/features/setup";
import { useT } from "@/i18n/i18n-provider";

type ReturnReport = components["schemas"]["ReturnReport"];
type ReturnSeries = components["schemas"]["ReturnSeries"];

interface EvolutionBlockProps {
  // The history read, cut here to the period.
  history: ReturnSeries | undefined;
  // The period read: its dates are the period of the page.
  period: ReturnSeries | undefined;
  // The return of the period, for the annual rate.
  report: ReturnReport | undefined;
  // The period is the whole history.
  whole: boolean;
}

// PR9: the value against the money contributed, the flow of each month and the bridge from the
// opening value to the closing value.
export function EvolutionBlock({
  history,
  period,
  report,
  whole,
}: EvolutionBlockProps) {
  const t = useT();
  const scale = useScale();

  const cut =
    history === undefined || period === undefined
      ? undefined
      : cutHistory(history, whole ? undefined : period.from, period.to);
  const days = period === undefined ? 0 : periodDays(period.from, period.to);
  const digits = cut === undefined ? 0 : (scale?.(cut.currency) ?? 0);
  const axes = useEvolutionAxes(cut?.currency ?? "", digits, days);

  if (cut === undefined || cut.points.length === 0) return null;

  const rows = evolutionRows(cut, digits);

  return (
    <Section
      size="lg"
      ground="surface"
      heading="title"
      aria-label={t("portfolio.results.evolution")}
    >
      <SectionHeader>
        <SectionTitle>
          <SectionHeading>{t("portfolio.results.evolution")}</SectionHeading>
          <SectionDescription>
            {t("portfolio.results.evolution.description")}
          </SectionDescription>
        </SectionTitle>
      </SectionHeader>

      <SectionBody>
        <div className={[styles.hero, styles.heroEnd].join(" ")}>
          <div className={styles.heroPlot}>
            <EvolutionKey />

            <EvolutionPlot rows={rows} axes={axes} />

            <FlowStrip rows={rows} axes={axes} />
          </div>

          <div className={styles.heroSide}>
            <EvolutionBridge
              figures={evolutionFigures(cut)}
              currency={cut.currency}
              scale={digits}
              irr={irrRow(days, report?.annual_bp)}
            />
          </div>
        </div>
      </SectionBody>
    </Section>
  );
}
