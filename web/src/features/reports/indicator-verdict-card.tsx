import { Card, CardBody } from "@slotted/react/card";
import { Stack } from "@slotted/react/stack";
import { Tag } from "@slotted/react/tag";
import { Text } from "@slotted/react/typography";

import type { Indicators } from "@/features/overview";
import { verdictSentence } from "@/features/reports/indicator-sentence";
import { ledger, verdict } from "@/features/reports/indicator-verdict";
import styles from "@/features/reports/indicator-verdict-card.module.css";
import { MonthLedger } from "@/features/reports/month-ledger";
import { useIndicatorFormat } from "@/features/reports/use-indicator-format";
import { useT } from "@/i18n/i18n-provider";

export interface IndicatorVerdictCardProps {
  report: Indicators;
  // The asked month is the month of today: its figures run to today.
  incomplete: boolean;
  today: string;
}

// The sentence that answers the first question of the tab, beside the money of the month.
export function IndicatorVerdictCard({
  report,
  incomplete,
  today,
}: IndicatorVerdictCardProps) {
  const t = useT();
  const format = useIndicatorFormat(report.currency);

  if (format === null) return null;

  const month = report.months.at(-1)?.month ?? "";
  const money = ledger(report);
  const sentence = verdictSentence(verdict(report, incomplete), {
    t,
    format,
    month,
    ledger: money,
  });

  return (
    <Card>
      <CardBody>
        <div className={styles.frame}>
          <div className={styles.layout}>
            <Stack gap={5}>
              <Text size="xl" weight="semibold">
                {sentence}
              </Text>

              {incomplete && (
                <div>
                  <Tag>
                    {t("report.indicators.progress", {
                      date: format.day(today),
                    })}
                  </Tag>
                </div>
              )}
            </Stack>

            <MonthLedger ledger={money} format={format} />
          </div>
        </div>
      </CardBody>
    </Card>
  );
}
