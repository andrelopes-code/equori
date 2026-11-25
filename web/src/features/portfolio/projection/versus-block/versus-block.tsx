import {
  Section,
  SectionBody,
  SectionDescription,
  SectionHeader,
  SectionHeading,
  SectionTitle,
} from "@slotted/react/section";

import type { components } from "@/api/schema.gen";
import { contributionIn } from "@/features/portfolio/projection/model/contribution-in";
import type { ProjectionDraft } from "@/features/portfolio/projection/model/plan-fields";
import { versusSince } from "@/features/portfolio/projection/model/versus-since";
import styles from "@/features/portfolio/projection/versus-block/versus-block.module.css";
import { VersusKey } from "@/features/portfolio/projection/versus-block/versus-key";
import { VersusPlot } from "@/features/portfolio/projection/versus-block/versus-plot";
import { versusRows } from "@/features/portfolio/projection/versus-block/versus-rows";
import { comparisonStart } from "@/features/portfolio/projection/versus-block/versus-start";
import { VersusTiles } from "@/features/portfolio/projection/versus-block/versus-tiles";
import { useScale } from "@/features/setup";
import { formatDate, formatMonthSlashYear } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { useToday } from "@/i18n/today";

interface VersusBlockProps {
  draft: ProjectionDraft;
  history: components["schemas"]["ReturnSeries"];
  baseline: components["schemas"]["ProjectionBaseline"] | undefined;
  annualReal: number | null;
}

// PX7: the plan line against the recorded value since the baseline, drawn only for a stored plan.
// A baseline younger than one month states the day the comparison starts.
export function VersusBlock({
  draft,
  history,
  baseline,
  annualReal,
}: VersusBlockProps) {
  const t = useT();
  const [tag] = useAppLocale();
  const today = useToday();
  const scale = useScale();

  if (baseline === undefined) return null;

  const digits = scale?.(draft.currency) ?? 0;
  const compared = versusSince(
    baseline,
    draft.changes,
    draft.realReturnBp,
    draft.inflationBp,
    history.points,
  );

  return (
    <Section
      size="lg"
      ground="surface"
      heading="title"
      aria-label={t("portfolio.projection.versus")}
    >
      <SectionHeader>
        <SectionTitle>
          <SectionHeading>{t("portfolio.projection.versus")}</SectionHeading>
          {compared !== null && (
            <SectionDescription>
              {t("portfolio.projection.versus.description", {
                month: formatMonthSlashYear(baseline.date.slice(0, 7), tag),
              })}
            </SectionDescription>
          )}
        </SectionTitle>
      </SectionHeader>

      <SectionBody>
        {compared === null && (
          <p className={styles.young}>
            {t("portfolio.projection.versus.young", {
              date: formatDate(comparisonStart(baseline.date), tag),
            })}
          </p>
        )}

        {compared !== null && (
          <>
            <VersusTiles
              figures={compared.figures}
              planned={contributionIn(draft.changes, today.slice(0, 7))}
              annualReal={annualReal}
              expectedBp={draft.realReturnBp}
              currency={draft.currency}
              scale={digits}
            />

            <div className={styles.plotBox}>
              <VersusKey />

              <VersusPlot
                rows={versusRows(
                  baseline,
                  compared.since,
                  compared.line,
                  digits,
                )}
                currency={draft.currency}
                scale={digits}
              />
            </div>
          </>
        )}
      </SectionBody>
    </Section>
  );
}
