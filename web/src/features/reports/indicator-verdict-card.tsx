import { Card, CardBody } from "@slotted/react/card";
import { Inline } from "@slotted/react/inline";
import { Stack } from "@slotted/react/stack";
import { Tag } from "@slotted/react/tag";
import { Text } from "@slotted/react/typography";

import type { Indicators } from "@/features/overview";
import { ledger, verdict } from "@/features/reports/indicator-verdict";
import styles from "@/features/reports/indicator-verdict-card.module.css";
import { verdictText } from "@/features/reports/indicator-verdict-text";
import { MonthLedger } from "@/features/reports/month-ledger";
import { useIndicatorFormat } from "@/features/reports/use-indicator-format";
import { useT } from "@/i18n/i18n-provider";

export interface IndicatorVerdictCardProps {
  report: Indicators;
  // The asked month is the month of today: its figures run to today.
  incomplete: boolean;
  today: string;
}

// The answer to the first question of the tab: the savings rate of the month against the reader's
// own 12-month mean, beside the money of the month. The left block has three fixed slots (label,
// figure, one line), so a month with no rate or an incomplete one changes words, not the shape.
export function IndicatorVerdictCard({
  report,
  incomplete,
  today,
}: IndicatorVerdictCardProps) {
  const t = useT();
  const format = useIndicatorFormat(report.currency);

  if (format === null) return null;

  const month = report.months.at(-1)?.month ?? "";
  const text = verdictText(verdict(report, incomplete), { t, format, month });

  return (
    <Card>
      <CardBody>
        <div className={styles.frame}>
          <div className={styles.layout}>
            <Stack gap={3}>
              <Inline gap={4} align="center" wrap="wrap">
                <Text size="sm" tone="muted">
                  {t("report.indicators.verdict.label", {
                    month: format.month(month),
                  })}
                </Text>

                {incomplete && (
                  <Tag>
                    {t("report.indicators.progress", {
                      date: format.day(today),
                    })}
                  </Tag>
                )}
              </Inline>

              <Text
                className={styles.figure}
                size="3xl"
                weight="semibold"
                tone={text.provisional ? "muted" : "inherit"}
              >
                {text.figure ?? t("report.none")}
              </Text>

              <Text className={styles.line} size="md">
                {text.line}
              </Text>
            </Stack>

            <MonthLedger ledger={ledger(report)} format={format} />
          </div>
        </div>
      </CardBody>
    </Card>
  );
}
