import { Inline } from "@slotted/react/inline";
import {
  ResultState,
  ResultStateContent,
  ResultStateDescription,
  ResultStateTitle,
} from "@slotted/react/result-state";
import { Segment, SegmentedControl } from "@slotted/react/segmented-control";
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
  TableRowHeader,
  TableSummary,
} from "@slotted/react/table";
import { Text } from "@slotted/react/typography";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { useApi } from "@/api/api-context";
import type { components } from "@/api/schema.gen";
import {
  AccountLink,
  accountsQuery,
  positionsQuery,
} from "@/features/accounts";
import { accountLabel } from "@/features/portfolio/account-label";
import { groupPositions } from "@/features/portfolio/portfolio-groups";
import type {
  Position,
  PositionGroupBy,
  PositionRow,
} from "@/features/portfolio/portfolio-groups";
import { useScale } from "@/features/setup";
import { formatBasisPoints } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { MASK } from "@/privacy/mask";
import { useMoneyFormat } from "@/privacy/use-money-format";
import { PhoneGroup } from "@/ui/phone-group";
import { PhoneList } from "@/ui/phone-list";
import { PricedValue, usePriceOf } from "@/ui/priced-value";
import { QueryError } from "@/ui/query-error";
import { compactQuery, useMediaQuery } from "@/ui/use-media-query";

type Account = components["schemas"]["Account"];
type Money = components["schemas"]["Money"];

const columns = 8;

