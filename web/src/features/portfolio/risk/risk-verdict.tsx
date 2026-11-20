import { Grid } from "@slotted/react/grid";
import {
  StatCard,
  StatCardComparison,
  StatCardFigure,
  StatCardHeader,
  StatCardLabel,
  StatCardMessage,
  StatCardValue,
} from "@slotted/react/stat-card";

import type { components } from "@/api/schema.gen";
import { classLabel } from "@/features/portfolio/risk/class-label";
import { fullWindow } from "@/features/portfolio/risk/risk-figures";
import {
  countedMonths,
  deepestFall,
  riskLeader,
} from "@/features/portfolio/risk/risk-verdict-figures";
import type { Fall } from "@/features/portfolio/risk/risk-verdict-figures";
import { formatBasisPoints, formatReferenceMonthCompact } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";

type RiskReport = components["schemas"]["RiskReport"];

interface RiskVerdictProps {
  report: RiskReport;
}

// Portfolio risk redesign, block 1: how much the portfolio swings in a typical year, how deep it
// fell and when it came back, and which class carries the swing (RK7, RK8, RK10), in words.
// The figures are plain: the section's surface is their only frame (Slotted OV-08).
export function RiskVerdict({ report }: RiskVerdictProps) {
  const t = useT();
  const [tag] = useAppLocale();

  const percent = (bp: number) => formatBasisPoints(bp, tag);
  const month = (iso: string) =>
    formatReferenceMonthCompact(iso.slice(0, 7), tag);
  const swing = report.portfolio.volatility_bp;
  const measured = report.portfolio.volatility_months ?? 0;
  const counted = countedMonths(report);
  const fall = deepestFall(report);
  const leader = riskLeader(report);

  return (
    <Grid minItemWidth="sm" gap={6}>
      <StatCard
        fill="plain"
        layout="stacked"
        status={swing === undefined ? "empty" : "ready"}
      >
        <StatCardHeader>
          <StatCardLabel>
            {measured > 0 && measured < fullWindow
              ? t("portfolio.risk.verdict.swingShort", { count: measured })
              : t("portfolio.risk.verdict.swing")}
          </StatCardLabel>
        </StatCardHeader>
        <StatCardFigure>
          <StatCardValue
            value={swing === undefined ? "" : `±${percent(swing)}`}
          />
        </StatCardFigure>
        <StatCardComparison>
          {t("portfolio.risk.verdict.swingMeaning")}
        </StatCardComparison>
        <StatCardMessage>
          {t("portfolio.risk.verdict.swingFloor", { count: counted })}
        </StatCardMessage>
      </StatCard>

      <StatCard
        fill="plain"
        layout="stacked"
        status={fall === undefined ? "empty" : "ready"}
      >
        <StatCardHeader>
          <StatCardLabel>{t("portfolio.risk.verdict.fall")}</StatCardLabel>
        </StatCardHeader>
        <StatCardFigure>
          <StatCardValue value={fall === undefined ? "" : percent(fall.bp)} />
        </StatCardFigure>
        <StatCardComparison>
          {fall && fallLine(fall, t, month)}
        </StatCardComparison>
        <StatCardMessage>{t("portfolio.risk.verdict.noFall")}</StatCardMessage>
      </StatCard>

      <StatCard
        fill="plain"
        layout="stacked"
        status={leader === undefined ? "empty" : "ready"}
      >
        <StatCardHeader>
          <StatCardLabel>
            {leader === undefined
              ? t("portfolio.risk.verdict.sourceNone")
              : t("portfolio.risk.verdict.source", {
                  class: classLabel(t, leader.key),
                })}
          </StatCardLabel>
        </StatCardHeader>
        <StatCardFigure>
          <StatCardValue
            value={
              leader === undefined ? "" : percent(leader.risk_share_bp ?? 0)
            }
          />
        </StatCardFigure>
        <StatCardComparison>
          {leader !== undefined &&
            t("portfolio.risk.verdict.sourceWeight", {
              weight: percent(leader.weight_bp ?? 0),
            })}
        </StatCardComparison>
        <StatCardMessage>
          {t("portfolio.risk.verdict.sourceFloor")}
        </StatCardMessage>
      </StatCard>
    </Grid>
  );
}

function fallLine(
  fall: Fall,
  t: ReturnType<typeof useT>,
  month: (iso: string) => string,
): string {
  const at = month(fall.month);

  if (fall.end.kind === "recovered") {
    return t("portfolio.risk.verdict.fallBack", {
      month: at,
      back: month(fall.end.month),
    });
  }

  if (fall.end.kind === "below")
    return t("portfolio.risk.verdict.fallBelow", { month: at });

  return t("portfolio.risk.verdict.fallUnmeasured", { month: at });
}
