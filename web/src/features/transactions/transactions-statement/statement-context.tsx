import { Text } from "@slotted/react/typography";

import type {
  TransactionSearch,
  TransactionSearchDraft,
} from "@/features/transactions/model/search";
import { statementCountKey } from "@/features/transactions/transactions-statement/statement-count";
import styles from "@/features/transactions/transactions-statement/transactions-statement.module.css";
import { numberFormatter } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { PeriodMenu } from "@/ui/navigation/period-menu";

interface StatementContextProps {
  search: TransactionSearch;
  onSearchChange: (next: TransactionSearchDraft) => void;
  count: number | undefined;
  hasMore: boolean;
}

// The period the statement reads and how many rows it holds, on one line above the list (spec
// 2026-11-21-mobile-statement, MS11).
export function StatementContext({
  search,
  onSearchChange,
  count,
  hasMore,
}: StatementContextProps) {
  const t = useT();
  const [locale] = useAppLocale();

  const period =
    search.from !== undefined && search.to !== undefined
      ? { from: search.from, to: search.to }
      : undefined;

  return (
    <div className={styles.context}>
      <PeriodMenu
        value={period}
        onChange={(next) => {
          onSearchChange({ ...search, from: next?.from, to: next?.to });
        }}
      />

      {count !== undefined && (
        <Text size="sm" tone="muted" numeric="tabular">
          {t(statementCountKey(count, hasMore, locale), {
            count: numberFormatter(locale).format(count),
          })}
        </Text>
      )}
    </div>
  );
}
