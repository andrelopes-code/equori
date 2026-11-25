import {
  Section,
  SectionActions,
  SectionBody,
  SectionDescription,
  SectionHeader,
  SectionHeading,
  SectionTitle,
} from "@slotted/react/section";
import { Segment, SegmentedControl } from "@slotted/react/segmented-control";
import { useMemo, useState } from "react";

import type { components } from "@/api/schema.gen";
import { JourneyFacts } from "@/features/portfolio/projection/journey-block/journey-facts";
import { journeyFigures } from "@/features/portfolio/projection/journey-block/journey-figures";
import { JourneyKey } from "@/features/portfolio/projection/journey-block/journey-key";
import { JourneyPath } from "@/features/portfolio/projection/journey-block/journey-path";
import { JourneyPlot } from "@/features/portfolio/projection/journey-block/journey-plot";
import { journeyRows } from "@/features/portfolio/projection/journey-block/journey-rows";
import { JourneyVerdict } from "@/features/portfolio/projection/journey-block/journey-verdict";
import { monthEnd } from "@/features/portfolio/projection/journey-block/journey-months";
import styles from "@/features/portfolio/projection/journey-block/journey-block.module.css";
import { useJourneyAxes } from "@/features/portfolio/projection/journey-block/use-journey-axes";
import type { ProjectionDraft } from "@/features/portfolio/projection/model/plan-fields";
import { toNominal } from "@/features/portfolio/projection/model/to-nominal";
import { useScale } from "@/features/setup";
import { formatYear } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { useToday } from "@/i18n/today";

type View = "real" | "nominal";

interface JourneyBlockProps {
  draft: ProjectionDraft;
  history: components["schemas"]["ReturnSeries"];
  birthDate: string;
  baseline: components["schemas"]["ProjectionBaseline"] | undefined;
}

// PX6: the recorded value and the projection on one plot, and beside it whether the plan sustains
// the income. The switch changes the plot to nominal values; the figures stay in today's money.
export function JourneyBlock({
  draft,
  history,
  birthDate,
  baseline,
}: JourneyBlockProps) {
  const t = useT();
  const [tag] = useAppLocale();
  const today = useToday();
  const scale = useScale();

  const [view, setView] = useState<View>("real");

  const digits = scale?.(draft.currency) ?? 0;
  const axes = useJourneyAxes(
    draft.currency,
    digits,
    Number(birthDate.slice(0, 4)),
  );
  const figures = useMemo(
    () => journeyFigures({ draft, history, birthDate, today, baseline }),
    [draft, history, birthDate, today, baseline],
  );
  const shown =
    view === "nominal"
      ? toNominal(figures.rows, draft.inflationBp)
      : figures.rows;
  const rows = journeyRows(history, shown, figures.withdrawalFrom, digits);
  const todayDate = history.points.at(-1)?.date;
  const from = formatYear(history.points[0]?.date ?? today, tag);

  function handleView(value: string) {
    setView(value === "nominal" ? "nominal" : "real");
  }

  return (
    <Section
      size="lg"
      ground="surface"
      heading="title"
      aria-label={t("portfolio.projection.journey")}
    >
      <SectionHeader>
        <SectionTitle>
          <SectionHeading>{t("portfolio.projection.journey")}</SectionHeading>
          <SectionDescription>
            {t(`portfolio.projection.journey.description.${view}`, {
              from,
              last: draft.lastAge,
            })}
          </SectionDescription>
        </SectionTitle>

        <SectionActions>
          <SegmentedControl
            size="sm"
            aria-label={t("portfolio.projection.journey.view")}
            value={view}
            onValueChange={handleView}
          >
            <Segment value="real">
              {t("portfolio.projection.journey.view.real")}
            </Segment>
            <Segment value="nominal">
              {t("portfolio.projection.journey.view.nominal")}
            </Segment>
          </SegmentedControl>
        </SectionActions>
      </SectionHeader>

      <SectionBody>
        <div className={[styles.hero, styles.heroEnd].join(" ")}>
          <div className={styles.heroPlot}>
            <JourneyKey />

            <JourneyPlot
              rows={rows}
              axes={axes}
              todayDate={todayDate}
              withdrawalDate={monthEnd(figures.withdrawalFrom)}
              withdrawalAge={draft.withdrawalAge}
            />
          </div>

          <div className={styles.heroSide}>
            <JourneyVerdict
              figures={figures}
              currency={draft.currency}
              scale={digits}
            />

            <JourneyPath
              figures={figures}
              currency={draft.currency}
              scale={digits}
            />

            <JourneyFacts
              figures={figures}
              currency={draft.currency}
              scale={digits}
            />
          </div>
        </div>
      </SectionBody>
    </Section>
  );
}
