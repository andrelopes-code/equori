import { useQuery } from "@tanstack/react-query";
import { SkeletonRegion } from "@slotted/react/skeleton";
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
  const queries = [booked, settled];
  const failed = queries.find((query) => query.isError);
  if (failed?.error) {
    return (
      <QueryError
        error={failed.error}
        onRetry={() => {
          for (const query of queries) {
            if (query.isError) void query.refetch();
          }
        }}
      />
    );
  }
  if (
    booked.data === undefined ||
    settled.data === undefined ||
    scale === null
  ) {
    return (
      <SkeletonRegion>
        <div className={styles.balances}>
          {queries.map((_, n) => (
            <StatCard key={n} loading>
              <StatCardHeader>
                <StatCardLabel />
              </StatCardHeader>
              <StatCardFigure>
                <StatCardValue />
              </StatCardFigure>
            </StatCard>
          ))}
        </div>
      </SkeletonRegion>
    );
  }
  const cards = [
    {
      key: "booked",
      label: t("accounts.balance.booked"),
      balance: booked.data.balance,
    },
    {
      key: "settled",
      label: t("accounts.balance.settled"),
      balance: settled.data.balance,
    },
  ];
  return (
    <div className={styles.balances}>
      {cards.map(({ key, label, balance }) => (
        <StatCard key={key}>
          <StatCardHeader>
            <StatCardLabel>{label}</StatCardLabel>
          </StatCardHeader>
          <StatCardFigure>
            <StatCardValue>
              <MoneyText money={balance} scale={scale(balance.currency)} />
            </StatCardValue>
          </StatCardFigure>
        </StatCard>
      ))}
    </div>
  );
}
