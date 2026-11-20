import { Text } from "@slotted/react/typography";

import type { components } from "@/api/schema.gen";
import { classLabel } from "@/features/portfolio/risk/class-label";
import styles from "@/features/portfolio/risk/risk-verdict.module.css";
import {
  countedMonths,
  deepestFall,
  riskLeader,
} from "@/features/portfolio/risk/risk-verdict-figures";
import type { Fall } from "@/features/portfolio/risk/risk-verdict-figures";
import { useScale } from "@/features/setup";
import { formatBasisPoints, formatReferenceMonth } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { useMoneyFormat } from "@/privacy/use-money-format";

type RiskReport = components["schemas"]["RiskReport"];

interface RiskVerdictProps {
  report: RiskReport;
  // The value of the portfolio in the report's currency, in minor units: the typical swing reads
  // as money too.
  total: number;
}

// Portfolio risk redesign, block 1: three plain sentences, each led by its figure: how much the
// portfolio usually varies in a year, its deepest fall and how it ended, and where the variation
// comes from (RK7, RK8, RK10). The words carry the meaning; "Details and how to read" holds the
// terms.
export function RiskVerdict({ report, total }: RiskVerdictProps) {
  const t = useT();
  const [tag] = useAppLocale();
  const fmt = useMoneyFormat();
  const scale = useScale();

  const percent = (bp: number) => formatBasisPoints(bp, tag);
  const month = (iso: string) => formatReferenceMonth(iso.slice(0, 7), tag);
  const swing = report.portfolio.volatility_bp;
  const fall = deepestFall(report);
  const leader = riskLeader(report);
  // An estimate reads in whole units of the currency: cents would claim a precision it lacks.
  const swingMoney =
    swing === undefined || scale === null
      ? ""
      : fmt.money(
          {
            amount: Math.round(
              (total * swing) / 10000 / 10 ** scale(report.value_in),
            ),
            currency: report.value_in,
          },
          0,
        );

  return (
    <dl className={styles.rows}>
      <dt className={styles.figure}>
        <Text size="lg" weight="semibold">
          {swing === undefined ? "—" : `±${percent(swing)}`}
        </Text>
      </dt>
      <dd className={styles.sentence}>
        <Text size="sm">
          {swing === undefined
            ? t("portfolio.risk.verdict.swingFloor", {
                count: countedMonths(report),
              })
            : t("portfolio.risk.verdict.swing", { money: swingMoney })}
        </Text>
      </dd>

      <dt className={styles.figure}>
        <Text size="lg" weight="semibold">
          {fall === undefined ? "—" : percent(fall.bp)}
        </Text>
      </dt>
      <dd className={styles.sentence}>
        <Text size="sm">
          {fall === undefined
            ? t("portfolio.risk.verdict.noFall")
            : fallSentence(fall, t, month)}
        </Text>
      </dd>

      <dt className={styles.figure}>
        <Text size="lg" weight="semibold">
          {leader === undefined ? "—" : percent(leader.risk_share_bp ?? 0)}
        </Text>
      </dt>
      <dd className={styles.sentence}>
        <Text size="sm">
          {leader === undefined
            ? t("portfolio.risk.verdict.sourceFloor")
            : t("portfolio.risk.verdict.source", {
                class: classLabel(t, leader.key),
                weight: percent(leader.weight_bp ?? 0),
              })}
        </Text>
      </dd>
    </dl>
  );
}

function fallSentence(
  fall: Fall,
  t: ReturnType<typeof useT>,
  month: (iso: string) => string,
): string {
  const words = { from: month(fall.peak ?? fall.month), to: month(fall.month) };

  if (fall.end.kind === "recovered") {
    return t("portfolio.risk.verdict.fallBack", {
      ...words,
      back: month(fall.end.month),
    });
  }

  if (fall.end.kind === "below") {
    return t("portfolio.risk.verdict.fallBelow", words);
  }

  return t("portfolio.risk.verdict.fallUnmeasured", words);
}
