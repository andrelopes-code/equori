import {
  Section,
  SectionActions,
  SectionBody,
  SectionDescription,
  SectionHeader,
  SectionHeading,
  SectionTitle,
} from "@slotted/react/section";

import type { components } from "@/api/schema.gen";
import {
  blockFigures,
  comparisonsOf,
} from "@/features/portfolio/results/return-block/block-figures";
import styles from "@/features/portfolio/results/return-block/return-block.module.css";
import { ReturnFacts } from "@/features/portfolio/results/return-block/return-facts";
import { ReturnMethodAction } from "@/features/portfolio/results/return-block/return-method-action";
import { ReturnPlot } from "@/features/portfolio/results/return-block/return-plot";
import { ReturnVerdict } from "@/features/portfolio/results/return-block/return-verdict";
import { SeriesList } from "@/features/portfolio/results/return-block/series-list";
import { useChosenSeries } from "@/features/portfolio/results/return-block/use-chosen-series";
import { formatDate } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";

type ReturnReport = components["schemas"]["ReturnReport"];
type ReturnSeries = components["schemas"]["ReturnSeries"];

interface ReturnBlockProps {
  // The period read; the block draws nothing while it is absent.
  series: ReturnSeries | undefined;
  report: ReturnReport | undefined;
  // The period is the whole history.
  whole: boolean;
}

// PR4: the return of the period against the indexes, the series list that switches the lines and
// the figures beside the plot.
export function ReturnBlock({ series, report, whole }: ReturnBlockProps) {
  const t = useT();
  const [tag] = useAppLocale();
  const { on, toggle } = useChosenSeries(series?.indexes ?? []);

  if (series === undefined) return null;

  const figures = blockFigures(series);

  return (
    <Section
      size="lg"
      ground="surface"
      heading="title"
      aria-label={t("portfolio.results.return")}
    >
      <SectionHeader>
        <SectionTitle>
          <SectionHeading>{t("portfolio.results.return")}</SectionHeading>
          <SectionDescription>
            {t("portfolio.results.span", {
              from: formatDate(series.from, tag),
              to: formatDate(series.to, tag),
            })}
          </SectionDescription>
        </SectionTitle>

        <SectionActions>
          <ReturnMethodAction report={report} />
        </SectionActions>
      </SectionHeader>

      <SectionBody>
        <div className={styles.hero}>
          <div className={styles.heroSide}>
            <ReturnVerdict
              total={figures.total}
              whole={whole}
              comparisons={comparisonsOf(figures, on)}
            />

            <SeriesList figures={figures} on={on} onToggle={toggle} />

            <ReturnFacts series={series} figures={figures} />
          </div>

          <div className={styles.heroPlot}>
            <ReturnPlot series={series} figures={figures} on={on} />
          </div>
        </div>
      </SectionBody>
    </Section>
  );
}
