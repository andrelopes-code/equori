import {
  DescriptionList,
  DescriptionListDescription,
  DescriptionListItem,
  DescriptionListTerm,
} from "@slotted/react/description-list";
import { Stack } from "@slotted/react/stack";
import { Text } from "@slotted/react/typography";

import type { Indicators } from "@/features/overview";
import { IndicatorAuditTable } from "@/features/reports/indicator-audit/indicator-audit-table";
import { IndicatorBoardRow } from "@/features/reports/indicator-board/indicator-board-row";
import { positionRows } from "@/features/reports/model/indicator-series";
import { useIndicatorFormat } from "@/features/reports/model/use-indicator-format";
import type { MessageKey } from "@/i18n/catalog.en";
import { useT } from "@/i18n/i18n-provider";
import { DetailSection } from "@/ui/dialogs/detail-section";

import styles from "@/features/reports/indicator-audit/indicator-audit-layer.module.css";

export interface IndicatorAuditLayerProps {
  report: Indicators;
  incomplete: boolean;
}

// The definitions that the five charts of the old tab carried as notes.
const definitions: readonly (readonly [MessageKey, MessageKey])[] = [
  ["report.indicators.savings", "report.indicators.savingsNote"],
  ["report.indicators.reserve", "report.indicators.reserveNote"],
  ["report.indicators.committed", "report.indicators.committedNote"],
  ["report.indicators.debt", "report.indicators.debtNote"],
  ["report.indicators.liabilities", "report.indicators.liabilitiesNote"],
];

// L5: the position rows of the month, every figure month by month, then the definitions. The
// table needs the whole width, so the layer has no aside.
export function IndicatorAuditLayer({
  report,
  incomplete,
}: IndicatorAuditLayerProps) {
  const t = useT();
  const format = useIndicatorFormat(report.currency);

  return (
    <Stack gap={6}>
      {format !== null && (
        <DetailSection title={t("report.indicators.board.title")}>
          <div className={styles.rows}>
            {positionRows(report, incomplete).map((row) => (
              <IndicatorBoardRow key={row.kind} row={row} format={format} />
            ))}
          </div>
        </DetailSection>
      )}

      <IndicatorAuditTable report={report} />

      <DetailSection title={t("report.indicators.audit.definitions")}>
        <Stack gap={4}>
          <DescriptionList layout="stack" columns={2}>
            {definitions.map(([term, note]) => (
              <DescriptionListItem key={term}>
                <DescriptionListTerm>{t(term)}</DescriptionListTerm>
                <DescriptionListDescription>
                  {t(note)}
                </DescriptionListDescription>
              </DescriptionListItem>
            ))}
          </DescriptionList>

          <Text size="sm" tone="muted">
            {t("report.indicators.audit.basis")}
          </Text>
        </Stack>
      </DetailSection>
    </Stack>
  );
}
