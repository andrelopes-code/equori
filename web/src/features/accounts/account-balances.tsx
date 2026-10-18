import { useQuery } from "@tanstack/react-query";
import { Skeleton, SkeletonRegion } from "@slotted/react/skeleton";

import { useApi } from "@/api/api-context";
import type { components } from "@/api/schema.gen";
import { balanceQuery } from "@/features/accounts/api";
import { useScale } from "@/features/setup";
import { useT } from "@/i18n/i18n-provider";
import { useToday } from "@/i18n/today";
import { FigureStrip } from "@/ui/figure-strip";
import { FigureStripItem } from "@/ui/figure-strip-item";
import { MoneyFigure } from "@/ui/money-figure";
import { QueryError } from "@/ui/query-error";

type Account = components["schemas"]["Account"];

// Ledger sheet L18: the booked and settled balances as a strip of figures.
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
        <FigureStrip>
          {["booked", "settled"].map((key) => (
            <FigureStripItem
              key={key}
              label={<Skeleton shape="text" inlineSize="6rem" />}
            >
              <Skeleton shape="text" inlineSize="10rem" />
            </FigureStripItem>
          ))}
        </FigureStrip>
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
    <FigureStrip label={t("accounts.balances")}>
      {cards.map(({ key, label, balance }) => (
        <FigureStripItem key={key} label={label}>
          <MoneyFigure
            money={balance}
            scale={scale(balance.currency)}
            size="xl"
          />
        </FigureStripItem>
      ))}
    </FigureStrip>
  );
}
