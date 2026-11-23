import { Inline } from "@slotted/react/inline";
import { TableCell, TableRow, TableRowHeader } from "@slotted/react/table";
import { Text } from "@slotted/react/typography";

import type { components } from "@/api/schema.gen";
import { shareText } from "@/features/portfolio/contribution-plan/model/share-text";
import { GroupDot } from "@/features/portfolio/contribution-plan/month/group-dot";
import styles from "@/features/portfolio/contribution-plan/month/purchase-row.module.css";
import { useScale } from "@/features/setup";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { useMoneyFormat } from "@/privacy/use-money-format";

type Money = components["schemas"]["Money"];

interface LeftoverRowProps {
  // The key of the leftover segment in the bar.
  rowKey: string;
  amount: Money;
  // The contribution in minor units: the base of the share.
  base: number;
  // Whether the list draws the column of the profit.
  withProfit: boolean;
  onPointer: (key: string | undefined) => void;
}

// The money CN18 leaves unspent, as the last row of the purchase list: hatched like its segment.
export function LeftoverRow({
  rowKey,
  amount,
  base,
  withProfit,
  onPointer,
}: LeftoverRowProps) {
  const t = useT();
  const [locale] = useAppLocale();
  const fmt = useMoneyFormat();
  const scale = useScale();

  return (
    <TableRow
      value={rowKey}
      onMouseEnter={() => {
        onPointer(rowKey);
      }}
      onMouseLeave={() => {
        onPointer(undefined);
      }}
    >
      <TableRowHeader text="truncate">
        <Inline gap={4} align="center" wrap="nowrap">
          <GroupDot shape="square" />

          {t("contributionPlan.leftoverName")}
        </Inline>
      </TableRowHeader>

      <TableCell text="truncate">
        <Text size="sm" tone="muted">
          {t("contributionPlan.leftoverStays")}
        </Text>
      </TableCell>

      {withProfit && <TableCell className={styles.wide} />}

      <TableCell />

      <TableCell numeric text="nowrap">
        <Text weight="semibold">
          {fmt.money(amount, scale?.(amount.currency) ?? 0)}
        </Text>
      </TableCell>

      <TableCell numeric text="nowrap" className={styles.wide}>
        <Text size="sm" tone="muted">
          {shareText(amount.amount / base, locale)}
        </Text>
      </TableCell>
    </TableRow>
  );
}
