import { useQuery } from "@tanstack/react-query";
import {
  StatCard,
  StatCardFigure,
  StatCardHeader,
  StatCardLabel,
  StatCardValue,
} from "@slotted/react/stat-card";

import { useApi } from "@/api/api-context";
import type { components } from "@/api/schema.gen";
import styles from "@/features/accounts/account-page.module.css";
import { balanceQuery } from "@/features/accounts/api";
import { useScale } from "@/features/setup";
import { useT } from "@/i18n/i18n-provider";
import { useToday } from "@/i18n/today";
import { MoneyText } from "@/ui/money-text";
import { QueryError } from "@/ui/query-error";

type Account = components["schemas"]["Account"];

export function AccountBalances({ account }: { account: Account }) {
  const t = useT();
  const api = useApi();
  const today = useToday();
  const scale = useScale();
  const booked = useQuery(balanceQuery(api, account.id, today, "booked"));
  const settled = useQuery(balanceQuery(api, account.id, today, "settled"));
  const cards = [
    { key: "booked", label: t("accounts.balance.booked"), query: booked },
    { key: "settled", label: t("accounts.balance.settled"), query: settled },
  ] as const;
  const failed = cards.find(({ query }) => query.isError)?.query;
  if (failed?.error) {
    return (
      <QueryError
        error={failed.error}
        onRetry={() => {
          for (const { query } of cards) {
            if (query.isError) void query.refetch();
          }
        }}
      />
    );
  }
  return (
    <div className={styles.balances}>
      {cards.map(({ key, label, query }) => (
        <StatCard key={key}>
          <StatCardHeader>
            <StatCardLabel>{label}</StatCardLabel>
          </StatCardHeader>
          <StatCardFigure>
            <StatCardValue>
              {query.data === undefined || scale === null ? (
                t("accounts.loading")
              ) : (
                <MoneyText
                  money={query.data.balance}
                  scale={scale(query.data.balance.currency)}
                  tone="balance"
                />
              )}
            </StatCardValue>
          </StatCardFigure>
        </StatCard>
      ))}
    </div>
  );
}
