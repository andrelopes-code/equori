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
} from "@slotted/react/table";
import { Text } from "@slotted/react/typography";
import { useQuery } from "@tanstack/react-query";

import { useApi } from "@/api/api-context";
import type { components } from "@/api/schema.gen";
import {
  AccountLink,
  accountsQuery,
  positionsQuery,
} from "@/features/accounts";
import { useScale } from "@/features/setup";
import { useT } from "@/i18n/i18n-provider";
import { useToday } from "@/i18n/today";
import { MASK } from "@/privacy/mask";
import { useMoneyFormat } from "@/privacy/use-money-format";
import { PricedValue } from "@/ui/priced-value";
import { QueryError } from "@/ui/query-error";

type Position = components["schemas"]["Position"];

// The positions of the accounts that hold one instrument at the end of today, each linked to its
// account. listPositions answers for every account, so the page filters by the instrument.
export function InstrumentPositions({ code }: { code: string }) {
  const t = useT();
  const api = useApi();
  const today = useToday();
  const fmt = useMoneyFormat();
  const scale = useScale();
  const positions = useQuery(positionsQuery(api, today));
  const accounts = useQuery(accountsQuery(api));
  const byID = new Map((accounts.data ?? []).map((a) => [a.id, a]));
  const rows = (positions.data ?? []).filter((p) => p.instrument === code);
  const pending = positions.isPending || accounts.isPending || scale === null;
  if (positions.isError)
    return (
      <QueryError
        error={positions.error}
        onRetry={() => void positions.refetch()}
      />
    );
  const money = (m: components["schemas"]["Money"]) =>
    fmt.money(m, scale?.(m.currency) ?? 0);
  const account = (p: Position) => {
    const a = byID.get(p.account_id);
    if (a === undefined) return null;
    const parent =
      a.parent_id === undefined ? undefined : byID.get(a.parent_id);
    return (
      <AccountLink account={a}>
        {parent === undefined ? a.name : `${parent.name} / ${a.name}`}
      </AccountLink>
    );
  };
  const marketValue = (p: Position) =>
    p.market_value === undefined ? (
      <Text size="sm" tone="muted">
        {t("positions.noPrice")}
      </Text>
    ) : (
      <PricedValue value={money(p.market_value)} prices={p.prices} />
    );
  return (
    <Table columns={5} variant="framed">
      <TableContent>
        <TableCaption>{t("instrument.positions.caption")}</TableCaption>
        <TableHead>
          <TableRow>
            <TableColumnHeader>
              {t("instrument.positions.account")}
            </TableColumnHeader>
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
          </TableRow>
        </TableHead>
        {pending ? (
          <TableLoader skeletonRows={2} />
        ) : (
          <TableBody>
            {rows.length === 0 && (
              <TableEmpty>{t("instrument.positions.empty")}</TableEmpty>
            )}
            {rows.map((p) => (
              <TableRow key={p.account_id} value={p.account_id}>
                <TableRowHeader text="truncate">{account(p)}</TableRowHeader>
                <TableCell numeric>
                  {fmt.plain(p.quantity, scale(p.quantity.currency))}
                </TableCell>
                <TableCell numeric>
                  {fmt.hidden ? MASK : (p.average_cost ?? "")}
                </TableCell>
                <TableCell numeric>{money(p.cost_basis)}</TableCell>
                <TableCell numeric>{marketValue(p)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        )}
      </TableContent>
    </Table>
  );
}
