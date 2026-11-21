import { Text } from "@slotted/react/typography";
import { useNavigate } from "@tanstack/react-router";

import styles from "@/features/accounts/account-ledger/account-ledger.module.css";
import { LedgerMark } from "@/features/accounts/account-ledger/ledger-mark";
import type { LedgerRow } from "@/features/accounts/account-ledger/running-balance";
import type { CategoryEntry } from "@/features/categories";
import { useT } from "@/i18n/i18n-provider";
import { PhoneList } from "@/ui/form-fields/phone-list";
import { StatementDay } from "@/ui/statement/statement-day";
import { StatementItem } from "@/ui/statement/statement-item";
import { StatementList } from "@/ui/statement/statement-list";
import { StatementPlaceholder } from "@/ui/statement/statement-placeholder";

interface AccountLedgerListProps {
  days: [string, LedgerRow[]][];
  loading: boolean;
  categories: Map<string, CategoryEntry>;
  uncategorized: ReadonlySet<string>;
  title: (row: LedgerRow) => string;
  counterparts: (row: LedgerRow) => string;
  amount: (row: LedgerRow) => string;
  balance: (row: LedgerRow) => string | undefined;
  dayEnd: (rows: LedgerRow[]) => string;
  dayLabel: (day: string) => string;
}

// Below 600 px the movements read as the statement of /transactions (spec
// 2026-11-21-mobile-statement): days with their net change, each row with the other accounts
// under its title and the balance it left under its amount. A cleared or reconciled movement is
// the normal state and carries no word; a pending one names it.
export function AccountLedgerList({
  days,
  loading,
  categories,
  uncategorized,
  title,
  counterparts,
  amount,
  balance,
  dayEnd,
  dayLabel,
}: AccountLedgerListProps) {
  const t = useT();
  const navigate = useNavigate();

  if (loading) return <StatementPlaceholder label={t("ledger.caption")} />;

  if (days.length === 0) {
    return (
      <PhoneList
        label={t("ledger.caption")}
        rows={[]}
        loading={false}
        empty={t("ledger.empty")}
      />
    );
  }

  return (
    <StatementList label={t("ledger.caption")}>
      {days.map(([day, rows]) => (
        <StatementDay key={day} label={dayLabel(day)} end={dayEnd(rows)}>
          {rows.map((row) => (
            <StatementItem
              key={row.id}
              mark={
                <LedgerMark
                  row={row}
                  categories={categories}
                  uncategorized={uncategorized}
                />
              }
              title={title(row)}
              struck={row.voided}
              flag={
                (row.voided || row.status === "pending") && (
                  <Text
                    size="sm"
                    weight="medium"
                    tone={row.voided ? "default" : "warning"}
                  >
                    {t(row.voided ? "ledger.voided" : "posting.status.pending")}
                  </Text>
                )
              }
              detail={counterparts(row)}
              amount={
                <Text
                  weight="semibold"
                  numeric="tabular"
                  className={row.voided ? styles.voided : undefined}
                  tone={!row.voided && row.amount > 0 ? "success" : "default"}
                >
                  {amount(row)}
                </Text>
              }
              note={
                <Text size="xs" tone="muted" numeric="tabular">
                  {balance(row)}
                </Text>
              }
              onOpen={() => {
                void navigate({
                  to: "/transactions/$id",
                  params: { id: row.id },
                });
              }}
              selection={undefined}
            />
          ))}
        </StatementDay>
      ))}
    </StatementList>
  );
}
