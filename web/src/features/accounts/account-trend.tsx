import { Skeleton } from "@slotted/react/skeleton";
import { Sparkline } from "@slotted/react/sparkline";
import { useQuery } from "@tanstack/react-query";

import { useApi } from "@/api/api-context";
import styles from "@/features/accounts/account-trend.module.css";
import { seriesQuery } from "@/features/accounts/api";
import { shiftDate } from "@/i18n/format";
import { useT } from "@/i18n/i18n-provider";
import { useMoneyFormat } from "@/privacy/use-money-format";

// The last 90 days of an account and its sub-accounts, drawn in minor units: the shape is what
// the row shows, and the description reads each value as money. An account that holds several
// instruments has no single series (422 mixed_instruments): its box stays empty.
export function AccountTrend({
  accountId,
  name,
  date,
  currency,
  scale,
}: {
  accountId: string;
  name: string;
  date: string;
  currency: string;
  scale: number;
}) {
  const t = useT();
  const fmt = useMoneyFormat();
  const series = useQuery(
    seriesQuery(useApi(), accountId, shiftDate(date, -89), date),
  );
  return (
    <div className={styles.trend}>
      {series.isError ? null : series.data === undefined ? (
        // The line's own box, reserved while the series loads (waiting-states, section 2).
        <Skeleton shape="block" blockSize="20px" />
      ) : (
        <Sparkline
          size="sm"
          data={series.data.items.map((point) => point.balance.amount)}
          label={t("balanceSheet.trendOf", { name })}
          valueFormatter={(value) =>
            fmt.money({ amount: value, currency }, scale)
          }
        />
      )}
    </div>
  );
}
