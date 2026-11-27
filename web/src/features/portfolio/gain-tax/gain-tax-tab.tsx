import { Grid } from "@slotted/react/grid";
import {
  ResultState,
  ResultStateContent,
  ResultStateDescription,
  ResultStateTitle,
} from "@slotted/react/result-state";
import { Text } from "@slotted/react/typography";
import { useQuery } from "@tanstack/react-query";

import { useApi } from "@/api/api-context";
import type { components } from "@/api/schema.gen";
import { gainTaxQuery } from "@/features/portfolio/api";
import { OpeningLossesSection } from "@/features/portfolio/gain-tax/opening-losses-section";
import { gainTaxLines } from "@/features/portfolio/gain-tax/gain-tax-lines";
import { YearTotalsTable } from "@/features/portfolio/year-totals/year-totals-table";
import { catalogLabel, useScale } from "@/features/setup";
import { formatMonthName, numberFormatter } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { useMoneyFormat } from "@/privacy/use-money-format";
import { QueryError } from "@/ui/feedback/query-error";
import { PageStack } from "@/ui/page-layout/page-stack";

type Money = components["schemas"]["Money"];

interface GainTaxTabProps {
  year: number;
}

// GT9: the monthly tax of variable income the jurisdiction computes from the sales, the DARF of
// each month first, then the pools that make it.
export function GainTaxTab({ year }: GainTaxTabProps) {
  const t = useT();
  const [tag] = useAppLocale();
  const api = useApi();
  const fmt = useMoneyFormat();
  const scale = useScale();
  const tax = useQuery(gainTaxQuery(api, year));

  const months = tax.data?.items ?? [];
  const money = (m: Money) => fmt.money(m, scale?.(m.currency) ?? 0);
  const percent = (bp: number) =>
    numberFormatter(tag, { style: "percent", maximumFractionDigits: 2 }).format(
      bp / 10000,
    );
  const crypto = months.some((m) => m.crypto_darf.amount !== 0);

  if (tax.isError)
    return <QueryError error={tax.error} onRetry={() => void tax.refetch()} />;

  if (!tax.isPending && months.length === 0)
    return (
      <ResultState status="empty" reach="section">
        <ResultStateContent>
          <ResultStateTitle>{t("taxYear.gainTax.empty")}</ResultStateTitle>
          <ResultStateDescription>
            {t("taxYear.gainTax.emptyHint")}
          </ResultStateDescription>
        </ResultStateContent>
      </ResultState>
    );

  if (tax.isPending || scale === null) return null;

  return (
    <PageStack>
      <Text size="sm" tone="muted">
        {t("taxYear.gainTax.note")}
      </Text>
      <Grid minItemWidth="md" gap={6}>
        <YearTotalsTable
          caption={t("taxYear.gainTax.darf")}
          headers={[
            t("taxYear.month"),
            t("taxYear.gainTax.carried"),
            t("taxYear.gainTax.toPay"),
            ...(crypto ? [t("taxYear.gainTax.cryptoToPay")] : []),
          ]}
          rows={months.map((m) => ({
            key: m.month,
            cells: [
              formatMonthName(m.month, tag),
              money(m.carried_in),
              money(m.darf),
              ...(crypto ? [money(m.crypto_darf)] : []),
            ],
          }))}
        />
        <YearTotalsTable
          caption={t("taxYear.gainTax.pools")}
          headers={[
            t("taxYear.gainTax.pool"),
            t("taxYear.gainTax.base"),
            t("taxYear.gainTax.rate"),
            t("taxYear.gainTax.due"),
          ]}
          rows={gainTaxLines(months).map((l) => ({
            key: l.key,
            cells: [
              t("taxYear.gainTax.poolOfMonth", {
                month: formatMonthName(l.month, tag),
                pool: catalogLabel(t, `taxYear.pool.${l.pool}`, l.pool),
              }),
              money(l.base),
              percent(l.rate_bp),
              money(l.due),
            ],
          }))}
        />
      </Grid>

      <OpeningLossesSection />
    </PageStack>
  );
}
