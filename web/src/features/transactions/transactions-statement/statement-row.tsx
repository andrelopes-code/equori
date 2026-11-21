import { Text } from "@slotted/react/typography";

import type { CategoryEntry } from "@/features/categories";
import { AmountCell } from "@/features/transactions/transactions-grid/amount-cell";
import type { ListRow } from "@/features/transactions/transactions-grid/use-transaction-list";
import { statementDetail } from "@/features/transactions/transactions-statement/statement-detail";
import { StatementMark } from "@/features/transactions/transactions-statement/statement-mark";
import { useT } from "@/i18n/i18n-provider";
import { useMoneyFormat } from "@/privacy/use-money-format";
import { StatementItem } from "@/ui/statement/statement-item";

// The word of a state the reader acts on, and its tone (MS4).
const flags = {
  uncategorized: { key: "transactions.uncategorized", tone: "accent" },
  voided: { key: "transactions.voided", tone: "default" },
} as const;

interface StatementRowProps {
  row: ListRow;
  categories: Map<string, CategoryEntry>;
  scale: (code: string) => number;
  onOpen: (id: string) => void;
  selecting: boolean;
  selected: boolean;
  onSelectedChange: (id: string, selected: boolean) => void;
}

// One transaction of the statement: its category mark, the title over category and accounts, the
// signed amount (spec 2026-11-21-mobile-statement, MS4, MS5 and MS7).
export function StatementRow({
  row,
  categories,
  scale,
  onOpen,
  selecting,
  selected,
  onSelectedChange,
}: StatementRowProps) {
  const t = useT();
  const fmt = useMoneyFormat();

  const entries = row.categoryIds.flatMap((id) => categories.get(id) ?? []);
  const category =
    entries.length > 1
      ? t("transactions.split", { count: entries.length })
      : entries[0]?.name;
  const detail = statementDetail(row, category);
  const amount = fmt.signed(row.money, scale(row.money.currency));
  const selection = selecting
    ? {
        selected,
        label: t("transactions.selectRow", { row: row.title }),
        onSelectedChange: (next: boolean) => {
          onSelectedChange(row.id, next);
        },
      }
    : undefined;

  return (
    <StatementItem
      mark={<StatementMark row={row} category={entries[0]} />}
      title={row.title || t("transactions.untitled")}
      struck={row.voided}
      flag={
        detail.flag && (
          <Text size="sm" tone={flags[detail.flag].tone} weight="medium">
            {t(flags[detail.flag].key)}
          </Text>
        )
      }
      detail={detail.text}
      amount={<AmountCell row={row} text={amount} />}
      note={undefined}
      onOpen={() => {
        onOpen(row.id);
      }}
      selection={selection}
    />
  );
}
