import { Inline } from "@slotted/react/inline";
import { Stack } from "@slotted/react/stack";
import { Tag } from "@slotted/react/tag";
import { Text } from "@slotted/react/typography";
import type { ReactNode } from "react";

import styles from "@/features/accounts/account-ledger.module.css";
import type { LedgerRow } from "@/features/accounts/running-balance";
import { PhoneGroup } from "@/ui/phone-group";
import { useT } from "@/i18n/i18n-provider";
import type { MessageKey } from "@/i18n/catalog.en";
import { PhoneList } from "@/ui/phone-list";

const statusLabel: Record<LedgerRow["status"], MessageKey> = {
  pending: "posting.status.pending",
  cleared: "posting.status.cleared",
  reconciled: "posting.status.reconciled",
};

const statusTone = {
  pending: "warning",
  cleared: "info",
  reconciled: "success",
} as const;

// Below 600 px the movements are rows grouped by day (mobile.md M1): the title, then the other
// account and the state, with the signed change and the balance it left at the end.
export function AccountLedgerList({
  days,
  loading,
  title,
  counterparts,
  amount,
  balance,
  dayEnd,
  dayLabel,
}: {
  days: [string, LedgerRow[]][];
  loading: boolean;
  title: (row: LedgerRow) => string;
  counterparts: (row: LedgerRow) => string;
  amount: (row: LedgerRow) => string;
  balance: (row: LedgerRow) => string | undefined;
  dayEnd: (rows: LedgerRow[]) => string;
  dayLabel: (day: string) => string;
}) {
  const t = useT();
  if (loading || days.length === 0)
    return (
      <PhoneList
        label={t("ledger.caption")}
        rows={[]}
        loading={loading}
        empty={t("ledger.empty")}
      />
    );
  return (
    <Stack gap={4}>
      {days.map(([day, rows]) => (
        <PhoneGroup key={day} label={dayLabel(day)} end={dayEnd(rows)}>
          <PhoneList
            label={dayLabel(day)}
            loading={false}
            empty=""
            rows={rows.map((row) => {
              const left = balance(row);
              const end: ReactNode = (
                <Stack gap={0} align="end">
                  <Text
                    size="sm"
                    weight="semibold"
                    className={
                      row.voided
                        ? styles.voided
                        : row.amount > 0
                          ? styles.positive
                          : undefined
                    }
                  >
                    {amount(row)}
                  </Text>
                  {left !== undefined && (
                    <Text size="xs" tone="muted">
                      {left}
                    </Text>
                  )}
                </Stack>
              );
              return {
                key: row.id,
                title: (
                  <span className={row.voided ? styles.voided : undefined}>
                    {title(row)}
                  </span>
                ),
                link: {
                  to: "/transactions/$id",
                  params: { id: row.id },
                },
                lines: [
                  counterparts(row),
                  <Inline key="status" gap={4}>
                    <Tag size="sm" tone={statusTone[row.status]}>
                      {t(statusLabel[row.status])}
                    </Tag>
                    {row.voided && (
                      <Tag size="sm" tone="secondary">
                        {t("ledger.voided")}
                      </Tag>
                    )}
                  </Inline>,
                ],
                end,
              };
            })}
          />
        </PhoneGroup>
      ))}
    </Stack>
  );
}
