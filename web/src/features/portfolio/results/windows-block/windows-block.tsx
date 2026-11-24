import {
  Section,
  SectionBody,
  SectionDescription,
  SectionHeader,
  SectionHeading,
  SectionTitle,
} from "@slotted/react/section";
import { useMemo } from "react";

import type { components } from "@/api/schema.gen";
import { WindowTiles } from "@/features/portfolio/results/windows-block/window-tiles";
import styles from "@/features/portfolio/results/windows-block/windows-block.module.css";
import { windowFigures } from "@/features/portfolio/results/windows-block/windows-figures";
import { WindowsPlot } from "@/features/portfolio/results/windows-block/windows-plot";
import { formatDate } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";

type ReturnSeries = components["schemas"]["ReturnSeries"];

interface WindowsBlockProps {
  // The history read: the whole history by month, whatever the period.
  history: ReturnSeries | undefined;
}

// PR7: the return of the 12 months that end on each month, over the whole history; under 12 months
// the block states the date its first window closes.
export function WindowsBlock({ history }: WindowsBlockProps) {
  const t = useT();
  const [tag] = useAppLocale();

  const figures = useMemo(
    () => (history === undefined ? undefined : windowFigures(history)),
    [history],
  );

  if (history === undefined || figures === undefined) return null;

  return (
    <Section
      size="lg"
      ground="surface"
      heading="title"
      aria-label={t("portfolio.results.windows")}
    >
      <SectionHeader>
        <SectionTitle>
          <SectionHeading>{t("portfolio.results.windows")}</SectionHeading>
          <SectionDescription>
            {t("portfolio.results.windows.description")}
          </SectionDescription>
        </SectionTitle>
      </SectionHeader>

      <SectionBody>
        {figures.extremes === null && (
          <p className={styles.reason}>
            {t("portfolio.results.windows.short", {
              date: formatDate(figures.firstClose, tag),
              months: figures.months,
            })}
          </p>
        )}

        {figures.extremes !== null && (
          <>
            <WindowTiles figures={figures} to={history.to} />

            <div className={styles.plotBox}>
              <WindowsPlot figures={figures} />
            </div>
          </>
        )}
      </SectionBody>
    </Section>
  );
}
