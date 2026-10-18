import { useQuery } from "@tanstack/react-query";
import {
  Section,
  SectionBody,
  SectionHeader,
  SectionHeading,
  SectionTitle,
} from "@slotted/react/section";

import { useApi } from "@/api/api-context";
import type { components } from "@/api/schema.gen";
import { seriesQuery } from "@/features/accounts/api";
import { BalanceChart } from "@/features/accounts/balance-chart";
import {
  ninetyDayWindow,
  toChartPoints,
} from "@/features/accounts/balance-series";
import { useScale } from "@/features/setup";
import { useT } from "@/i18n/i18n-provider";
import { useToday } from "@/i18n/today";

type Account = components["schemas"]["Account"];

export function AccountHistory({ account }: { account: Account }) {
  const t = useT();
  const api = useApi();
  const today = useToday();
  const scale = useScale();
  const { from, to } = ninetyDayWindow(today);
  const series = useQuery(seriesQuery(api, account.id, from, to));
  const accountScale = scale?.(account.currency) ?? 0;
  return (
    <Section>
      <SectionHeader>
        <SectionTitle>
          <SectionHeading>{t("accounts.chart.title")}</SectionHeading>
        </SectionTitle>
      </SectionHeader>
      <SectionBody>
        <BalanceChart
          points={
            series.data === undefined || scale === null
              ? []
              : toChartPoints(series.data, accountScale)
          }
          currency={account.currency}
          scale={accountScale}
          loading={series.data === undefined && !series.isError}
          error={series.isError}
          onRetry={() => {
            void series.refetch();
          }}
        />
      </SectionBody>
    </Section>
  );
}
