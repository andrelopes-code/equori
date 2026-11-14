import { Grid } from "@slotted/react/grid";
import { Inline } from "@slotted/react/inline";
import { Stack } from "@slotted/react/stack";
import { Text } from "@slotted/react/typography";

import type { components } from "@/api/schema.gen";
import { indexName } from "@/features/calculators";
import { ReturnBars } from "@/features/portfolio/return/return-bars";
import { returnMoney } from "@/features/portfolio/return-money/return-money";
import { ReturnMoneyPanel } from "@/features/portfolio/return-money/return-money-panel";
import { ReturnMethod } from "@/features/portfolio/return/return-method";
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
import { HelpTip } from "@/ui/display/help-tip";

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

// RC1: the verdict, the comparisons beside the money panel, the notes, the profile sentence of
// R17, then the details. A report with nothing of these states the personal rate in a sentence on
// the portfolio (HR3, amending PC11) and draws nothing on an account.
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

  if (subject === "account" && bare && notes.length === 0) return null;

  return (
    <Stack gap={4}>
      {verdict !== undefined && (
        <Inline gap={0} align="center" wrap="nowrap">
          <Text size="lg" weight="semibold">
            {verdict}
          </Text>
          <HelpTip
            label={t("return.help.about", {
              term: t("holdings.method.period"),
            })}
            text={verdictHelp ?? ""}
          />
        </Inline>
      )}

      {subject === "portfolio" && bare && (
        <Text size="lg" weight="semibold">
          {t("return.verdict.personal", {
            annual: formatBasisPoints(report.annual_bp, tag),
          })}
        </Text>
      )}

      {showGrid && (
        <Grid columns={showBars ? 2 : 1} minItemWidth="lg" gap={8}>
          {showBars && <ReturnBars comparisons={comparisons} axis={axis} />}

          <ReturnMoneyPanel report={report} surface={subject} />
        </Grid>
      )}

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

      <ReturnMethod report={report} groups={groups} />
    </Stack>
  );
}
