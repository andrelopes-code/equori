import { Button } from "@slotted/react/button";
import { Inline } from "@slotted/react/inline";
import { TableCell, TableRow, TableRowHeader } from "@slotted/react/table";
import { Text } from "@slotted/react/typography";

import type { ShoppingEntry } from "@/features/portfolio/contribution-plan/model/shopping-list";
import { shareText } from "@/features/portfolio/contribution-plan/model/share-text";
import { FundReportLink } from "@/features/portfolio/contribution-plan/month/fund-report-link";
import { GroupDot } from "@/features/portfolio/contribution-plan/month/group-dot";
import { orderText } from "@/features/portfolio/contribution-plan/month/order-text";
import styles from "@/features/portfolio/contribution-plan/month/purchase-row.module.css";
import { useScale } from "@/features/setup";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { useMoneyFormat } from "@/privacy/use-money-format";

interface PurchaseRowProps {
  entry: ShoppingEntry;
  // The group of a member; nothing when the row is the group itself.
  groupName?: string | undefined;
  // The contribution in minor units: the base of the row's share.
  base: number;
  // Whether the list draws the column of the profit, and the change of this company's.
  withProfit: boolean;
  profit?: string | undefined;
  // Enters edit mode with the assets of the entry's group open.
  onSplit: (group: number) => void;
  // Opens the indexer comparison for a row bought by value; undefined when none is offered.
  onCompare?: ((entry: ShoppingEntry) => void) | undefined;
  // Opens the fund report of a row that names an instrument; undefined when none is offered.
  onReport?: ((entry: ShoppingEntry) => void) | undefined;
  // Opens the statements of the row's company; offered when the row has a change of profit.
  onStatements: (entry: ShoppingEntry) => void;
  // The key of the row under the pointer, or undefined when it leaves.
  onPointer: (key: string | undefined) => void;
}

// A purchase: swatch and name, group, order, cost and share of the contribution (spec, Purchase
// list as one bar).
export function PurchaseRow({
  entry,
  groupName,
  base,
  withProfit,
  profit,
  onSplit,
  onCompare,
  onReport,
  onStatements,
  onPointer,
}: PurchaseRowProps) {
  const t = useT();
  const [locale] = useAppLocale();
  const fmt = useMoneyFormat();
  const scale = useScale();

  const money = (m: ShoppingEntry["cost"]) =>
    fmt.money(m, scale?.(m.currency) ?? 0);
  const order = orderText(entry, { t, money, locale, hidden: fmt.hidden });
  const points =
    entry.criteria === undefined
      ? undefined
      : t("contributionPlan.criteriaCount", {
          yes: String(entry.criteria.yes),
          count: String(entry.criteria.count),
        });
  const share = shareText(entry.cost.amount / base, locale);

  return (
    <TableRow
      value={entry.name}
      onMouseEnter={() => {
        onPointer(entry.name);
      }}
      onMouseLeave={() => {
        onPointer(undefined);
      }}
    >
      <TableRowHeader text="truncate">
        <Inline gap={4} align="center" wrap="nowrap">
          <GroupDot position={entry.group} shape="square" />

          {entry.name}
        </Inline>
      </TableRowHeader>

      <TableCell text="truncate">
        <Text size="sm" tone="muted">
          {groupName}
          {points !== undefined && (
            <span className={styles.wide}>
              {groupName !== undefined && " · "}
              {points}
            </span>
          )}
        </Text>
      </TableCell>

      {withProfit && (
        <TableCell text="nowrap" className={styles.wide}>
          <Text size="sm">{profit}</Text>
        </TableCell>
      )}

      <TableCell align="end" text="nowrap">
        {entry.splitToSee === true && (
          <Button
            inline
            size="sm"
            onClick={() => {
              onSplit(entry.group);
            }}
          >
            {t("contributionPlan.splitToSee")}
          </Button>
        )}

        {order !== undefined && (
          <Text size="sm" tone="muted">
            {order}
          </Text>
        )}

        {entry.byValue === true && onCompare !== undefined && (
          <Button
            inline
            size="sm"
            className={styles.compare}
            onClick={() => {
              onCompare(entry);
            }}
          >
            {t("contributionPlan.compareIndexers")}
          </Button>
        )}

        {profit !== undefined && (
          <Button
            inline
            size="sm"
            className={styles.compare}
            onClick={() => {
              onStatements(entry);
            }}
          >
            {t("contributionPlan.companyReport")}
          </Button>
        )}

        {entry.code !== undefined && onReport !== undefined && (
          <FundReportLink
            code={entry.code}
            onOpen={() => {
              onReport(entry);
            }}
          />
        )}
      </TableCell>

      <TableCell numeric text="nowrap">
        <Text weight="semibold">{money(entry.cost)}</Text>
      </TableCell>

      <TableCell numeric text="nowrap" className={styles.wide}>
        <Text size="sm" tone="muted">
          {share}
        </Text>
      </TableCell>
    </TableRow>
  );
}
