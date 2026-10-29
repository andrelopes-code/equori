import {
  ResultState,
  ResultStateContent,
  ResultStateTitle,
} from "@slotted/react/result-state";
import { Stack } from "@slotted/react/stack";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableColumnHeader,
  TableContent,
  TableHead,
  TableLoader,
  TableRow,
} from "@slotted/react/table";
import { Heading, Text } from "@slotted/react/typography";
import { useQuery } from "@tanstack/react-query";

import { useApi } from "@/api/api-context";
import type { components } from "@/api/schema.gen";
import { AccountLink, accountsQuery } from "@/features/accounts";
import { accountLabel } from "@/features/portfolio/account-label";
import { realizedResultsQuery } from "@/features/portfolio/api";
import { YearTotalsTable } from "@/features/portfolio/year-totals-table";
import { totalsBy } from "@/features/portfolio/year-totals";
import { catalogLabel, useScale } from "@/features/setup";
import { formatDate, formatMonthName } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { useMoneyFormat } from "@/privacy/use-money-format";
import { AppLink } from "@/ui/app-link";
import { QueryError } from "@/ui/query-error";

type Account = components["schemas"]["Account"];
type Money = components["schemas"]["Money"];
type Result = components["schemas"]["RealizedResult"];

const columns = 8;

// The sales of a tax year at average cost. The class codes come from the user's
// jurisdiction: a class without a catalog key reads as its code, and no class reads as unclassified.
export function RealizedResultsTab({ year }: { year: number }) {
  const t = useT();
  const [tag] = useAppLocale();
  const api = useApi();
  const fmt = useMoneyFormat();
  const scale = useScale();
  const results = useQuery(realizedResultsQuery(api, year));
  const accounts = useQuery(accountsQuery(api));
  const pending = results.isPending || accounts.isPending || scale === null;
  if (results.isError)
    return (
      <QueryError
        error={results.error}
        onRetry={() => void results.refetch()}
      />
    );
  const items = results.data?.items ?? [];
  const byID = new Map<string, Account>(
    (accounts.data ?? []).map((a) => [a.id, a]),
  );
  const money = (m: Money) => fmt.money(m, scale?.(m.currency) ?? 0);
  const signed = (m: Money) => fmt.signed(m, scale?.(m.currency) ?? 0);
  const classOf = (r: Result) =>
    r.tax_class === null
      ? t("taxYear.unclassified")
      : catalogLabel(t, `taxYear.class.${r.tax_class}`, r.tax_class);
  const accountCell = (r: Result) => {
    const a = byID.get(r.account_id);
    const label = accountLabel(byID, r.account_id);
    return a === undefined ? (
      label
    ) : (
      <AccountLink account={a}>{label}</AccountLink>
    );
  };
  const dateCell = (r: Result) => (
    <AppLink
      variant="neutral"
      underline="hover"
      to={{ to: "/transactions/$id", params: { id: r.transaction_id } }}
    >
      {formatDate(r.date, tag)}
    </AppLink>
  );
  const quantity = (r: Result) =>
    fmt.plain(r.quantity, scale?.(r.quantity.currency) ?? 0);
  const resultTone = (r: Result) =>
    r.result.amount > 0
      ? "success"
      : r.result.amount < 0
        ? "danger"
        : "default";
  const byMonth = totalsBy(
    items,
    (r) => r.month,
    (r) => r.result,
  );
  const byClass = totalsBy(
    items,
    (r) => r.tax_class ?? "",
    (r) => r.result,
  );
  const totals = (
    <Stack gap={4}>
      <YearTotalsTable
        caption={t("taxYear.totals.month")}
        headers={[t("taxYear.month"), t("taxYear.result")]}
        rows={byMonth.map((row) => ({
          key: `${row.key}-${row.currency}`,
          cells: [
            formatMonthName(row.key, tag),
            signed({ amount: row.amount, currency: row.currency }),
          ],
        }))}
      />
      <YearTotalsTable
        caption={t("taxYear.totals.class")}
        headers={[t("taxYear.taxClass"), t("taxYear.result")]}
        rows={byClass.map((row) => ({
          key: `${row.key}-${row.currency}`,
          cells: [
            row.key === ""
              ? t("taxYear.unclassified")
              : catalogLabel(t, `taxYear.class.${row.key}`, row.key),
            signed({ amount: row.amount, currency: row.currency }),
          ],
        }))}
      />
    </Stack>
  );
  if (!pending && items.length === 0)
    return (
      <ResultState status="empty" reach="section">
        <ResultStateContent>
          <ResultStateTitle>{t("taxYear.realized.empty")}</ResultStateTitle>
        </ResultStateContent>
      </ResultState>
    );
  return (
    <Stack gap={6}>
      {!pending && (
        <Stack gap={3}>
          <Heading level={2} size="md">
            {t("taxYear.totals.title")}
          </Heading>
          {totals}
        </Stack>
      )}
      <Table columns={columns} variant="framed">
        <TableContent>
          <TableCaption>{t("taxYear.realized.title")}</TableCaption>
          <TableHead>
            <TableRow>
              <TableColumnHeader>{t("taxYear.date")}</TableColumnHeader>
              <TableColumnHeader>{t("taxYear.instrument")}</TableColumnHeader>
              <TableColumnHeader>{t("taxYear.account")}</TableColumnHeader>
              <TableColumnHeader numeric>
                {t("taxYear.quantity")}
              </TableColumnHeader>
              <TableColumnHeader numeric>{t("taxYear.cost")}</TableColumnHeader>
              <TableColumnHeader numeric>
                {t("taxYear.proceeds")}
              </TableColumnHeader>
              <TableColumnHeader numeric>
                {t("taxYear.result")}
              </TableColumnHeader>
              <TableColumnHeader>{t("taxYear.taxClass")}</TableColumnHeader>
            </TableRow>
          </TableHead>
          {pending ? (
            <TableLoader skeletonRows={3} />
          ) : (
            <TableBody>
              {items.map((r) => (
                <TableRow
                  key={`${r.transaction_id}-${r.instrument}`}
                  value={`${r.transaction_id}-${r.instrument}`}
                >
                  <TableCell>{dateCell(r)}</TableCell>
                  <TableCell>
                    <AppLink
                      variant="neutral"
                      underline="hover"
                      to={{
                        to: "/instruments/$code",
                        params: { code: r.instrument },
                      }}
                    >
                      {r.instrument}
                    </AppLink>
                  </TableCell>
                  <TableCell>{accountCell(r)}</TableCell>
                  <TableCell numeric>{quantity(r)}</TableCell>
                  <TableCell numeric>{money(r.cost)}</TableCell>
                  <TableCell numeric>{money(r.proceeds)}</TableCell>
                  <TableCell numeric>
                    <Text size="sm" tone={resultTone(r)}>
                      {signed(r.result)}
                    </Text>
                  </TableCell>
                  <TableCell>{classOf(r)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          )}
        </TableContent>
      </Table>
    </Stack>
  );
}
