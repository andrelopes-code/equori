import { Stack } from "@slotted/react/stack";
import { Text } from "@slotted/react/typography";

import type { components } from "@/api/schema.gen";
import { classLabel } from "@/features/portfolio/risk/class-label";
import { riskNotes } from "@/features/portfolio/risk/risk-figures";
import { formatBasisPoints } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";

type RiskReport = components["schemas"]["RiskReport"];

// The securities named, the most months first: a longer list breaks the line.
const shownLeftOut = 3;

interface RiskNotesProps {
  report: RiskReport;
}

// RK3, RK7, RK11: the months left out, a short sample, and the classes priced by accrual.
export function RiskNotes({ report }: RiskNotesProps) {
  const t = useT();
  const [tag] = useAppLocale();

  const notes = riskNotes(report);
  const accrued = report.classes.filter((c) => (c.accrual_bp ?? 0) > 0);

  return (
    <Stack gap={1}>
      {notes.unknownMonths > 0 && (
        <Text size="sm" tone="muted">
          {t("portfolio.risk.unknown", {
            count: notes.unknownMonths,
            classes: notes.unknownClasses
              .map((k) => classLabel(t, k))
              .join(", "),
          })}
        </Text>
      )}

      {report.left_out.length > 0 && (
        <Text size="sm" tone="muted">
          {t("portfolio.risk.leftOut", {
            list: report.left_out
              .slice(0, shownLeftOut)
              .map((l) =>
                t("portfolio.risk.leftOutItem", {
                  code: l.instrument,
                  months: l.months,
                }),
              )
              .join(", "),
          })}
        </Text>
      )}

      {notes.shortSample !== undefined && (
        <Text size="sm" tone="muted">
          {t("portfolio.risk.short", { count: notes.shortSample })}
        </Text>
      )}

      {notes.belowFloor !== undefined && (
        <Text size="sm" tone="muted">
          {t("portfolio.risk.floor", { count: notes.belowFloor })}
        </Text>
      )}

      {accrued.map((c) => (
        <Text key={c.key} size="sm" tone="muted">
          {t("portfolio.risk.accrual", {
            class: classLabel(t, c.key),
            share: formatBasisPoints(c.accrual_bp ?? 0, tag),
          })}
        </Text>
      ))}
    </Stack>
  );
}
