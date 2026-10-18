import { useQuery } from "@tanstack/react-query";
import { Link } from "@slotted/react/link";
import { ProgressBar } from "@slotted/react/progress-indicator";
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
import { balanceQuery } from "@/features/accounts";
import styles from "@/features/cards/card-overview-page.module.css";
import { usedShare } from "@/features/cards/card-math";
import { useScale } from "@/features/setup";
import { useT } from "@/i18n/i18n-provider";
import { useToday } from "@/i18n/today";
import { MoneyText } from "@/ui/money-text";
import { QueryError } from "@/ui/query-error";
import { useSpaLink } from "@/ui/use-spa-link";

type Account = components["schemas"]["Account"];

export function CardStats({
  account,
  compact,
}: {
  account: Account;
  compact: boolean;
}) {
  const t = useT();
  const api = useApi();
  const today = useToday();
  const scale = useScale();
  const spaLink = useSpaLink();
  const booked = useQuery(balanceQuery(api, account.id, today, "booked"));
  const size = compact ? "sm" : "md";
  const layout = compact ? styles.compact : styles.stats;
  if (booked.isError) {
    return (
      <QueryError
        error={booked.error}
        onRetry={() => {
          void booked.refetch();
        }}
      />
    );
  }
  if (booked.data === undefined || scale === null) {
    return (
      <SkeletonRegion>
        <div className={layout}>
          {[0, 1, 2].map((n) => (
            <StatCard key={n} size={size} loading>
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
  const { credit_limit: limit, available_limit: available } =
    account.card ?? {};
  const debt = {
    amount: -booked.data.balance.amount,
    currency: booked.data.balance.currency,
  };
  const money = (value: { amount: number; currency: string }) => (
    <MoneyText money={value} scale={scale(value.currency)} />
  );
  return (
    <div className={styles.summary}>
      <div className={layout}>
        <StatCard size={size}>
          <StatCardHeader>
            <StatCardLabel>{t("cards.stat.debt")}</StatCardLabel>
          </StatCardHeader>
          <StatCardFigure>
            <StatCardValue>{money(debt)}</StatCardValue>
          </StatCardFigure>
        </StatCard>
        <StatCard size={size}>
          <StatCardHeader>
            <StatCardLabel>{t("cards.stat.limit")}</StatCardLabel>
          </StatCardHeader>
          <StatCardFigure>
            <StatCardValue>
              {limit === undefined ? (
                <Link {...spaLink(`/cards/${account.id}/settings`)}>
                  {t("cards.stat.nolimit")}
                </Link>
              ) : (
                money(limit)
              )}
            </StatCardValue>
          </StatCardFigure>
        </StatCard>
        <StatCard
          size={size}
          status={available === undefined ? "empty" : "ready"}
        >
          <StatCardHeader>
            <StatCardLabel>{t("cards.stat.available")}</StatCardLabel>
          </StatCardHeader>
          <StatCardFigure>
            <StatCardValue>
              {available === undefined ? undefined : money(available)}
            </StatCardValue>
          </StatCardFigure>
        </StatCard>
      </div>
      <ProgressBar
        label={t("cards.stat.used")}
        showValue
        value={usedShare(debt.amount, limit?.amount)}
      />
    </div>
  );
}
