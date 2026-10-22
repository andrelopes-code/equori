import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableColumnHeader,
  TableContent,
  TableEmpty,
  TableHead,
  TableLoader,
  TableRow,
  TableRowHeader,
  TableSummary,
} from "@slotted/react/table";
import { Text } from "@slotted/react/typography";
import { useQuery } from "@tanstack/react-query";

import { useApi } from "@/api/api-context";
import type { components } from "@/api/schema.gen";
import { positionsQuery } from "@/features/accounts/api";
import { settingsQuery } from "@/features/setup";
import { formatPlain } from "@/i18n/format";
import { useT } from "@/i18n/i18n-provider";
import { useToday } from "@/i18n/today";
import { useMoneyFormat } from "@/privacy/use-money-format";

type Account = components["schemas"]["Account"];

// The securities the brokerage holds, each at its cost and at the stored price (B05); a
// position without a price says so instead of a number.
export function PositionsTab({
  descendants,
  scale,
}: {
  descendants: Account[];
  scale: (code: string) => number;
}) {
  const t = useT();
  const fmt = useMoneyFormat();
  const api = useApi();
  const today = useToday();
  const positions = useQuery(positionsQuery(api, today));
  const settings = useQuery(settingsQuery(api));
  const base = settings.data?.base_currency;
  const ids = new Set(descendants.map((d) => d.id));
  const rows = (positions.data ?? []).filter((p) => ids.has(p.account_id));
  const money = (m: components["schemas"]["Money"]) =>
    fmt.money(m, scale(m.currency));
  const valued = rows.filter((p) => p.market_value !== undefined);
  const totalValue = valued.reduce(
    (sum, p) => sum + (p.market_value?.amount ?? 0),
    0,
  );
  const totalCost = valued.reduce((sum, p) => sum + p.cost_basis.amount, 0);
  return (
    <Table columns={6} variant="framed">
      <TableContent>
        <TableCaption>{t("positions.caption")}</TableCaption>
        <TableHead>
          <TableRow>
            <TableColumnHeader>{t("positions.instrument")}</TableColumnHeader>
            <TableColumnHeader numeric>
              {t("positions.quantity")}
            </TableColumnHeader>
            <TableColumnHeader numeric>
              {t("positions.averageCost")}
            </TableColumnHeader>
            <TableColumnHeader numeric>
              {t("positions.costBasis")}
            </TableColumnHeader>
            <TableColumnHeader numeric>
              {t("positions.marketValue")}
            </TableColumnHeader>
            <TableColumnHeader numeric>
              {t("positions.result")}
            </TableColumnHeader>
          </TableRow>
        </TableHead>
        {positions.isPending ? (
          <TableLoader skeletonRows={3} />
        ) : (
          <>
            <TableBody>
              {rows.length === 0 && (
                <TableEmpty>{t("positions.empty")}</TableEmpty>
              )}
              {rows.map((p) => {
                const result =
                  p.market_value === undefined
                    ? undefined
                    : {
                        amount: p.market_value.amount - p.cost_basis.amount,
                        currency: p.market_value.currency,
                      };
                return (
                  <TableRow
                    key={`${p.account_id}-${p.instrument}`}
                    value={p.account_id}
                  >
                    <TableRowHeader>{p.instrument}</TableRowHeader>
                    <TableCell numeric>
                      {formatPlain(
                        p.quantity.amount,
                        scale(p.quantity.currency),
                      )}
                    </TableCell>
                    <TableCell numeric>{p.average_cost ?? ""}</TableCell>
                    <TableCell numeric>{money(p.cost_basis)}</TableCell>
                    <TableCell numeric>
                      {p.market_value === undefined ? (
                        <Text size="sm" tone="muted">
                          {t("positions.noPrice")}
                        </Text>
                      ) : (
                        money(p.market_value)
                      )}
                    </TableCell>
                    <TableCell numeric>
                      {result === undefined ? (
                        ""
                      ) : (
                        <Text
                          size="sm"
                          tone={
                            result.amount > 0
                              ? "success"
                              : result.amount < 0
                                ? "danger"
                                : "default"
                          }
                        >
                          {fmt.signed(result, scale(result.currency))}
                        </Text>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
            {base !== undefined && valued.length > 0 && (
              <TableSummary>
                <TableRow>
                  <TableRowHeader colSpan={3}>
                    {t("positions.total")}
                  </TableRowHeader>
                  <TableCell numeric>
                    {money({ amount: totalCost, currency: base })}
                  </TableCell>
                  <TableCell numeric>
                    {money({ amount: totalValue, currency: base })}
                  </TableCell>
                  <TableCell numeric>
                    {fmt.signed(
                      { amount: totalValue - totalCost, currency: base },
                      scale(base),
                    )}
                  </TableCell>
                </TableRow>
              </TableSummary>
            )}
          </>
        )}
      </TableContent>
    </Table>
  );
}
