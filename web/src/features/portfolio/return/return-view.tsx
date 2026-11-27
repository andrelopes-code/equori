import { Text } from "@slotted/react/typography";

import type { components } from "@/api/schema.gen";
import { indexName } from "@/features/calculators";
import { ReturnBars } from "@/features/portfolio/return/return-bars";
import { ReturnLead } from "@/features/portfolio/return/return-lead";
import { returnMoney } from "@/features/portfolio/return-money/return-money";
import { ReturnMoneyPanel } from "@/features/portfolio/return-money/return-money-panel";
import { ReturnMethod } from "@/features/portfolio/return/return-method";
import styles from "@/features/portfolio/return/return-view.module.css";
import {
  returnSummary,
  type ReturnSubject,
} from "@/features/portfolio/model/return-summary";
import {
  yieldGroups,
  yieldNotes,
  type YieldWindow,
} from "@/features/portfolio/model/yield-figures";
import { useScale } from "@/features/setup";
import { formatBasisPoints } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { useMoneyFormat } from "@/privacy/use-money-format";

type Money = components["schemas"]["Money"];
type ReturnReport = components["schemas"]["ReturnReport"];

interface ReturnViewProps {
  report: ReturnReport;
  subject: ReturnSubject;
  window?: YieldWindow;
  // The calendar span of the period, its two ends included; above a year the verdict states the
  // annual rate (return honesty HR3).
  days?: number;
}

// RK1 to RK6 (docs/specs/2026-11-17-return-card-design.md): the gain and the verdict lead, the
// comparisons stand beside the origin of the closing balance, and the foot holds the notes, the
// profile sentence of R17, the annual rate and the details. A report with nothing of these
// states the personal rate in a sentence on the portfolio (HR3, amending PC11) and draws nothing
// on an account.
export function ReturnView({ report, subject, window, days }: ReturnViewProps) {
  const t = useT();
  const [tag] = useAppLocale();
  const fmt = useMoneyFormat();
  const scale = useScale();

  const { verdict, verdictHelp, comparisons, axis } = returnSummary(
    report,
    subject,
    t,
    tag,
    days,
  );
  const groups = yieldGroups(report, t, tag, window);
  const notes = yieldNotes(report, t, (m: Money) =>
    fmt.money(m, scale?.(m.currency) ?? 0),
  );
  const index = report.benchmark && indexName(report.benchmark.index);
  const bare = verdict === undefined && groups.length === 0;
  const showBars = comparisons.length > 0 && axis !== undefined;
  const showGrid = showBars || returnMoney(report) !== undefined;
  const personal =
    subject === "portfolio" && bare && report.annual_bp !== undefined
      ? t("return.verdict.personal", {
          annual: formatBasisPoints(report.annual_bp, tag),
        })
      : undefined;

  if (subject === "account" && bare && notes.length === 0) return null;

  return (
    <div className={styles.layout}>
      <ReturnLead
        report={report}
        sentence={verdict ?? personal}
        help={verdict === undefined ? undefined : (verdictHelp ?? "")}
      />

      {showGrid && (
        <div className={styles.columns}>
          {showBars && (
            <div data-return="against">
              <ReturnBars comparisons={comparisons} axis={axis} />
            </div>
          )}

          <ReturnMoneyPanel report={report} />
        </div>
      )}

      <div className={styles.foot} data-return="foot">
        <div className={styles.footNotes}>
          {notes.map((note) => (
            <Text key={note} size="sm" tone="muted">
              {note}
            </Text>
          ))}

          {index !== undefined && (
            <Text size="sm" tone="muted">
              {t(`portfolio.yield.profile.${report.profile}`, { index })}
            </Text>
          )}
        </div>

        <div className={styles.footEnd}>
          <ReturnMethod report={report} groups={groups} />
        </div>
      </div>
    </div>
  );
}
