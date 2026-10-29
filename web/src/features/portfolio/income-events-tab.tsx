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
import { Heading } from "@slotted/react/typography";
import { useQuery } from "@tanstack/react-query";

import { useApi } from "@/api/api-context";
import type { components } from "@/api/schema.gen";
import { AccountLink, accountsQuery } from "@/features/accounts";
import { accountLabel } from "@/features/portfolio/account-label";
import { incomeEventsQuery } from "@/features/portfolio/api";
import { totalsBy } from "@/features/portfolio/year-totals";
import { YearTotalsTable } from "@/features/portfolio/year-totals-table";
import { catalogLabel, useScale } from "@/features/setup";
import { formatDate } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { useMoneyFormat } from "@/privacy/use-money-format";
import { AppLink } from "@/ui/app-link";
import { QueryError } from "@/ui/query-error";

type Account = components["schemas"]["Account"];
type Money = components["schemas"]["Money"];
type Event = components["schemas"]["IncomeEvent"];

const columns = 8;

const net = (e: Event): Money => ({
  amount: e.gross.amount - e.withheld.amount,
  currency: e.gross.currency,
});

// The investment income of a tax year. The treatment codes come from the user's
// jurisdiction: a treatment without a catalog key reads as its code, and no treatment reads as
// unclassified. The contract has no net amount, so it is the gross less the withheld.
export function IncomeEventsTab({ year }: { year: number }) {
  const t = useT();
  const [tag] = useAppLocale();
  const api = useApi();
  const fmt = useMoneyFormat();
  const scale = useScale();
  const events = useQuery(incomeEventsQuery(api, year));
  const accounts = useQuery(accountsQuery(api));
  const pending = events.isPending || accounts.isPending || scale === null;
  if (events.isError)
    return (
      <QueryError error={events.error} onRetry={() => void events.refetch()} />
    );
  const items = events.data?.items ?? [];
  const byID = new Map<string, Account>(
    (accounts.data ?? []).map((a) => [a.id, a]),
  );
  const money = (m: Money) => fmt.money(m, scale?.(m.currency) ?? 0);
  const typeLabel = (code: string) =>
    catalogLabel(t, `income.type.${code}`, code);
  const treatmentLabel = (code: string | null) =>
    code === null
      ? t("taxYear.unclassified")
      : catalogLabel(t, `taxYear.treatment.${code}`, code);
  const accountCell = (e: Event) => {
    const a = byID.get(e.account_id);
    const label = accountLabel(byID, e.account_id);
    return a === undefined ? (
      label
    ) : (
      <AccountLink account={a}>{label}</AccountLink>
    );
  };
  const dateCell = (e: Event) => (
    <AppLink
      variant="neutral"
      underline="hover"
      to={{ to: "/transactions/$id", params: { id: e.transaction_id } }}
    >
      {formatDate(e.date, tag)}
    </AppLink>
  );
  const totalsTable = (
    caption: string,
    header: string,
    keyOf: (e: Event) => string,
    label: (key: string) => string,
  ) => {
    const gross = totalsBy(items, keyOf, (e) => e.gross);
    const withheld = totalsBy(items, keyOf, (e) => e.withheld);
    const netted = totalsBy(items, keyOf, net);
    return (
      <YearTotalsTable
        caption={caption}
        headers={[
          header,
          t("taxYear.gross"),
          t("taxYear.withheld"),
          t("taxYear.net"),
        ]}
        rows={gross.map((row, i) => ({
          key: `${row.key}-${row.currency}`,
          cells: [
            label(row.key),
            money(row),
            money({
              amount: withheld[i]?.amount ?? 0,
              currency: row.currency,
            }),
            money({ amount: netted[i]?.amount ?? 0, currency: row.currency }),
          ],
        }))}
      />
    );
  };
  if (!pending && items.length === 0)
    return (
      <ResultState status="empty" reach="section">
        <ResultStateContent>
          <ResultStateTitle>{t("taxYear.income.empty")}</ResultStateTitle>
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
          <Stack gap={4}>
            {totalsTable(
              t("taxYear.income.totals.treatment"),
              t("taxYear.taxTreatment"),
              (e) => e.tax_treatment ?? "",
              (key) => treatmentLabel(key === "" ? null : key),
            )}
            {totalsTable(
              t("taxYear.income.totals.type"),
              t("taxYear.incomeType"),
              (e) => e.income_type,
              typeLabel,
            )}
          </Stack>
        </Stack>
      )}
      <Table columns={columns} variant="framed">
        <TableContent>
          <TableCaption>{t("taxYear.income.title")}</TableCaption>
          <TableHead>
            <TableRow>
              <TableColumnHeader>{t("taxYear.date")}</TableColumnHeader>
              <TableColumnHeader>{t("taxYear.instrument")}</TableColumnHeader>
              <TableColumnHeader>{t("taxYear.account")}</TableColumnHeader>
              <TableColumnHeader>{t("taxYear.incomeType")}</TableColumnHeader>
              <TableColumnHeader>{t("taxYear.taxTreatment")}</TableColumnHeader>
              <TableColumnHeader numeric>
                {t("taxYear.gross")}
              </TableColumnHeader>
              <TableColumnHeader numeric>
                {t("taxYear.withheld")}
              </TableColumnHeader>
              <TableColumnHeader numeric>{t("taxYear.net")}</TableColumnHeader>
            </TableRow>
          </TableHead>
          {pending ? (
            <TableLoader skeletonRows={3} />
          ) : (
            <TableBody>
              {items.map((e) => (
                <TableRow
                  key={`${e.transaction_id}-${e.instrument}`}
                  value={`${e.transaction_id}-${e.instrument}`}
                >
                  <TableCell>{dateCell(e)}</TableCell>
                  <TableCell>
                    <AppLink
                      variant="neutral"
                      underline="hover"
                      to={{
                        to: "/instruments/$code",
                        params: { code: e.instrument },
                      }}
                    >
                      {e.instrument}
                    </AppLink>
                  </TableCell>
                  <TableCell>{accountCell(e)}</TableCell>
                  <TableCell>{typeLabel(e.income_type)}</TableCell>
                  <TableCell>{treatmentLabel(e.tax_treatment)}</TableCell>
                  <TableCell numeric>{money(e.gross)}</TableCell>
                  <TableCell numeric>{money(e.withheld)}</TableCell>
                  <TableCell numeric>{money(net(e))}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          )}
        </TableContent>
      </Table>
    </Stack>
  );
}
