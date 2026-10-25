import { Stack } from "@slotted/react/stack";
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
import { useT } from "@/i18n/i18n-provider";
import { useToday } from "@/i18n/today";
import { MASK } from "@/privacy/mask";
import { PhoneList } from "@/ui/phone-list";
import { compactQuery, useMediaQuery } from "@/ui/use-media-query";
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
  const compact = useMediaQuery(compactQuery);
  const resultOf = (p: (typeof rows)[number]) =>
    p.market_value === undefined
      ? undefined
      : {
          amount: p.market_value.amount - p.cost_basis.amount,
          currency: p.market_value.currency,
        };
  if (compact)
    return (
      <Stack gap={3}>
        <PhoneList
          label={t("positions.caption")}
          loading={positions.isPending}
          empty={t("positions.empty")}
          rows={rows.map((p) => {
            const result = resultOf(p);
            return {
              key: `${p.account_id}-${p.instrument}`,
              title: p.instrument,
              lines: [
                [
                  t("positions.quantity"),
                  fmt.plain(p.quantity, scale(p.quantity.currency)),
                ].join(": "),
                [t("positions.costBasis"), money(p.cost_basis)].join(": "),
                [
                  t("positions.marketValue"),
                  p.market_value === undefined
                    ? t("positions.noPrice")
                    : money(p.market_value),
                ].join(": "),
              ],
              end:
                result === undefined
                  ? undefined
                  : fmt.signed(result, scale(result.currency)),
            };
          })}
        />
        {base !== undefined && valued.length > 0 && (
          <Text size="sm" tone="muted">
            {[
              t("positions.total"),
              money({ amount: totalValue, currency: base }),
            ].join(": ")}
          </Text>
        )}
      </Stack>
    );
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
                      {fmt.plain(p.quantity, scale(p.quantity.currency))}
                    </TableCell>
                    <TableCell numeric>
                      {fmt.hidden ? MASK : (p.average_cost ?? "")}
                    </TableCell>
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