// The positions of every account at the valuation date, valued in valueIn. A position without a
// price is marked and stays out of the total and the shares.
export function PortfolioPositions({
  date,
  valueIn,
}: {
  date: string;
  valueIn: string | undefined;
}) {
  const priceOf = usePriceOf();
  const t = useT();
  const [tag] = useAppLocale();
  const api = useApi();
  const fmt = useMoneyFormat();
  const scale = useScale();
  const compact = useMediaQuery(compactQuery);
  const [by, setBy] = useState<PositionGroupBy>("account");
  const positions = useQuery({
    ...positionsQuery(api, date, valueIn),
    enabled: valueIn !== undefined,
  });
  const accounts = useQuery(accountsQuery(api));
  const pending =
    positions.isPending ||
    accounts.isPending ||
    scale === null ||
    valueIn === undefined;
  if (positions.isError)
    return (
      <QueryError
        error={positions.error}
        onRetry={() => void positions.refetch()}
      />
    );
  const byID = new Map<string, Account>(
    (accounts.data ?? []).map((a) => [a.id, a]),
  );
  const labelOf = (id: string) => accountLabel(byID, id);
  const { groups, total, unvalued } = groupPositions(
    positions.data ?? [],
    by,
    (p) => labelOf(p.account_id),
    tag,
  );
  const digits = (code: string) => scale?.(code) ?? 0;
  const money = (m: Money) => fmt.money(m, digits(m.currency));
  const accountCell = (p: Position) => {
    const a = byID.get(p.account_id);
    return a === undefined ? (
      labelOf(p.account_id)
    ) : (
      <AccountLink account={a}>{labelOf(p.account_id)}</AccountLink>
    );
  };
  const instrumentCell = (p: Position) => (
    <Link to="/instruments/$code" params={{ code: p.instrument }}>
      {p.instrument}
    </Link>
  );
  const marketCell = (p: Position) =>
    p.market_value === undefined ? (
      <Text size="sm" tone="muted">
        {t("positions.noPrice")}
      </Text>
    ) : (
      <PricedValue value={money(p.market_value)} prices={p.prices} />
    );
  const resultCell = (p: Position) => {
    if (p.market_value === undefined) return "";
    if (p.market_value.currency !== p.cost_basis.currency)
      return <span role="img" aria-label={t("portfolio.resultMixed")} />;
    const result = {
      amount: p.market_value.amount - p.cost_basis.amount,
      currency: p.market_value.currency,
    };
    return (
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
        {fmt.signed(result, digits(result.currency))}
      </Text>
    );
  };
  const shareText = (row: PositionRow) =>
    row.share === undefined ? "" : formatBasisPoints(row.share, tag);
  const empty = !pending && groups.length === 0;
  return (
    <Stack gap={3}>
      <Inline gap={3} wrap="wrap" align="center">
        <SegmentedControl
          size="sm"
          aria-label={t("portfolio.group")}
          value={by}
          onValueChange={(value) => {
            if (value === "account" || value === "instrument") setBy(value);
          }}
        >
          <Segment value="account">{t("portfolio.group.account")}</Segment>
          <Segment value="instrument">
            {t("portfolio.group.instrument")}
          </Segment>
        </SegmentedControl>
      </Inline>
      {unvalued > 0 && (
        <Text size="sm" tone="muted">
          {t("portfolio.unvalued", { count: unvalued })}
        </Text>
      )}
      {empty ? (
        <ResultState status="empty" reach="section">
          <ResultStateContent>
            <ResultStateTitle>{t("portfolio.empty")}</ResultStateTitle>
            <ResultStateDescription>
              {t("portfolio.emptyHint")}
            </ResultStateDescription>
          </ResultStateContent>
        </ResultState>
      ) : compact ? (
        <Stack gap={4}>
          {pending && (
            <PhoneList
              label={t("portfolio.positions.title")}
              loading
              empty=""
              rows={[]}
            />
          )}
          {groups.map((group) => (
            <PhoneGroup
              key={group.key}
              label={group.label}
              end={
                valueIn === undefined || group.value === 0
                  ? undefined
                  : money({ amount: group.value, currency: valueIn })
              }
            >
              <PhoneList
                label={group.label}
                loading={false}
                empty=""
                rows={group.rows.map((row) => ({
                  key: `${row.position.account_id}-${row.position.instrument}`,
                  title: instrumentCell(row.position),
                  lines: [
                    accountCell(row.position),
                    [
                      t("positions.quantity"),
                      fmt.plain(
                        row.position.quantity,
                        digits(row.position.quantity.currency),
                      ),
                    ].join(": "),
                    [
                      t("positions.costBasis"),
                      money(row.position.cost_basis),
                    ].join(": "),
                    [
                      t("positions.marketValue"),
                      row.position.market_value === undefined
                        ? t("positions.noPrice")
                        : [
                            money(row.position.market_value),
                            priceOf(row.position.prices),
                          ]
                            .filter(Boolean)
                            .join(" · "),
                    ].join(": "),
                    row.share === undefined
                      ? ""
                      : [t("portfolio.share"), shareText(row)].join(": "),
                  ],
                  end: resultCell(row.position),
                }))}
              />
            </PhoneGroup>
          ))}
          {valueIn !== undefined && groups.length > 0 && (
            <Text size="sm" tone="muted">
              {[
                t("portfolio.total"),
                money({ amount: total, currency: valueIn }),
              ].join(": ")}
            </Text>
          )}
        </Stack>
      ) : (
        <Table columns={columns} variant="framed">
          <TableContent>
            <TableCaption>{t("portfolio.positions.title")}</TableCaption>
            <TableHead>
              <TableRow>
                <TableColumnHeader>
                  {t("positions.instrument")}
                </TableColumnHeader>
                <TableColumnHeader>{t("portfolio.account")}</TableColumnHeader>
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
                <TableColumnHeader numeric>
                  {t("portfolio.share")}
                </TableColumnHeader>
              </TableRow>
            </TableHead>
            {pending ? (
              <TableLoader skeletonRows={3} />
            ) : (
              <>
                <TableBody>
                  {groups.flatMap((group) => [
                    <TableRow key={group.key}>
                      <TableRowHeader colSpan={columns}>
                        {group.label}
                      </TableRowHeader>
                    </TableRow>,
                    ...group.rows.map((row) => (
                      <TableRow
                        key={`${row.position.account_id}-${row.position.instrument}`}
                        value={`${row.position.account_id}-${row.position.instrument}`}
                      >
                        <TableCell>{instrumentCell(row.position)}</TableCell>
                        <TableCell>{accountCell(row.position)}</TableCell>
                        <TableCell numeric>
                          {fmt.plain(
                            row.position.quantity,
                            digits(row.position.quantity.currency),
                          )}
                        </TableCell>
                        <TableCell numeric>
                          {fmt.hidden
                            ? MASK
                            : (row.position.average_cost ?? "")}
                        </TableCell>
                        <TableCell numeric>
                          {money(row.position.cost_basis)}
                        </TableCell>
                        <TableCell numeric>
                          {marketCell(row.position)}
                        </TableCell>
                        <TableCell numeric>
                          {resultCell(row.position)}
                        </TableCell>
                        <TableCell numeric>{shareText(row)}</TableCell>
                      </TableRow>
                    )),
                  ])}
                </TableBody>
                <TableSummary>
                  <TableRow>
                    <TableRowHeader colSpan={5}>
                      {t("portfolio.total")}
                    </TableRowHeader>
                    <TableCell numeric>
                      {money({ amount: total, currency: valueIn })}
                    </TableCell>
                    <TableCell numeric />
                    <TableCell numeric>
                      {formatBasisPoints(total === 0 ? 0 : 10000, tag)}
                    </TableCell>
                  </TableRow>
                </TableSummary>
              </>
            )}
          </TableContent>
        </Table>
      )}
    </Stack>
  );
}
