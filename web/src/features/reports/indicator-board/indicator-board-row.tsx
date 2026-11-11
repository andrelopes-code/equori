import { Text } from "@slotted/react/typography";

import type { MessageKey } from "@/i18n/catalog.en";
import type {
  PositionKind,
  PositionRow,
} from "@/features/reports/model/indicator-series";
import styles from "@/features/reports/indicator-board/indicator-board-row.module.css";
import { RangeStrip } from "@/features/reports/indicator-board/range-strip";
import type { IndicatorFormat } from "@/features/reports/model/use-indicator-format";
import { useT } from "@/i18n/i18n-provider";

export interface IndicatorBoardRowProps {
  row: PositionRow;
  format: IndicatorFormat;
}

const titles: Record<PositionKind, MessageKey> = {
  savings_rate: "report.indicators.savings",
  liquidity: "overview.indicators.reserve",
  committed_share: "report.indicators.committed",
  debt_service_share: "report.indicators.debt",
};

const units: Record<PositionKind, MessageKey> = {
  savings_rate: "report.indicators.unit.savings",
  liquidity: "report.indicators.unit.reserve",
  committed_share: "report.indicators.unit.committed",
  debt_service_share: "report.indicators.unit.debt",
};

// One ratio: its name and unit, where the month stands among the twelve, and the month's value.
export function IndicatorBoardRow({ row, format }: IndicatorBoardRowProps) {
  const t = useT();
  const title = t(titles[row.kind]);
  const partial = row.state.kind === "strip" && row.state.markerHidden;

  return (
    <div className={styles.row}>
      <div className={styles.name}>
        <Text size="md" weight="semibold">
          {title}
        </Text>

        <Text size="xs" tone="muted">
          {t(units[row.kind])}
        </Text>
      </div>

      <div className={styles.position}>
        {row.state.kind === "strip" && row.value !== null && (
          <RangeStrip
            title={title}
            value={row.value}
            state={row.state}
            format={(bp) => format.ratio(row.kind, bp)}
          />
        )}

        {row.state.kind === "reason" && (
          <Text size="sm" tone="muted">
            {t(`overview.indicators.reason.${row.state.reason}`)}
          </Text>
        )}

        {row.state.kind === "short" && (
          <Text size="sm" tone="muted">
            {t("report.indicators.board.short")}
          </Text>
        )}

        {row.state.kind === "none" && (
          <Text size="sm" tone="muted">
            {t("overview.indicators.noDebt")}
          </Text>
        )}
      </div>

      <div className={styles.value}>
        <Text size="xl" weight="semibold" className={styles.figure}>
          {row.value === null
            ? t("report.none")
            : format.ratio(row.kind, row.value)}
        </Text>

        {partial && (
          <Text size="xs" tone="muted">
            {t("report.indicators.board.partial")}
          </Text>
        )}
      </div>
    </div>
  );
}
