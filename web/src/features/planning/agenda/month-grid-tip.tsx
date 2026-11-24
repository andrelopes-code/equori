import { Text } from "@slotted/react/typography";

import styles from "@/features/planning/agenda/month-grid.module.css";
import type { AgendaRow } from "@/features/planning/model/agenda";
import { useT } from "@/i18n/i18n-provider";
import { useMoneyFormat } from "@/privacy/use-money-format";

interface MonthGridTipProps {
  rows: readonly AgendaRow[];
  scale: (code: string) => number;
}

// The occurrences of a day, one per line.
export function MonthGridTip({ rows, scale }: MonthGridTipProps) {
  const t = useT();
  const fmt = useMoneyFormat();

  return rows.map((r) => (
    <span key={r.occurrence.id} className={styles.tipRow}>
      <Text size="xs">{r.schedule?.description ?? t("ledger.untitled")}</Text>
      <Text size="xs" numeric="tabular">
        {fmt.signed(r.money, scale(r.money.currency))}
      </Text>
    </span>
  ));
}
