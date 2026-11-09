import { Card, CardBody, CardHeader } from "@slotted/react/card";
import { Heading } from "@slotted/react/typography";

import type { Indicators } from "@/features/overview";
import { IndicatorBoardRow } from "@/features/reports/indicator-board-row";
import styles from "@/features/reports/indicator-board.module.css";
import { positionRows } from "@/features/reports/indicator-series";
import { useIndicatorFormat } from "@/features/reports/use-indicator-format";
import { useT } from "@/i18n/i18n-provider";

export interface IndicatorBoardProps {
  report: Indicators;
  incomplete: boolean;
}

// The second question of the tab: is the month inside the reader's own usual range.
export function IndicatorBoard({ report, incomplete }: IndicatorBoardProps) {
  const t = useT();
  const format = useIndicatorFormat(report.currency);

  if (format === null) return null;

  return (
    <Card>
      <CardHeader>
        <Heading level={3} size="md">
          {t("report.indicators.board.title")}
        </Heading>
      </CardHeader>

      <CardBody>
        <div className={styles.rows}>
          {positionRows(report, incomplete).map((row) => (
            <IndicatorBoardRow key={row.kind} row={row} format={format} />
          ))}
        </div>
      </CardBody>
    </Card>
  );
}
